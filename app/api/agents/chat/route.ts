import { NextResponse } from "next/server";
import { agents } from "@/lib/agents";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agent = url.searchParams.get("agent") || "ceo";
  const selected = agents.find((a) => a.id === agent);
  if (!selected) return NextResponse.json({ error: "Unknown agent" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ messages: [] });
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,agent_id,role,content,created_at")
    .eq("agent_id", agent)
    .order("created_at", { ascending: true })
    .limit(60);
  if (error) return NextResponse.json({ messages: [] });
  return NextResponse.json({ messages: data || [] });
}

export async function POST(req: Request) {
  const { agent, message } = await req.json();
  const selected = agents.find((a) => a.id === agent);
  if (!selected || !message?.trim()) return NextResponse.json({ error: "Missing agent or message" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const cleanMessage = String(message).trim();
  if (supabase) {
    await supabase.from("chat_messages").insert({ agent_id: agent, role: "user", content: cleanMessage });
    await supabase.from("activity_log").insert({ source: selected.name, event_type: "chat_requested", summary: cleanMessage.slice(0, 180) });
  }

  const gateway = process.env.MAKE_AGENT_GATEWAY_URL;
  if (!gateway) {
    const response = `${selected.name} is registered, but MAKE_AGENT_GATEWAY_URL is not configured in this deployment.`;
    return NextResponse.json({ response }, { status: 503 });
  }

  try {
    const r = await fetch(gateway, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: selected.id, scenarioId: selected.scenarioId, message: cleanMessage }),
      cache: "no-store",
    });
    const text = await r.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { response: text }; }
    const response = String(data?.response ?? data?.result ?? text ?? "No response returned.");
    if (!r.ok) throw new Error(response || `Make returned ${r.status}`);
    if (supabase) {
      await supabase.from("chat_messages").insert({ agent_id: agent, role: "assistant", content: response });
      await supabase.from("activity_log").insert({ source: selected.name, event_type: "chat_completed", summary: response.slice(0, 180) });
    }
    return NextResponse.json({ response });
  } catch (e: any) {
    if (supabase) await supabase.from("activity_log").insert({ source: selected.name, event_type: "chat_error", summary: e?.message || "Agent gateway error" });
    return NextResponse.json({ response: "The Make agent gateway did not return a usable response.", error: e?.message }, { status: 502 });
  }
}