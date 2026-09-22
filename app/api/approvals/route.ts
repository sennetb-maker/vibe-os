import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ approvals: [] });
  const { data, error } = await supabase.from("approvals").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ approvals: data || [] });
}

export async function PATCH(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { id, status } = await req.json();
  if (!id || !["approved", "declined", "pending"].includes(status)) return NextResponse.json({ error: "Invalid approval update." }, { status: 400 });
  const { data, error } = await supabase.from("approvals").update({ status, resolved_at: status === "pending" ? null : new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("activity_log").insert({ source: "Owner", event_type: `approval_${status}`, summary: `${data.action_type} ${status}`, payload: { approval_id: id } });
  return NextResponse.json({ approval: data });
}