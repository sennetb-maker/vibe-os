import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
export default function Login(){return <div className="loginOverlay"><Suspense fallback={<div className="loginCard">Opening Vibe OS…</div>}><LoginForm/></Suspense></div>}