import { Topbar } from "@/components/Topbar";
import { UploadBox } from "@/components/UploadBox";
import { ContentLibrary } from "@/components/ContentLibrary";
import { getContentAssets } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Content(){
  const assets=await getContentAssets(120);
  return <><Topbar title="Content Library"/><div className="page"><div className="sectionIntro compactIntro"><small>SOURCE CONTENT</small><h2>Upload the raw material. The agents build the week.</h2><p>Photos and videos here are raw creative inventory — not finished posts. Upload a batch and the Creative Librarian indexes it, then the Content Director groups assets into carousels, stills, Stories and real-video Reel/TikTok concepts while building the rolling 7-day plan.</p></div>
  <section className="contentWorkflow"><div className="active"><small>01</small><b>Content Inbox</b><span>You upload raw assets</span></div><div><small>02</small><b>Agent Working</b><span>Indexing + grouping + post assembly</span></div><div><small>03</small><b>Ready for Approval</b><span>Finished post proposal</span></div><div><small>04</small><b>Scheduled</b><span>Approved date + platform</span></div><div><small>05</small><b>Published</b><span>Live + tracked</span></div></section>
  <UploadBox/><ContentLibrary assets={assets}/></div></>}