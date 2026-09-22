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
  if (body?.approved || status === "approved" || status === "scheduled") patch.approved_at = new Date().toISOString();

  const { data, error } = await supabase.from("social_posts").update(patch).eq("id", id).select("id,platform,status,scheduled_for").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  await supabase.from("activity_log").insert({ source: "Vibe OS", event_type: "social_post_updated", summary: `${data.platform} post moved to ${data.status}`, payload: { post_id: id, status: data.status } });
  return NextResponse.json({ message: status === "scheduled" ? "Post approved and scheduled." : "Post updated.", post: data });
}