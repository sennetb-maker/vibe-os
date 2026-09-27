"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const FILTERS = [
  { key: "inbox", label: "All content" },
  { key: "used", label: "In scheduled posts" },
  { key: "archived", label: "Archived" },
] as const;

function normalizedStatus(status?: string | null) {
  if (!status || ["ready","review","working"].includes(status)) return "inbox";
  return status;
}

export function ContentLibrary({ assets }: { assets: any[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("inbox");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const counts = useMemo(() => {
    const result: Record<string, number> = { inbox: 0, used: 0, archived: 0 };
    for (const asset of assets) {
      const key = normalizedStatus(asset.status);
      if (key === "archived") result.archived++;
      else if (key === "used") result.used++;
      else result.inbox++;
    }
    return result;
  }, [assets]);

  const visible = assets.filter((x) => {
    const status = normalizedStatus(x.status);
    if (filter === "inbox") return status !== "archived" && status !== "used";
    return status === filter;
  });

  async function archive(id: string) {
    setBusy(id); setNotice("");
    try {
      const r = await fetch(`/api/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const d = await r.json();
      setNotice(d.message || (r.ok ? "Archived." : "Could not archive asset."));
      if (r.ok) router.refresh();
    } finally { setBusy(null); }
  }

  async function restore(id: string) {
    setBusy(id); setNotice("");
    try {
      const r = await fetch(`/api/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "inbox" }),
      });
      const d = await r.json();
      setNotice(d.message || (r.ok ? "Restored." : "Could not restore asset."));
      if (r.ok) router.refresh();
    } finally { setBusy(null); }
  }

  async function deleteForever(id: string) {
    if (!window.confirm("Delete this content permanently? Any unscheduled draft that depends on it will also be removed.")) return;
    setBusy(id); setNotice("");
    try {
      const r = await fetch(`/api/content/${id}`, { method: "DELETE" });
      const d = await r.json();
      setNotice(d.message || (r.ok ? "Deleted." : "Could not delete asset."));
      if (r.ok) router.refresh();
    } catch {
      setNotice("Could not delete this asset right now.");
    } finally { setBusy(null); }
  }

  return <>
    <div className="libraryToolbar workflowToolbar">
      <div className="filterRow">
        {FILTERS.map((item) => <button key={item.key} className={`chip ${filter === item.key ? "active" : ""}`} onClick={() => setFilter(item.key)}>
          {item.label} <span>{counts[item.key] || 0}</span>
        </button>)}
      </div>
      <div className="libraryHint">Draft proposals do not move or consume your source content.</div>
    </div>

    {notice && <div className="inlineNotice">{notice}</div>}

    {visible.length ? <div className="assetGrid">
      {visible.map((x: any) => <div className="libraryCard" key={x.id}>
        <div className="assetImageWrap">
          {x.signedUrl && x.media_type?.startsWith("image/") ? <img src={x.signedUrl} alt="" /> : <div className="videoPlaceholder">{x.media_type?.startsWith("video/") ? "VIDEO" : "FILE"}</div>}
          <span className="previewLabel">{normalizedStatus(x.status) === "used" ? "Scheduled use" : normalizedStatus(x.status) === "archived" ? "Archived" : "Available"}</span>
        </div>
        <div className="libraryMeta">
          <small>SOURCE CONTENT</small>
          <b>{x.product_name || x.file_name}</b>
          <span>{x.media_type || "Asset"}</span>
          <div className="assetActions">
            {filter === "archived" ? <>
              <button disabled={busy === x.id} onClick={() => restore(x.id)}>Restore</button>
              <button className="dangerText" disabled={busy === x.id} onClick={() => deleteForever(x.id)}>Delete forever</button>
            </> : <>
              <button disabled={busy === x.id} onClick={() => archive(x.id)}>Archive</button>
              <button className="dangerText" disabled={busy === x.id} onClick={() => deleteForever(x.id)}>Delete</button>
            </>}
          </div>
        </div>
      </div>)}
    </div> : <div className="libraryEmpty">
      <b>{filter === "inbox" ? "No available content yet." : filter === "used" ? "Nothing is currently tied to scheduled posts." : "Archive is empty."}</b>
      <p>{filter === "inbox" ? "Upload photos or video above. They stay available until a post is actually scheduled." : "Content will appear here automatically when its status changes."}</p>
    </div>}
  </>;
}
