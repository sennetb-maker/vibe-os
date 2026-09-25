import { Topbar } from "@/components/Topbar";
import { Icon } from "@/components/Icon";
import { SocialPlanner } from "@/components/SocialPlanner";
import { getSocialPosts } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Social(){
  const posts=await getSocialPosts(120);
  return <><Topbar title="Social"/><div className="page"><div className="socialTop"><div className="sectionIntro"><small>ORGANIC SOCIAL</small><h2>Your rolling 7-day social plan.</h2><p>Upload raw content and the Content Director turns it into the right weekly mix of carousels, stills, Stories and real-video Reels/TikToks. It checks recent Instagram posts, rotates products/models/settings and sends the 7-day plan here for approval.</p></div><div className="connectionStack"><div><span className="dot ok"/>Facebook <b>Vibe & A Half (Austin)</b></div><div><span className="dot ok"/>Instagram <b>@vibe_and_ahalf</b></div><div><span className="dot warn"/>TikTok <b>Manual posting for now</b></div></div></div>
  <SocialPlanner posts={posts}/>
  <section className="panel communityPanel"><div className="panelHead"><div><small>COMMUNITY</small><h3>Needs attention</h3></div></div><div className="inboxEmpty"><div className="roundIcon"><Icon name="check" size={20}/></div><b>No comments need you right now.</b><p>Low-risk replies can be automated. Refunds, complaints and uncertain responses will be escalated here.</p></div></section></div></>}