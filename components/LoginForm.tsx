"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm(){
  const [code,setCode]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const router=useRouter();
  const params=useSearchParams();
  async function submit(e:React.FormEvent){
    e.preventDefault(); setError(""); setLoading(true);
    try{
      const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});
      const d=await r.json();
      if(!r.ok){setError(d.error||"Access denied.");return;}
      router.replace(params.get("next")||"/"); router.refresh();
    }catch{setError("Could not sign in.");}
    finally{setLoading(false);}
  }
  return <form className="loginCard" onSubmit={submit}><div className="loginMark">V</div><small>VIBE & A HALF</small><h1>Vibe OS</h1><p>Private command center</p><label>Access code<input autoFocus type="password" value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter code" autoComplete="current-password"/></label>{error&&<div className="loginError">{error}</div>}<button disabled={loading||!code}>{loading?"Opening…":"Open Vibe OS"}</button></form>
}