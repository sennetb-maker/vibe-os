import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/manifest.webmanifest", "/sw.js", "/pwa-192.png", "/pwa-512.png"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico" || PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const expected = process.env.VIBE_OS_ACCESS_CODE;
  if (!expected) return NextResponse.next();
  const cookie = req.cookies.get("vibe_os_access")?.value;
  if (cookie === expected) return NextResponse.next();

  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};