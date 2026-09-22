import { Icon } from "./Icon";

export function Topbar({title,eyebrow="Vibe & A Half"}:{title:string;eyebrow?:string}) {
  return <header className="topbar">
    <div><small>{eyebrow}</small><h1>{title}</h1></div>
    <div className="topActions"><button className="iconButton" aria-label="Notifications"><Icon name="bell" size={18}/><span className="notifDot"/></button><div className="profile">BS</div></div>
  </header>;
}