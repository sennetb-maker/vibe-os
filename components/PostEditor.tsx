"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const TZ = "America/Chicago";

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function previewFilter(preset?: string | null) {
  switch (preset) {
    case "natural": return "brightness(1.01) saturate(.98)";
    case "warm_film": return "brightness(1.03) saturate(.88) sepia(.12)";
    case "direct_flash": return "brightness(1.08) contrast(1.08) saturate(.92)";
    case "rich_club": return "brightness(.99) contrast(1.06) saturate(.88)";
    case "muted_90s":
    default: return "brightness(1.02) contrast(1.03) saturate(.82)";
  }
}

export function PostEditor({ post, onClose }: { post: any; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<any>({});

  useEffect(() => {
    if (!post) return;
    setDraft({
      platform: post.platform || "Instagram",
      post_type: post.post_type || "image",
      scheduled_for: toLocalInput(post.scheduled_for),
      caption: post.caption || "",
      hashtags: post.hashtags || "",
      cta: post.cta || "",
      destination_url: post.destination_url || "",
      product_name: post.product_name || "",
      visual_preset: post.visual_preset || "muted_90s",
      crop_mode: post.crop_mode || "portrait",
      agent_notes: post.agent_notes || "",
    });
    setNotice("");
  }, [post]);

  const preview = useMemo(() => {
    return post?.renderedMedia?.[0]?.signedUrl || post?.renderedUrl || post?.sourceAssets?.[0]?.signedUrl || null;
  }, [post]);

  async function save(thenRender = false) {
    setBusy(true); setNotice("");
    try {
      const body = {
        ...draft,
        scheduled_for: draft.scheduled_for ? new Date(draft.scheduled_for).toISOString() : null,
      };
      const r = await fetch(`/api/social/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Could not save changes.");
      if (thenRender) {
        setRendering(true);
        const rr = await fetch(`/api/social/posts/${post.id}/render`, { method: "POST" });
        const rd = await rr.json();
        if (!rr.ok) throw new Error(rd.message || "Could not apply photo edit.");
        setNotice(rd.message || "Photo edit applied.");
      } else {
        setNotice("Draft saved.");
      }
      router.refresh();
    } catch (e: any) {
      setNotice(e?.message || "Could not save this draft.");
    } finally {
      setRendering(false);
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true); setNotice("");
    try {
      const r = await fetch(`/api/social/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scheduled", approved: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Could not approve post.");
      setNotice("Post approved and scheduled.");
      router.refresh();
      window.setTimeout(onClose, 350);
    } catch (e: any) {
      setNotice(e?.message || "Could not approve this post.");
    } finally { setBusy(false); }
  }

  if (!post) return null;

  return <div className="postEditorShell" role="dialog" aria-modal="true" aria-label="Edit social post">
    <div className="postEditorBackdrop" onClick={onClose} />
    <aside className="postEditor">
      <div className="postEditorHead">
        <div><small>DRAFT POST</small><h3>Edit before it goes live</h3></div>
        <button onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="postEditorPreview">
        {preview ? <img
          src={preview}
          alt=""
          style={post?.renderedMedia?.length || post?.renderedUrl ? undefined : { filter: previewFilter(draft.visual_preset) }}
        /> : <div className="postEditorNoPreview">No preview available</div>}
        <div className="postPreviewMeta"><span>{draft.platform}</span><span>{draft.post_type}</span><span>{post.render_status === "rendered" ? "Edited media ready" : "Preview treatment"}</span></div>
      </div>

      <div className="postEditorForm">
        <div className="fieldPair">
          <label><span>Platform</span><select value={draft.platform} onChange={(e)=>setDraft({...draft,platform:e.target.value})}>
            <option>Instagram</option><option>Facebook</option><option>TikTok</option>
          </select></label>
          <label><span>Post type</span><select value={draft.post_type} onChange={(e)=>setDraft({...draft,post_type:e.target.value})}>
            <option value="image">Image</option><option value="carousel">Carousel</option><option value="reel">Reel</option><option value="video">Video</option><option value="story">Story</option>
          </select></label>
        </div>

        <label><span>Scheduled for</span><input type="datetime-local" value={draft.scheduled_for} onChange={(e)=>setDraft({...draft,scheduled_for:e.target.value})}/></label>

        <label><span>Caption</span><textarea rows={5} value={draft.caption} onChange={(e)=>setDraft({...draft,caption:e.target.value})} placeholder="Write the post caption here." /></label>
        <label><span>Hashtags</span><input value={draft.hashtags} onChange={(e)=>setDraft({...draft,hashtags:e.target.value})} placeholder="#vibeandahalf #gameday" /></label>

        <div className="fieldPair">
          <label><span>CTA</span><input value={draft.cta} onChange={(e)=>setDraft({...draft,cta:e.target.value})} /></label>
          <label><span>Product</span><input value={draft.product_name} onChange={(e)=>setDraft({...draft,product_name:e.target.value})} placeholder="Optional" /></label>
        </div>

        <label><span>Destination URL</span><input value={draft.destination_url} onChange={(e)=>setDraft({...draft,destination_url:e.target.value})} /></label>

        <div className="photoTreatmentBox">
          <div><small>PHOTO EDIT</small><b>No text overlay — just photography treatment</b></div>
          <div className="fieldPair">
            <label><span>Look</span><select value={draft.visual_preset} onChange={(e)=>setDraft({...draft,visual_preset:e.target.value})}>
              <option value="natural">Natural</option>
              <option value="muted_90s">Muted 90s</option>
              <option value="warm_film">Warm film</option>
              <option value="direct_flash">Direct flash</option>
              <option value="rich_club">Rich club</option>
            </select></label>
            <label><span>Crop</span><select value={draft.crop_mode} onChange={(e)=>setDraft({...draft,crop_mode:e.target.value})}>
              <option value="portrait">Portrait feed</option><option value="square">Square</option><option value="original">Keep original</option>
            </select></label>
          </div>
          <label><span>Social Manager edit notes</span><textarea rows={3} value={draft.agent_notes} onChange={(e)=>setDraft({...draft,agent_notes:e.target.value})} /></label>
          <div className="sourceStrip">
            {(post.sourceAssets || []).map((a:any)=><div key={a.id}>{a.signedUrl ? <img src={a.signedUrl} alt="" /> : null}<small>{a.file_name}</small></div>)}
          </div>
        </div>

        {notice && <div className="inlineNotice">{notice}</div>}

        <div className="postEditorActions">
          <button className="secondary" disabled={busy} onClick={()=>save(false)}>Save draft</button>
          <button className="secondary" disabled={busy || rendering} onClick={()=>save(true)}>{rendering ? "Applying edit…" : "Save + apply photo edit"}</button>
          <button className="primary" disabled={busy} onClick={approve}>Approve & schedule</button>
        </div>
      </div>
    </aside>
  </div>;
}
