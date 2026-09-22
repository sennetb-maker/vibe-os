import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function POST() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ message: "Supabase is not configured." }, { status: 503 });
  const now = new Date();
  const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const { data: candidates, error: readError } = await supabase.from("social_posts")
    .select("id")
    .in("status", ["review", "ready_for_approval"])
    .gte("scheduled_for", now.toISOString())
    .lt("scheduled_for", end.toISOString());
  if (readError) return NextResponse.json({ message: readError.message }, { status: 500 });
  const ids = (candidates || []).map((x: any) => x.id);
  if (!ids.length) return NextResponse.json({ message: "No proposed posts are waiting for approval in the next 14 days." });

  const approvedAt = new Date().toISOString();
  const { error } = await supabase.from("social_posts").update({ status: "scheduled", approved_at: approvedAt, updated_at: approvedAt }).in("id", ids);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  await supabase.from("activity_log").insert({ source: "Vibe OS", event_type: "social_schedule_approved", summary: `${ids.length} social post${ids.length === 1 ? "" : "s"} approved for the next 14 days`, payload: { post_ids: ids } });
  return NextResponse.json({ message: `Approved ${ids.length} post${ids.length === 1 ? "" : "s"} for the next 14 days.`, count: ids.length });
}