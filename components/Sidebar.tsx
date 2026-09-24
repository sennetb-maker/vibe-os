import Link from "next/link";
import { Icon, IconName } from "./Icon";

const items:{href:string;label:string;icon:IconName}[] = [
  {href:"/", label:"Home", icon:"home"},\n  {href:"/performance", label:"Performance", icon:"chart"},
  {href:"/agents", label:"Agents", icon:"chat"},
  {href:"/content", label:"Content", icon:"content"},
  {href:"/social", label:"Social", icon:"social"},
  {href:"/creative", label:"Creative", icon:"creative"}
];

export function Sidebar() {
  return <>
    <aside className="sidebar desktopNav">
      <div className="brandMark"><span>V</span><div><b>VIBE OS</b><small>Command Center</small></div></div>
      <nav>{items.map(item => <Link key={item.href} href={item.href}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav>
      <div className="sidebarFoot"><span className="statusDot"/>Private workspace</div>
    </aside>
    <nav className="mobileNav" aria-label="Primary navigation">
      {items.map(item => <Link key={item.href} href={item.href}><Icon name={item.icon} size={19}/><span>{item.label}</span></Link>)}
    </nav>
  </>;
}