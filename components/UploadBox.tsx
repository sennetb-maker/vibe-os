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
    try{ const r=await fetch("/api/content/upload",{method:"POST",body:fd}); const d=await r.json(); setNote(d.message||"Upload complete."); if(r.ok) router.refresh(); }
    catch{ setNote("Upload storage is not connected right now."); }
  }
  return <div className={`uploadBox ${compact?"compact":""}`} onClick={()=>input.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();onFiles(e.dataTransfer.files)}}>
    <input ref={input} hidden type="file" multiple accept="image/*,video/*" onChange={e=>onFiles(e.target.files)}/>
    <div className="uploadIcon"><Icon name="upload" size={22}/></div><div><b>{compact?"Add source content":"Drop raw photos + video here"}</b><span>{compact?"They enter Content Inbox for the Social Media Manager.":"Upload the source material. The agent can crop, combine, sequence, edit and write the finished post."}</span>{note&&<small>{note}</small>}</div>
  </div>
}