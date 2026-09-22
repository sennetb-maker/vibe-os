import { Topbar } from "@/components/Topbar";
import { AgentChat } from "@/components/AgentChat";
import { agents } from "@/lib/agents";
import { getRecentActivity } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Agents(){
  const activity=await getRecentActivity(12);
  return <><Topbar title="AI Team"/><div className="page"><div className="agentsLayout"><section><div className="sectionIntro compactIntro"><small>SPECIALISTS</small><h2>Your operating team.</h2><p>Use the CEO Agent as your master conversation. Open a specialist when you want to work directly on one function.</p></div><div className="agentCards">{agents.map(a=><div className="agentCard" key={a.id}><div className="agentAvatar large">{a.name.slice(0,2).toUpperCase()}</div><div><h3>{a.name}</h3><p>{a.purpose}</p><span>{a.status==="active"?`Make #${a.scenarioId} verified`:(a.status==="paused"?"Intentionally paused":"Setup required")}</span></div><em className={`pill ${a.status}`}>{a.status}</em></div>)}</div>{activity.length>0&&<section className="panel agentActivity"><div className="panelHead"><div><small>ACTIVITY LOG</small><h3>Recent agent work</h3></div></div><div className="activityList">{activity.map((a:any)=><div className="activityRow" key={a.id}><span className="statusDot"/><div><b>{a.source}</b><p>{a.summary}</p></div><small>{new Date(a.created_at).toLocaleString("en-US",{timeZone:"America/Chicago",dateStyle:"short",timeStyle:"short"})}</small></div>)}</div></section>}</section><aside><AgentChat/></aside></div></div></>}