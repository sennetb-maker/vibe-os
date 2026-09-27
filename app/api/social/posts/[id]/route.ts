import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const ALLOWED = new Set(["working", "review", "approved", "scheduled", "published", "failed"]);
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ message: "Supabase is not configured." }, { status: 503 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body?.status ? String(body.status) : undefined;
  if (status && !ALLOWED.has(status)) return NextResponse.json({ message: "Unsupported post status." }, { status: 400 });

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  if (body?.scheduled_for !== undefined) patch.scheduled_for = body.scheduled_for || null;
  if (body?.caption !== undefined) patch.caption = body.caption;
  if (body?.destination_url !== undefined) patch.destination_url = body.destination_url;
  if (body?.cta !== undefined) patch.cta = body.cta;
  if (body?.hashtags !== undefined) patch.hashtags = body.hashtags;
  if (body?.platform !== undefined) patch.platform = body.platform;
  if (body?.post_type !== undefined) patch.post_type = body.post_type;
  if (body?.product_name !== undefined) patch.product_name = body.product_name || null;
  if (body?.visual_preset !== undefined) {
    patch.visual_preset = body.visual_preset;
    patch.render_status = "needs_render";
  }
  if (body?.crop_mode !== undefined) {
    patch.crop_mode = body.crop_mode;
    patch.render_status = "needs_render";
  }
  if (body?.agent_notes !== undefined) patch.agent_notes = body.agent_notes;
  if (body?.approved || status === "approved" || status === "scheduled") patch.approved_at = new Date().toISOString();

  const { data, error } = await supabase.from("social_posts").update(patch).eq("id", id).select("id,platform,status,scheduled_for").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  if (data.status === "scheduled" || data.status === "approved" || data.status === "published") {
    const { data: links } = await supabase.from("social_post_assets").select("asset_id").eq("post_id", id);
    const assetIds = Array.from(new Set((links || []).map((x: any) => x.asset_id).filter(Boolean)));
    if (assetIds.length) {
      await supabase.from("content_assets").update({ status: "used", updated_at: new Date().toISOString() }).in("id", assetIds);
    }
  }
  await supabase.from("activity_log").insert({ source: "Vibe OS", event_type: "social_post_updated", summary: `${data.platform} post moved to ${data.status}`, payload: { post_id: id, status: data.status } });
  return NextResponse.json({ message: status === "scheduled" ? "Post approved and scheduled." : "Post updated.", post: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ message: "Supabase is not configured." }, { status: 503 });
  const { id } = await params;

  const { data: post, error: readError } = await supabase
    .from("social_posts")
    .select("id,status,published_at,external_post_id")
    .eq("id", id)
    .single();
  if (readError || !post) return NextResponse.json({ message: readError?.message || "Post not found." }, { status: 404 });

  if (post.published_at || post.external_post_id || post.status === "published") {
    return NextResponse.json({ message: "Published post history cannot be deleted from Vibe OS." }, { status: 409 });
  }

  await supabase.from("social_post_media").delete().eq("post_id", id);
  await supabase.from("social_post_assets").delete().eq("post_id", id);
  const { error } = await supabase.from("social_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await supabase.from("activity_log").insert({
    source: "Vibe OS",
    event_type: "social_post_deleted",
    summary: "Social draft removed",
    payload: { post_id: id }
  });

  return NextResponse.json({ message: "Draft deleted." });
}
