"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { agents } from "@/lib/agents";
import { Icon } from "./Icon";

type ChatMessage = { role: "me" | "agent"; text: string };
const starter: ChatMessage = { role: "agent", text: "I’m your front door to the business. Ask what needs attention, how the store is performing, or tell me what you want the team to do next." };

function normalizeAgentText(text: string) {
  const cleaned = String(text || "").replace(/\r/g, "").trim();
  if ((cleaned.match(/\n/g) || []).length >= 2) return cleaned;

  const sectionLabels = [
    "CEO STATUS:",
    "EXECUTIVE SNAPSHOT:",
    "TOP PRIORITIES:",
    "RISKS / BLOCKERS:",
    "OWNER DECISIONS:",
    "NEXT 7 DAYS:",
  ];

  let formatted = cleaned;
  for (const label of sectionLabels) {
    formatted = formatted.replaceAll(label, `\n\n## ${label.replace(/:$/, "")}`);
  }
  formatted = formatted.replace(/\s+-\s+/g, "\n- ");
  formatted = formatted.replace(/\s+(\d+[.)])\s+/g, "\n$1 ");
  return formatted.trim();
}

function inlineFormat(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function AgentMessage({ text }: { text: string }) {
  const lines = normalizeAgentText(text).split("\n");

  return <div className="agentMessage">
    {lines.map((raw, index) => {
      const line = raw.trim();
      if (!line) return <div className="agentSpacer" key={index} />;
      if (line.startsWith("## ")) return <h4 key={index}>{line.slice(3)}</h4>;
      if (/^[-•]\s+/.test(line)) return <div className="agentBullet" key={index}><span>•</span><p>{inlineFormat(line.replace(/^[-•]\s+/, ""))}</p></div>;
      const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
      if (numbered) return <div className="agentNumber" key={index}><span>{numbered[1]}</span><p>{inlineFormat(numbered[2])}</p></div>;
      return <p key={index}>{inlineFormat(line)}</p>;
    })}
  </div>;
}

export function AgentChat({ fixedAgent, compact = false }: { fixedAgent?: string; compact?: boolean }) {
  const [agent, setAgent] = useState(fixedAgent || "ceo");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([starter]);
  const [loading, setLoading] = useState(false);
  const selected = useMemo(() => agents.find((a) => a.id === agent) || agents[0], [agent]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/agents/chat?agent=${encodeURIComponent(agent)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !Array.isArray(d.messages) || !d.messages.length) return;
        setMessages(d.messages.map((m: any) => ({ role: m.role === "user" ? "me" : "agent", text: m.content })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [agent]);

  async function send(prefill?: string) {
    const m = (prefill ?? message).trim();
    if (!m || loading) return;
    setMessages((v) => [...v, { role: "me", text: m }]);
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/agents/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent, message: m }) });
      const data = await res.json();
      setMessages((v) => [...v, { role: "agent", text: data.response || data.error || "No response returned." }]);
    } catch {
      setMessages((v) => [...v, { role: "agent", text: "The agent gateway did not return a response." }]);
    } finally { setLoading(false); }
  }

  return <div className={`chatShell ${compact ? "compact" : ""}`}>
    <div className="chatHeader"><div><small>{fixedAgent ? "MASTER CHAT" : "Chatting with"}</small><b>{selected.name}</b></div>{!fixedAgent && <select value={agent} onChange={(e) => { setAgent(e.target.value); setMessages([starter]); }}>{agents.filter(a => a.status !== "paused").map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}</select>}<span className="online"><i/>Online</span></div>
    {compact && <div className="promptRow"><button onClick={() => send("What needs my attention today?")}>What needs me?</button><button onClick={() => send("Give me a quick store and social performance summary.")}>Performance</button><button onClick={() => send("What should we do next to grow revenue?")}>Next move</button></div>}
    <div className="chatBody">{messages.map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.role === "agent" ? <AgentMessage text={m.text} /> : m.text}</div>)}{loading && <div className="bubble agent"><div className="agentMessage"><p>Working…</p></div></div>}</div>
    <div className="chatComposer"><textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask the CEO Agent anything…"/><button onClick={() => send()} aria-label="Send"><Icon name="arrow" size={18}/></button></div>
  </div>;
}