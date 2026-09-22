import { Topbar } from "@/components/Topbar";
import { getCreativeAssets } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Creative(){
  const assets=await getCreativeAssets(40);
  return <><Topbar title="Creative"/><div className="page"><div className="sectionIntro"><small>CREATIVE LIBRARY</small><h2>Concepts, artwork and approved brand assets.</h2><p>This is the review layer between the Artwork Designer, Product Builder and your final owner approval.</p></div><div className="creativeToolbar"><button className="primary">New creative brief</button><button className="secondary">View pending approval</button></div>{assets.length?<div className="assetGrid creativeGrid">{assets.map((x:any)=><div className="libraryCard" key={x.id}>{x.signedUrl?<img src={x.signedUrl} alt=""/>:<div className="videoPlaceholder">ARTWORK</div>}<div className="libraryMeta"><small>{String(x.status).toUpperCase()}</small><b>{x.title}</b><span>{x.source_agent||"Vibe OS"}{x.notes?` · ${x.notes}`:""}</span></div></div>)}</div>:<div className="libraryEmpty"><b>No live creative assets yet.</b><p>Creative outputs saved to Supabase will appear here for review and approval.</p></div>}</div></>}