import { Topbar } from "@/components/Topbar";
import { Icon } from "@/components/Icon";
import { SocialPlanner } from "@/components/SocialPlanner";
import { getContentAssets, getSocialPosts } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Social(){
  const [posts, assets]=await Promise.all([getSocialPosts(120), getContentAssets(120)]);
  return <><Topbar title="Social"/><div className="page"><div className="socialTop"><div className="sectionIntro"><small>ORGANIC SOCIAL</small><h2>Plan, draft, schedule and track your social content.</h2><p>Use the planner like a lightweight Meta Business Suite: create posts manually, build draft options with AI, review the week, schedule approved posts and keep published history separate.</p></div><div className="connectionStack"><div><span className="dot ok"/>Facebook <b>Vibe & A Half (Austin)</b></div><div><span className="dot ok"/>Instagram <b>@vibe_and_ahalf</b></div><div><span className="dot warn"/>TikTok <b>Manual posting for now</b></div></div></div>
  <SocialPlanner posts={posts} assets={assets}/>
  <section className="panel communityPanel"><div className="panelHead"><div><small>COMMUNITY</small><h3>Needs attention</h3></div></div><div className="inboxEmpty"><div className="roundIcon"><Icon name="check" size={20}/></div><b>No comments need you right now.</b><p>Low-risk replies can be automated. Refunds, complaints and uncertain responses will be escalated here.</p></div></section></div></>}