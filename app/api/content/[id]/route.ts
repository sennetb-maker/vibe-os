import { NextResponse } from "next/server";
import { contentBucket, getSupabaseAdmin } from "@/lib/supabaseServer";

const ALLOWED = new Set(["inbox", "working", "used", "archived"]);

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ message: "Supabase is not configured." }, { status: 503 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = String(body?.status || "");
  if (!ALLOWED.has(status)) return NextResponse.json({ message: "Unsupported asset status." }, { status: 400 });

  const patch: Record<string, any> = { status, updated_at: new Date().toISOString() };
  patch.archived_at = status === "archived" ? new Date().toISOString() : null;
  const { data, error } = await supabase.from("content_assets").update(patch).eq("id", id).select("id,file_name,status").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await supabase.from("activity_log").insert({ source: "Vibe OS", event_type: "content_status_changed", summary: `${data.file_name} moved to ${status}`, payload: { asset_id: id, status } });
  return NextResponse.json({ message: status === "archived" ? "Removed from the active agent content pool." : "Asset restored to the Content Inbox.", asset: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ message: "Supabase is not configured." }, { status: 503 });
  const { id } = await params;

  const { data: asset, error: readError } = await supabase
    .from("content_assets")
    .select("id,file_name,storage_path")
    .eq("id", id)
    .single();
  if (readError || !asset) return NextResponse.json({ message: readError?.message || "Asset not found." }, { status: 404 });

  const { data: links } = await supabase.from("social_post_assets").select("post_id").eq("asset_id", id);
  const linkedIds = Array.from(new Set((links || []).map((x: any) => x.post_id).filter(Boolean)));
  const { data: linkedPosts } = linkedIds.length
    ? await supabase.from("social_posts").select("id,status,published_at,external_post_id").in("id", linkedIds)
    : { data: [] as any[] };

  const { data: legacyPosts } = await supabase
    .from("social_posts")
    .select("id,status,published_at,external_post_id")
    .eq("asset_id", id);

  const allLinked = [...(linkedPosts || []), ...(legacyPosts || [])];
  const protectedPost = allLinked.some((p: any) =>
    p.published_at || p.external_post_id || ["scheduled", "approved", "published"].includes(String(p.status))
  );

  if (protectedPost) {
    await supabase.from("content_assets")
      .update({ status: "archived", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({
      message: "This asset is attached to an approved, scheduled, or published post, so it was archived instead of permanently deleted.",
      archived: true
    });
  }

  const draftIds = Array.from(new Set(allLinked.map((p: any) => p.id).filter(Boolean)));
  if (draftIds.length) {
    await supabase.from("social_post_media").delete().in("post_id", draftIds);
    await supabase.from("social_post_assets").delete().in("post_id", draftIds);
    await supabase.from("social_posts").delete().in("id", draftIds);
  }

  if (asset.storage_path) await supabase.storage.from(contentBucket()).remove([asset.storage_path]);
  const { error } = await supabase.from("content_assets").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await supabase.from("activity_log").insert({
    source: "Vibe OS",
    event_type: "content_deleted",
    summary: `${asset.file_name} permanently deleted`,
    payload: { asset_id: id, removed_draft_posts: draftIds.length }
  });
  return NextResponse.json({
    message: draftIds.length
      ? `Deleted the asset and removed ${draftIds.length} unscheduled draft${draftIds.length === 1 ? "" : "s"} that depended on it.`
      : "Asset permanently deleted."
  });
}
