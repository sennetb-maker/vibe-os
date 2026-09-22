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

  const [{ count: linkedCount }, { count: legacyCount }] = await Promise.all([
    supabase.from("social_post_assets").select("post_id", { count: "exact", head: true }).eq("asset_id", id),
    supabase.from("social_posts").select("id", { count: "exact", head: true }).eq("asset_id", id),
  ]);
  if ((linkedCount || 0) + (legacyCount || 0) > 0) {
    await supabase.from("content_assets").update({ status: "archived", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ message: "This asset has post history, so it was archived instead of deleted." }, { status: 409 });
  }

  const { data: asset, error: readError } = await supabase.from("content_assets").select("id,file_name,storage_path").eq("id", id).single();
  if (readError || !asset) return NextResponse.json({ message: readError?.message || "Asset not found." }, { status: 404 });

  if (asset.storage_path) await supabase.storage.from(contentBucket()).remove([asset.storage_path]);
  const { error } = await supabase.from("content_assets").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await supabase.from("activity_log").insert({ source: "Vibe OS", event_type: "content_deleted", summary: `${asset.file_name} permanently deleted`, payload: { asset_id: id } });
  return NextResponse.json({ message: "Asset permanently deleted." });
}