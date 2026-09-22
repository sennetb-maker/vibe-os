export type IconName = "home"|"chat"|"content"|"social"|"creative"|"bell"|"upload"|"check"|"clock"|"arrow"|"store"|"approval"|"message"|"calendar"|"spark"|"menu";

export function Icon({name,size=18}:{name:IconName;size?:number}){
  const props={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.7,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true};
  const paths:Record<IconName,React.ReactNode>={
    home:<><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-6h6v6"/></>,
    chat:<><path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-7a4 4 0 0 1-1-2.6V7a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4z"/></>,
    content:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 15 3-3 3 3 2-2 2 2"/><circle cx="8.5" cy="8.5" r="1.2"/></>,
    social:<><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="m8.2 10.9 7.6-3.8M8.2 13.1l7.6 3.8"/></>,
    creative:<><path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/></>,
    bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    upload:<><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v5h16v-5"/></>,
    check:<><path d="m5 12 4 4L19 6"/></>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    arrow:<><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    store:<><path d="M4 10v10h16V10"/><path d="M3 10h18l-2-6H5z"/><path d="M9 20v-6h6v6"/></>,
    approval:<><path d="M7 3h10v4H7z"/><path d="M5 5H3v16h18V5h-2"/><path d="m8 14 2.5 2.5L16 11"/></>,
    message:<><path d="M4 5h16v11H8l-4 3z"/><path d="M8 9h8M8 12h5"/></>,
    calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
    spark:<><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/></>,
    menu:<><path d="M4 7h16M4 12h16M4 17h16"/></>
  };
  return <svg {...props}>{paths[name]}</svg>
}