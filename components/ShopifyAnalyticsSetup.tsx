"use client";

import { useEffect, useState } from "react";

type Status = {
  configured?: boolean;
  shop?: string;
  clientId?: string;
  status?: {
    status?: string;
    scopes?: string[];
    verified_at?: string | null;
    details?: Record<string, any>;
  } | null;
};

export function ShopifyAnalyticsSetup() {
  const [state, setState] = useState<Status>({});
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/integrations/shopify", { cache: "no-store" });
      const data = await r.json();
      setState(data || {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const r = await fetch("/api/integrations/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientSecret: secret }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Connection failed.");
      setSecret("");
      setMessage("Connected. Live Shopify reporting is ready.");
      await refresh();
    } catch (e: any) {
      setMessage(e?.message || "Connection failed.");
    } finally {
      setSaving(false);
    }
  }

  const connected = state?.status?.status === "connected" && state.configured;

  return <div className="integrationSetup">
    <section className="panel integrationCard">
      <div className="integrationStatusRow">
        <div>
          <small>SHOPIFY ANALYTICS</small>
          <h3>Vibe OS Analytics</h3>
          <p>{state.shop ? `${state.shop}.myshopify.com` : "Loading store…"}</p>
        </div>
        <span className={`integrationBadge ${connected ? "connected" : "pending"}`}>
          {loading ? "Checking…" : connected ? "Connected" : "Needs secret"}
        </span>
      </div>

      {connected ? <div className="integrationConnected">
        <div><b>Reporting access is live.</b><p>Vibe OS can refresh sessions, visitors, pageviews and conversion directly from Shopify.</p></div>
        <div className="scopeChips">{(state.status?.scopes || []).map((scope)=><span key={scope}>{scope}</span>)}</div>
      </div> : <form onSubmit={connect} className="integrationForm">
        <div className="integrationExplainer">
          <b>One secure step left.</b>
          <p>Paste the <strong>Client Secret</strong> from the Shopify Vibe OS Analytics app. It is sent only to the Vibe OS server, verified against Shopify, and stored encrypted in Supabase Vault. It is never written to GitHub or displayed again.</p>
        </div>
        <label>
          <span>Client Secret</span>
          <input
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(e)=>setSecret(e.target.value)}
            placeholder="Paste Shopify client secret"
          />
        </label>
        <div className="integrationMeta">
          <span>Client ID</span><code>{state.clientId || "Loading…"}</code>
        </div>
        <button className="primary" type="submit" disabled={saving || !secret.trim()}>
          {saving ? "Verifying…" : "Connect Shopify Analytics"}
        </button>
      </form>}

      {message && <div className={`integrationMessage ${message.startsWith("Connected") ? "success" : "error"}`}>{message}</div>}
    </section>
  </div>;
}
