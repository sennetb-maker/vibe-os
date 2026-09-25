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
  const s = String(value || "working");
  if (s === "review" || s === "ready_for_approval") return "Ready for Approval";
  if (s === "working" || s === "draft") return "Agent Working";
  if (s === "scheduled") return "Scheduled";
  if (s === "approved") return "Approved";
  if (s === "published") return "Published";
  if (s === "failed") return "Needs Attention";
  return s.replaceAll("_", " ");
}

function isReview(p: any) { return p.status === "review" || p.status === "ready_for_approval"; }
function isWorking(p: any) { return p.status === "working" || p.status === "draft"; }

export function SocialPlanner({ posts }: { posts: any[] }) {
  const router = useRouter();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const days = useMemo(() => {
    const now = new Date();
    const y = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric" }).format(now));
    const m = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "numeric" }).format(now));
    const d = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "numeric" }).format(now));
    return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(y, m - 1, d + i, 18, 0, 0)));
  }, []);

  const dayKeys = new Set(days.map((d) => dateKey(d)));
  const reviewPosts = posts.filter((p) => isReview(p) && p.scheduled_for && dayKeys.has(dateKey(p.scheduled_for)));
  const working = posts.filter(isWorking).length;
  const scheduled = posts.filter((p) => p.status === "scheduled" || p.status === "approved").length;
  const published = posts.filter((p) => p.status === "published").length;

  async function generatePlan() {
    setBusy(true); setNotice("");
    try {
      const r = await fetch("/api/social/generate-plan", { method: "POST" });
      const d = await r.json();
      setNotice(d.message || (r.ok ? "7-day plan created." : "Could not create the social plan."));
      if (r.ok) router.refresh();
    } catch { setNotice("Could not reach the Social Media Manager right now."); }
    finally { setBusy(false); }
  }

  async function approveOne(id: string) {
    setBusy(true); setNotice("");
    try {
      const render = await fetch(`/api/social/posts/${id}/render`, { method: "POST" });
      const renderData = await render.json();
      if (!render.ok) throw new Error(renderData.message || "Could not prepare the edited media.");
      const r = await fetch(`/api/social/posts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "scheduled", approved: true }) });
      const d = await r.json(); setNotice(d.message || (r.ok ? "Post approved." : "Could not approve post."));
      if (r.ok) router.refresh();
    } catch { setNotice("Could not approve this post right now."); }
    finally { setBusy(false); }
  }

  async function approveSchedule() {
    if (!reviewPosts.length) return;
    setBusy(true); setNotice("");
    try {
      const rendered = await Promise.all(reviewPosts.map(async (p) => {
        const r = await fetch(`/api/social/posts/${p.id}/render`, { method: "POST" });
        const d = await r.json();
        return { ok: r.ok, message: d.message };
      }));
      const failed = rendered.filter((x) => !x.ok);
      if (failed.length) throw new Error(`${failed.length} post${failed.length === 1 ? "" : "s"} could not prepare edited media. Open those drafts and review them before approving the schedule.`);
      const r = await fetch("/api/social/approve-schedule", { method: "POST" });
      const d = await r.json(); setNotice(d.message || (r.ok ? "Schedule approved." : "Could not approve schedule."));
      if (r.ok) router.refresh();
    } catch { setNotice("Could not approve the schedule right now."); }
    finally { setBusy(false); }
  }

  const card = (p: any) => <div className={`calendarPost status-${String(p.status).replaceAll("_", "-")}`} key={p.id} role="button" tabIndex={0} onClick={() => setSelected(p)} onKeyDown={(e) => { if (e.key === "Enter") setSelected(p); }}>
    <div className="calendarPostTop"><span className={`platformPill platform-${String(p.platform).toLowerCase()}`}>{p.platform}</span><small>{postTime(p.scheduled_for)}</small></div>
    <b>{p.caption?.slice(0, 72) || p.product_name || "Social post in progress"}</b>
    <span>{p.post_type ? String(p.post_type).toUpperCase() : "POST"}{p.product_name ? ` · ${p.product_name}` : ""}</span>
    <em>{prettyStatus(p.status)}</em>
    {isReview(p) && <button className="miniApprove" disabled={busy} onClick={(e) => { e.stopPropagation(); approveOne(p.id); }}>Approve</button>}
  </div>;

  return <>
    <section className="socialWorkflowBar">
      <div><small>01</small><b>Content Inbox</b><span>Raw source assets</span></div>
      <div><small>02</small><b>Agent Working</b><span>{working} posts in production</span></div>
      <div className={reviewPosts.length ? "attention" : ""}><small>03</small><b>Ready for Approval</b><span>{reviewPosts.length} in next 7 days</span></div>
      <div><small>04</small><b>Scheduled</b><span>{scheduled} approved posts</span></div>
      <div><small>05</small><b>Published</b><span>{published} tracked posts</span></div>
    </section>

    <div className="plannerToolbar">
      <div className="viewToggle"><button className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}>7-day calendar</button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>List</button></div>
      <div className="plannerActions">
        <button className="generatePlan" disabled={busy} onClick={generatePlan}>{busy ? "Social Manager working…" : posts.length ? "Refresh 7-day plan" : "Build first 7-day plan"}</button>
        <button className="approveSchedule" disabled={!reviewPosts.length || busy} onClick={approveSchedule}>{reviewPosts.length ? `Approve 7-day schedule (${reviewPosts.length})` : "Nothing awaiting approval"}</button>
      </div>
    </div>
    {notice && <div className="inlineNotice">{notice}</div>}

    {view === "calendar" ? <div className="twoWeekCalendar">
      {days.map((day) => {
        const key = dateKey(day); const label = dayLabel(day); const dayPosts = posts.filter((p) => p.scheduled_for && dateKey(p.scheduled_for) === key);
        return <div className="calendarDay" key={key}><div className="calendarDayHead"><small>{label.dow}</small><b>{label.date}</b></div><div className="calendarDayBody">{dayPosts.length ? dayPosts.map(card) : <span className="emptyDay">Open</span>}</div></div>;
      })}
    </div> : <div className="plannerList">
      {posts.length ? posts.map((p) => <div className="plannerListRow" key={p.id} role="button" tabIndex={0} onClick={() => setSelected(p)} onKeyDown={(e) => { if (e.key === "Enter") setSelected(p); }}>
        <div className="plannerThumb">{p.renderedUrl ? <img src={p.renderedUrl} alt="" /> : p.sourceAssets?.[0]?.signedUrl ? <img src={p.sourceAssets[0].signedUrl} alt="" /> : <span>{String(p.platform || "P").slice(0, 2).toUpperCase()}</span>}</div>
        <div className="plannerWhen"><b>{p.scheduled_for ? new Date(p.scheduled_for).toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric" }) : "Date TBD"}</b><small>{postTime(p.scheduled_for)}</small></div>
        <div className="plannerCopy"><b>{p.caption || "Caption being written by Social Media Manager"}</b><span>{p.platform} · {p.post_type || "post"}{p.destination_url ? " · linked" : ""}</span></div>
        <em>{prettyStatus(p.status)}</em>
        {isReview(p) && <button className="miniApprove" disabled={busy} onClick={(e) => { e.stopPropagation(); approveOne(p.id); }}>Approve</button>}
      </div>) : <div className="libraryEmpty"><b>No social posts yet.</b><p>The Social Media Manager will create working drafts from your Content Inbox. Finished proposals will land here for approval with copy, destination links, platform and publish time.</p></div>}
    </div>}
    {selected && <PostEditor post={selected} onClose={() => setSelected(null)} />}
  </>;
}