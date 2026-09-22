import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const expected = process.env.VIBE_OS_ACCESS_CODE;
  if (!expected) return NextResponse.json({ error: "VIBE_OS_ACCESS_CODE is not configured." }, { status: 503 });
  const { code } = await req.json();
  if (!code || code !== expected) return NextResponse.json({ error: "Incorrect access code." }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("vibe_os_access", expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}