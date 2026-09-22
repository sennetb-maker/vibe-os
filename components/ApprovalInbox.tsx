"use client";
import { useState } from "react";
import { Icon } from "./Icon";

export function ApprovalInbox({ initial }: { initial: any[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  async function resolve(id: string, status: "approved" | "declined") {
    setBusy(id);
    try {
      const r = await fetch("/api/approvals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      if (r.ok) setItems((v) => v.filter((x) => x.id !== id));
    } finally { setBusy(null); }
  }
  if (!items.length) return <div className="inboxEmpty compactEmpty"><div className="roundIcon"><Icon name="check" size={18}/></div><b>No approvals waiting.</b><p>Agent requests that need an owner decision will appear here.</p></div>;
  return <div className="approvalList">{items.map((a) => {
    const payload = a.payload || {};
    return <div className="approvalItem approvalLive" key={a.id}><div className="approvalIcon"><Icon name="approval" size={18}/></div><div><b>{payload.title || a.action_type}</b><span>{payload.detail || payload.meta || "Owner decision requested"}</span><div className="approvalButtons"><button disabled={busy === a.id} onClick={() => resolve(a.id, "approved")}>Approve</button><button disabled={busy === a.id} onClick={() => resolve(a.id, "declined")}>Decline</button></div></div></div>;
  })}</div>;
}