import { Topbar } from "@/components/Topbar";
import { Icon } from "@/components/Icon";
import { SocialPlanner } from "@/components/SocialPlanner";
import { getSocialPosts } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Social(){
  const posts=await getSocialPosts(120);
  return <><Topbar title="Social"/><div className="page"><div className="socialTop"><div className="sectionIntro"><small>ORGANIC SOCIAL</small><h2>Your rolling two-week social plan.</h2><p>The Social Media Manager turns raw library assets into finished posts with platform-specific copy, creative treatment, product links and publish times. You approve the plan; the publishing layer handles the rest once every brand channel is connected.</p></div><div className="connectionStack"><div><span className="dot ok"/>Facebook <b>Connected</b></div><div><span className="dot warn"/>Instagram <b>Needs brand link</b></div><div><span className="dot warn"/>TikTok <b>Publishing pending</b></div></div></div>
  <SocialPlanner posts={posts}/>
  <section className="panel communityPanel"><div className="panelHead"><div><small>COMMUNITY</small><h3>Needs attention</h3></div></div><div className="inboxEmpty"><div className="roundIcon"><Icon name="check" size={20}/></div><b>No comments need you right now.</b><p>Low-risk replies can be automated. Refunds, complaints and uncertain responses will be escalated here.</p></div></section></div></>}