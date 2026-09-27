import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ message: "Supabase is not configured." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const platform = ["Instagram","Facebook","TikTok"].includes(String(body.platform)) ? String(body.platform) : "Instagram";
  const postType = ["image","carousel","reel","video","story"].includes(String(body.post_type)) ? String(body.post_type) : "image";
  const scheduledFor = body.scheduled_for ? new Date(body.scheduled_for) : null;
  const assetIds = Array.isArray(body.asset_ids) ? Array.from(new Set(body.asset_ids.map(String))).slice(0,8) : [];

  const row = {
    platform,
    post_type: postType,
    status: "review",
    caption: String(body.caption || ""),
    hashtags: String(body.hashtags || ""),
    cta: body.cta ? String(body.cta) : null,
    destination_url: body.destination_url ? String(body.destination_url) : null,
    product_name: body.product_name ? String(body.product_name) : null,
    scheduled_for: scheduledFor && Number.isFinite(scheduledFor.getTime()) ? scheduledFor.toISOString() : null,
    render_status: "not_rendered",
    updated_at: new Date().toISOString(),
    asset_id: assetIds[0] || null,
  };

  const { data: post, error } = await supabase.from("social_posts").insert(row).select("*").single();
  if (error || !post) return NextResponse.json({ message: error?.message || "Could not create draft." }, { status: 500 });

  if (assetIds.length) {
    const links = assetIds.map((assetId: string, index: number) => ({
      post_id: post.id,
      asset_id: assetId,
      sort_order: index,
      role: index === 0 ? "primary" : "source",
    }));
    const { error: linkError } = await supabase.from("social_post_assets").insert(links);
    if (linkError) {
      await supabase.from("social_posts").delete().eq("id", post.id);
      return NextResponse.json({ message: linkError.message }, { status: 500 });
    }
  }

  await supabase.from("activity_log").insert({
    source: "Vibe OS",
    event_type: "social_post_created",
    summary: `${platform} draft created`,
    payload: { post_id: post.id, asset_count: assetIds.length }
  });

  return NextResponse.json({ message: "Draft created.", post });
}
