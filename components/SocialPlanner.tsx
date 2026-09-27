"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PostEditor } from "@/components/PostEditor";

const TZ = "America/Chicago";

function dateKey(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function centralToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), 18, 0, 0));
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000);
}

function dayLabel(value: Date) {
  return {
    dow: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ }).format(value).toUpperCase(),
    date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: TZ }).format(value),
  };
}

function postTime(value?: string | null) {
  if (!value) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(value));
}

function prettyStatus(value?: string | null) {
  const s = String(value || "review");
  if (s === "review" || s === "ready_for_approval") return "Draft";
  if (s === "working" || s === "draft") return "Draft";
  if (s === "scheduled" || s === "approved") return "Scheduled";
  if (s === "published") return "Published";
  if (s === "failed") return "Needs attention";
  return s.replaceAll("_", " ");
}

function bucket(p: any) {
  if (p.status === "published") return "published";
  if (p.status === "scheduled" || p.status === "approved") return "scheduled";
  return "drafts";
}

function thumb(p: any) {
  return p?.renderedMedia?.[0]?.signedUrl || p?.renderedUrl || p?.sourceAssets?.[0]?.signedUrl || null;
}

function toLocalInput(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function SocialPlanner({ posts, assets }: { posts: any[]; assets: any[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"planner" | "drafts" | "scheduled" | "published">("planner");
  const [view, setView] = useState<"week" | "list">("week");
  const [platform, setPlatform] = useState("All");
  const [weekOffset, setWeekOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    platform: "Instagram",
    post_type: "image",
    scheduled_for: toLocalInput(addDays(new Date(), 1)),
    caption: "",
    asset_ids: [] as string[],
  });

  const start = useMemo(() => addDays(centralToday(), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const dayKeys = useMemo(() => new Set(days.map(dateKey)), [days]);

  const counts = useMemo(() => ({
    drafts: posts.filter((p) => bucket(p) === "drafts").length,
    scheduled: posts.filter((p) => bucket(p) === "scheduled").length,
    published: posts.filter((p) => bucket(p) === "published").length,
  }), [posts]);

  const filtered = posts.filter((p) => {
    if (platform !== "All" && p.platform !== platform) return false;
    if (tab === "planner") return true;
    return bucket(p) === tab;
  });

  const weekPosts = filtered.filter((p) => p.scheduled_for && dayKeys.has(dateKey(p.scheduled_for)));
  const reviewPosts = posts.filter((p) => bucket(p) === "drafts" && p.scheduled_for && dayKeys.has(dateKey(p.scheduled_for)));

  async function generatePlan() {
    setBusy(true); setNotice("");
    try {
      const r = await fetch("/api/social/generate-plan", { method: "POST" });
      const d = await r.json();
      setNotice(d.message || (r.ok ? "Plan created." : "Could not build plan."));
      if (r.ok) { setTab("drafts"); router.refresh(); }
    } catch { setNotice("Could not reach the Social Media Manager."); }
    finally { setBusy(false); }
  }

  async function approveOne(id: string) {
    setBusy(true); setNotice("");
    try {
      const render = await fetch(`/api/social/posts/${id}/render`, { method: "POST" });
      if (!render.ok) {
        const d = await render.json().catch(() => ({}));
        throw new Error(d.message || "Could not prepare media.");
      }
      const r = await fetch(`/api/social/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scheduled", approved: true })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Could not schedule post.");
      setNotice("Post approved and scheduled.");
      router.refresh();
    } catch (e: any) { setNotice(e?.message || "Could not schedule this post."); }
    finally { setBusy(false); }
  }

  async function approveWeek() {
    if (!reviewPosts.length) return;
    setBusy(true); setNotice("");
    try {
      for (const p of reviewPosts) {
        const render = await fetch(`/api/social/posts/${p.id}/render`, { method: "POST" });
        if (!render.ok) throw new Error("One or more drafts could not prepare media.");
      }
      const r = await fetch("/api/social/approve-schedule", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Could not approve schedule.");
      setNotice(d.message || "Week approved.");
      setTab("scheduled");
      router.refresh();
    } catch (e: any) { setNotice(e?.message || "Could not approve this week."); }
    finally { setBusy(false); }
  }

  async function deletePost(id: string) {
    if (!window.confirm("Delete this draft?")) return;
    setBusy(true); setNotice("");
    try {
      const r = await fetch(`/api/social/posts/${id}`, { method: "DELETE" });
      const d = await r.json();
      setNotice(d.message || (r.ok ? "Draft deleted." : "Could not delete draft."));
      if (r.ok) { setSelected(null); router.refresh(); }
    } finally { setBusy(false); }
  }

  async function createPost() {
    if (!draft.caption.trim() && !draft.asset_ids.length) {
      setNotice("Add a caption or select media first.");
      return;
    }
    setBusy(true); setNotice("");
    try {
      const r = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          scheduled_for: draft.scheduled_for ? new Date(draft.scheduled_for).toISOString() : null,
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Could not create draft.");
      setCreating(false);
      setTab("drafts");
      setNotice("Draft created.");
      setDraft({ platform: "Instagram", post_type: "image", scheduled_for: toLocalInput(addDays(new Date(), 1)), caption: "", asset_ids: [] });
      router.refresh();
    } catch (e: any) { setNotice(e?.message || "Could not create draft."); }
    finally { setBusy(false); }
  }

  function toggleAsset(id: string) {
    setDraft((current) => ({
      ...current,
      asset_ids: current.asset_ids.includes(id)
        ? current.asset_ids.filter((x) => x !== id)
        : [...current.asset_ids, id].slice(0, 6)
    }));
  }

  const card = (p: any) => {
    const image = thumb(p);
    return <article className={`metaPostCard status-${String(p.status).replaceAll("_", "-")}`} key={p.id} onClick={() => setSelected(p)}>
      <div className="metaPostVisual">{image ? <img src={image} alt="" /> : <span>{String(p.platform || "P").slice(0, 2).toUpperCase()}</span>}</div>
      <div className="metaPostBody">
        <div className="metaPostTop"><span className={`platformPill platform-${String(p.platform).toLowerCase()}`}>{p.platform}</span><small>{postTime(p.scheduled_for)}</small></div>
        <b>{p.caption?.slice(0, 86) || p.product_name || "Untitled social draft"}</b>
        <span>{String(p.post_type || "post").toUpperCase()} · {prettyStatus(p.status)}</span>
        <div className="metaPostActions">
          {bucket(p) === "drafts" && <button disabled={busy} onClick={(e) => { e.stopPropagation(); approveOne(p.id); }}>Schedule</button>}
          {bucket(p) !== "published" && <button className="quietDanger" disabled={busy} onClick={(e) => { e.stopPropagation(); deletePost(p.id); }}>Delete</button>}
        </div>
      </div>
    </article>;
  };

  return <>
    <section className="metaPlannerShell">
      <div className="metaPlannerHeader">
        <div>
          <small>PLANNER & SCHEDULER</small>
          <h2>Plan and manage every social post in one place.</h2>
          <p>Drafts are drafts. Content is only marked used after you approve and schedule it.</p>
        </div>
        <div className="metaPrimaryActions">
          <button className="secondaryAction" disabled={busy} onClick={generatePlan}>{busy ? "Working…" : "Build with AI"}</button>
          <button className="primaryAction" onClick={() => setCreating(true)}>+ Create post</button>
        </div>
      </div>

      <nav className="metaPlannerTabs">
        <button className={tab === "planner" ? "active" : ""} onClick={() => setTab("planner")}>Planner</button>
        <button className={tab === "drafts" ? "active" : ""} onClick={() => setTab("drafts")}>Drafts <span>{counts.drafts}</span></button>
        <button className={tab === "scheduled" ? "active" : ""} onClick={() => setTab("scheduled")}>Scheduled <span>{counts.scheduled}</span></button>
        <button className={tab === "published" ? "active" : ""} onClick={() => setTab("published")}>Published <span>{counts.published}</span></button>
      </nav>

      <div className="metaPlannerToolbar">
        <div className="plannerDateNav">
          <button onClick={() => setWeekOffset((x) => x - 1)}>‹</button>
          <button onClick={() => setWeekOffset(0)}>Today</button>
          <button onClick={() => setWeekOffset((x) => x + 1)}>›</button>
          <b>{dayLabel(days[0]).date} – {dayLabel(days[6]).date}</b>
        </div>
        <div className="plannerFilters">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option>All</option><option>Instagram</option><option>Facebook</option><option>TikTok</option>
          </select>
          <div className="viewToggle">
            <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Week</button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>List</button>
          </div>
          {reviewPosts.length > 0 && <button className="approveSchedule" disabled={busy} onClick={approveWeek}>Schedule week ({reviewPosts.length})</button>}
        </div>
      </div>

      {notice && <div className="inlineNotice">{notice}</div>}

      {view === "week" ? <div className="metaWeekGrid">
        {days.map((day) => {
          const key = dateKey(day);
          const label = dayLabel(day);
          const dayPosts = weekPosts.filter((p) => dateKey(p.scheduled_for) === key);
          return <div className="metaDay" key={key}>
            <div className="metaDayHead"><small>{label.dow}</small><b>{label.date}</b></div>
            <div className="metaDayBody">{dayPosts.length ? dayPosts.map(card) : <button className="emptySlot" onClick={() => {
              setDraft((d) => ({ ...d, scheduled_for: toLocalInput(day) }));
              setCreating(true);
            }}>+ Add post</button>}</div>
          </div>;
        })}
      </div> : <div className="metaList">
        {filtered.length ? filtered.map(card) : <div className="libraryEmpty"><b>No posts here yet.</b><p>Create a post or let the Social Media Manager build draft options from your Content Library.</p></div>}
      </div>}
    </section>

    {creating && <div className="composerShell" role="dialog" aria-modal="true" aria-label="Create social post">
      <div className="postEditorBackdrop" onClick={() => setCreating(false)} />
      <aside className="composerPanel">
        <div className="postEditorHead"><div><small>CREATE POST</small><h3>New social draft</h3></div><button onClick={() => setCreating(false)}>×</button></div>
        <div className="composerFields">
          <div className="fieldPair">
            <label><span>Platform</span><select value={draft.platform} onChange={(e) => setDraft({...draft, platform:e.target.value})}><option>Instagram</option><option>Facebook</option><option>TikTok</option></select></label>
            <label><span>Format</span><select value={draft.post_type} onChange={(e) => setDraft({...draft, post_type:e.target.value})}><option value="image">Image</option><option value="carousel">Carousel</option><option value="reel">Reel</option><option value="video">Video</option><option value="story">Story</option></select></label>
          </div>
          <label><span>Date & time</span><input type="datetime-local" value={draft.scheduled_for} onChange={(e) => setDraft({...draft, scheduled_for:e.target.value})}/></label>
          <label><span>Caption</span><textarea rows={5} value={draft.caption} onChange={(e) => setDraft({...draft, caption:e.target.value})} placeholder="Write your caption..." /></label>
          <div><span className="fieldTitle">Media <small>{draft.asset_ids.length}/6 selected</small></span>
            <div className="composerAssets">
              {assets.filter((a) => a.status !== "archived").map((a) => <button key={a.id} className={draft.asset_ids.includes(a.id) ? "selected" : ""} onClick={() => toggleAsset(a.id)}>
                {a.signedUrl && a.media_type?.startsWith("image/") ? <img src={a.signedUrl} alt="" /> : <span>{a.media_type?.startsWith("video/") ? "VIDEO" : "FILE"}</span>}
              </button>)}
            </div>
          </div>
          <div className="composerFooter"><button className="secondaryAction" onClick={() => setCreating(false)}>Cancel</button><button className="primaryAction" disabled={busy} onClick={createPost}>{busy ? "Saving…" : "Save draft"}</button></div>
        </div>
      </aside>
    </div>}

    {selected && <PostEditor post={selected} onClose={() => setSelected(null)} />}
  </>;
}
