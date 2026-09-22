"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const FILTERS = [
  { key: "inbox", label: "Content Inbox" },
  { key: "working", label: "Agent Working" },
  { key: "used", label: "Used in Posts" },
  { key: "archived", label: "Archived" },
] as const;

function normalizedStatus(status?: string | null) {
  if (status === "ready" || status === "review") return "inbox";
  return status || "inbox";
}

function statusLabel(status?: string | null) {
  const value = normalizedStatus(status);
  return FILTERS.find((x) => x.key === value)?.label || value.replaceAll("_", " ");
}

export function ContentLibrary({ assets }: { assets: any[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("inbox");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const asset of assets) {
      const key = normalizedStatus(asset.status);
      result[key] = (result[key] || 0) + 1;
    }
    return result;
  }, [assets]);

  const visible = assets.filter((x) => normalizedStatus(x.status) === filter);

  async function updateStatus(id: string, status: string) {
    setBusy(id);
    setNotice("");
    try {
      const r = await fetch(`/api/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await r.json();
      setNotice(d.message || (r.ok ? "Updated." : "Could not update asset."));
      if (r.ok) router.refresh();
    } catch {
      setNotice("Could not update this asset right now.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteForever(id: string) {
    if (!window.confirm("Delete this raw asset permanently? This cannot be undone.")) return;
    setBusy(id);
    setNotice("");
    try {
      const r = await fetch(`/api/content/${id}`, { method: "DELETE" });
      const d = await r.json();
      setNotice(d.message || (r.ok ? "Deleted." : "Could not delete asset."));
      router.refresh();
    } catch {
      setNotice("Could not delete this asset right now.");
    } finally {
      setBusy(null);
    }
  }

  return <>
    <div className="libraryToolbar workflowToolbar">
      <div className="filterRow">
        {FILTERS.map((item) => <button key={item.key} className={`chip ${filter === item.key ? "active" : ""}`} onClick={() => setFilter(item.key)}>
          {item.label} <span>{counts[item.key] || 0}</span>
        </button>)}
      </div>
      <div className="libraryHint">Raw assets stay separate from finished social posts.</div>
    </div>
    {notice && <div className="inlineNotice">{notice}</div>}
    {visible.length ? <div className="assetGrid">
      {visible.map((x: any) => <div className="libraryCard" key={x.id}>
        <div className="assetImageWrap">
          {x.signedUrl && x.media_type?.startsWith("image/") ? <img src={x.signedUrl} alt="" /> : <div className="videoPlaceholder">{x.media_type?.startsWith("video/") ? "VIDEO" : "FILE"}</div>}
          <span className="previewLabel">{statusLabel(x.status)}</span>
        </div>
        <div className="libraryMeta">
          <small>RAW SOURCE</small>
          <b>{x.product_name || x.file_name}</b>
          <span>{x.media_type || "Asset"}</span>
          <div className="assetActions">
            {filter !== "archived" ? <button disabled={busy === x.id} onClick={() => updateStatus(x.id, "archived")}>Remove</button> : <>
              <button disabled={busy === x.id} onClick={() => updateStatus(x.id, "inbox")}>Restore</button>
              <button className="dangerText" disabled={busy === x.id} onClick={() => deleteForever(x.id)}>Delete forever</button>
            </>}
          </div>
        </div>
      </div>)}
    </div> : <div className="libraryEmpty">
      <b>{filter === "inbox" ? "Your Content Inbox is empty." : `Nothing in ${statusLabel(filter)}.`}</b>
      <p>{filter === "inbox" ? "Upload raw photos or video above. The Social Media Manager can select, edit, combine and turn them into finished posts." : "Assets will move here as the social workflow progresses."}</p>
    </div>}
  </>;
}