import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { AgentChat } from "@/components/AgentChat";
import { UploadBox } from "@/components/UploadBox";
import { ApprovalInbox } from "@/components/ApprovalInbox";
import { Icon } from "@/components/Icon";
import { getContentAssets, getContentInboxCount, getPendingApprovals, getRecentActivity, getSocialPosts, getStorePerformance } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

const actions = [
  {tone:"urgent", label:"Urgent", title:"Finish Instagram brand connection", detail:"Vibe & A Half Instagram is not exposed to Make yet.", href:"/social"},
  {tone:"today", label:"Today", title:"Add launch content to the library", detail:"Add raw photos and video. The Social Agent turns them into finished posts.", href:"/content"},
  {tone:"next", label:"Suggested", title:"Review first-week launch plan", detail:"Ask the CEO Agent to prioritize store, TikTok and paid-social launch work.", href:"#ceo-chat"}
];

const fallbackScheduled = [
  {day:"MON", date:"21", title:"Lifestyle / model", platform:"Instagram", state:"Draft"},
  {day:"WED", date:"23", title:"Product detail", platform:"Instagram + Facebook", state:"Draft"},
  {day:"SUN", date:"27", title:"Football culture", platform:"TikTok + Instagram", state:"Needs video"}
];

function money(n:number){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n)}
function dayParts(value?:string|null){
  if(!value) return null;
  const d=new Date(value);
  return {day:new Intl.DateTimeFormat("en-US",{weekday:"short",timeZone:"America/Chicago"}).format(d).toUpperCase(),date:new Intl.DateTimeFormat("en-US",{day:"2-digit",timeZone:"America/Chicago"}).format(d)};
}

export default async function Home(){
  const [metrics, assets, contentInbox, approvals, activity, posts] = await Promise.all([
    getStorePerformance(), getContentAssets(3), getContentInboxCount(), getPendingApprovals(5), getRecentActivity(5), getSocialPosts(3)
  ]);
  const scheduled = posts.length ? posts.map((p:any)=>{
    const dp=dayParts(p.scheduled_for)||{day:"—",date:"—"};
    return {day:dp.day,date:dp.date,title:p.caption?.slice(0,42)||"Scheduled post",platform:p.platform,state:p.status};
  }) : fallbackScheduled;

  return <><Topbar title="Command Center"/><div className="page dashboardPage">
    <section className="welcomeRow">
      <div><small>GOOD EVENING</small><h2>Here’s what needs your attention.</h2><p>Run the brand from one screen. Handle the exceptions; let the agents do the repetitive work.</p></div>
      <div className="systemBadge"><span className="statusDot"/>Systems online <b>8 active agents</b></div>
    </section>

    <section className="storeMetrics" aria-label="Store performance">
      <div className="metricCard featured"><div><span>Revenue</span><small>Today · {metrics.source==="live"?"Shopify live":"connection needed"}</small></div><strong>{money(metrics.revenue)}</strong><em>{metrics.orders ? `${metrics.orders} order${metrics.orders===1?"":"s"}` : "Pre-launch"}</em></div>
      <div className="metricCard"><span>Orders</span><strong>{metrics.orders}</strong><small>Today</small></div>
      <div className="metricCard"><span>AOV</span><strong>{metrics.aov==null?"—":money(metrics.aov)}</strong><small>{metrics.aov==null?"Awaiting orders":"Today"}</small></div>
      <div className="metricCard"><span>Conversion</span><strong>{metrics.conversion==null?"—":`${metrics.conversion.toFixed(1)}%`}</strong><small>{metrics.conversion==null?"Reporting access needed":"Today"}</small></div>
      <div className="metricCard"><span>Content inbox</span><strong>{contentInbox}</strong><small>Raw source assets</small></div>
    </section>

    <div className="dashboardGrid topGrid">
      <section className="panel actionPanel">
        <div className="panelHead"><div><small>YOUR DAY</small><h3>Suggested actions</h3></div><span className="countBadge">3</span></div>
        <div className="actionList">{actions.map((a,i)=><Link href={a.href} className="actionItem" key={i}><span className={`priorityDot ${a.tone}`}/><div><small>{a.label}</small><b>{a.title}</b><p>{a.detail}</p></div><Icon name="arrow" size={17}/></Link>)}</div>
      </section>

      <section className="panel approvalPanel">
        <div className="panelHead"><div><small>DECISIONS</small><h3>Approvals</h3></div><span className="countBadge muted">{approvals.length}</span></div>
        <ApprovalInbox initial={approvals}/>
      </section>
    </div>

    <section id="ceo-chat" className="ceoSection">
      <div className="sectionTitle"><div><small>MASTER CONTROL</small><h3>CEO Chat</h3></div><p>One conversation for the whole business. The CEO Agent can hand work to specialist agents.</p></div>
      <AgentChat fixedAgent="ceo" compact/>
    </section>

    <div className="dashboardGrid contentGrid">
      <section className="panel quickContent">
        <div className="panelHead"><div><small>CONTENT LIBRARY</small><h3>Feed the social engine</h3></div><Link href="/content">Open library</Link></div>
        <UploadBox compact/>
        {assets.length ? <div className="miniAssets">{assets.map((x:any)=><div key={x.id}>{x.signedUrl?<img src={x.signedUrl} alt=""/>:<div className="assetPlaceholder"/>}<span>{x.product_name||x.file_name}</span></div>)}</div> : <div className="miniEmpty">No source assets yet. Upload raw photos or video for the Social Media Manager.</div>}
      </section>

      <section className="panel scheduledPanel">
        <div className="panelHead"><div><small>SOCIAL CALENDAR</small><h3>Coming up</h3></div><Link href="/social">Full calendar</Link></div>
        <div className="scheduleList">{scheduled.map((s:any,i:number)=><div className="scheduleItem" key={i}><div className="dateTile"><small>{s.day}</small><b>{s.date}</b></div><div><b>{s.title}</b><span>{s.platform}</span></div><em className={String(s.state).toLowerCase().includes("need")?"warn":""}>{s.state}</em></div>)}</div>
      </section>
    </div>

    <div className="dashboardGrid bottomGrid">
      <section className="panel socialPerformance">
        <div className="panelHead"><div><small>ORGANIC PERFORMANCE</small><h3>Social at a glance</h3></div><span className="prelaunchTag">PRE-LAUNCH</span></div>
        <div className="channelRows">
          <div><span className="channelMark">IG</span><div><b>Instagram</b><small>Brand account connection required</small></div><strong>—</strong><em>Engagement</em></div>
          <div><span className="channelMark">TT</span><div><b>TikTok</b><small>Publishing connection pending</small></div><strong>—</strong><em>Views</em></div>
          <div><span className="channelMark">FB</span><div><b>Facebook</b><small>Vibe & a half Supply Co. connected</small></div><strong>0</strong><em>Posts this week</em></div>
        </div>
      </section>

      <section className="panel messagesPanel">
        <div className="panelHead"><div><small>AGENT ACTIVITY</small><h3>Recent work</h3></div><Link href="/agents">View team</Link></div>
        {activity.length ? <div className="activityList">{activity.map((a:any)=><div className="activityRow" key={a.id}><span className="statusDot"/><div><b>{a.source}</b><p>{a.summary}</p></div></div>)}</div> : <div className="inboxEmpty"><div className="roundIcon"><Icon name="message" size={20}/></div><b>No activity logged yet.</b><p>Agent chats, uploads and approval decisions will appear here automatically.</p></div>}
      </section>
    </div>
  </div></>
}