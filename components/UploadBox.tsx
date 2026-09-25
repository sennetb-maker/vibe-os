"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

export function UploadBox({compact=false}:{compact?:boolean}){
  const input=useRef<HTMLInputElement>(null); const [note,setNote]=useState(""); const router=useRouter();
  async function onFiles(files:FileList|null){
    if(!files?.length) return;
    setNote(`Preparing ${files.length} file${files.length>1?"s":""}…`);
    const fd=new FormData(); Array.from(files).forEach(f=>fd.append("files",f));
    try{
      const r=await fetch("/api/content/upload",{method:"POST",body:fd});
      const d=await r.json();
      if(!r.ok){ setNote(d.message||"Upload failed."); return; }
      setNote((d.message||"Upload complete.")+" Content Director is building the 7-day plan…");
      router.refresh();
      try{
        const p=await fetch("/api/social/generate-plan",{method:"POST"});
        const pd=await p.json();
        setNote(p.ok ? `${d.message||"Upload complete."} ${pd.message||"7-day plan updated."}` : `${d.message||"Upload complete."} Planning is waiting: ${pd.message||"not enough usable content yet."}`);
      }catch{
        setNote((d.message||"Upload complete.")+" Files are safe; the weekly plan can be refreshed from Social.");
      }
      router.refresh();
    }
    catch{ setNote("Upload storage is not connected right now."); }
  }
  return <div className={`uploadBox ${compact?"compact":""}`} onClick={()=>input.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();onFiles(e.dataTransfer.files)}}>
    <input ref={input} hidden type="file" multiple accept="image/*,video/*" onChange={e=>onFiles(e.target.files)}/>
    <div className="uploadIcon"><Icon name="upload" size={22}/></div><div><b>{compact?"Add source content":"Drop raw photos + video here"}</b><span>{compact?"They enter Content Inbox; the Content Director builds the weekly plan automatically.":"Upload the source material. The agents catalog it, group it, choose formats, write copy and build the 7-day plan automatically."}</span>{note&&<small>{note}</small>}</div>
  </div>
}