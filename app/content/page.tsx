import { Topbar } from "@/components/Topbar";
import { UploadBox } from "@/components/UploadBox";
import { ContentLibrary } from "@/components/ContentLibrary";
import { getContentAssets } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Content(){
  const assets=await getContentAssets(120);
  return <><Topbar title="Content Library"/><div className="page"><div className="sectionIntro compactIntro"><small>SOURCE CONTENT</small><h2>Upload the raw material. The agent builds the post.</h2><p>Photos and videos here are source assets — not finished social posts. The Social Media Manager can select them, crop or edit them, combine multiple assets, write copy, choose a product link and build the schedule.</p></div>
  <section className="contentWorkflow"><div className="active"><small>01</small><b>Content Inbox</b><span>You upload raw assets</span></div><div><small>02</small><b>Agent Working</b><span>Editing + copy + post assembly</span></div><div><small>03</small><b>Ready for Approval</b><span>Finished post proposal</span></div><div><small>04</small><b>Scheduled</b><span>Approved date + platform</span></div><div><small>05</small><b>Published</b><span>Live + tracked</span></div></section>
  <UploadBox/><ContentLibrary assets={assets}/></div></>}