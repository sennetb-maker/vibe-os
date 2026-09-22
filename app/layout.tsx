import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata = {
  title: "Vibe OS",
  description: "Vibe & A Half command center",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Vibe OS", statusBarStyle: "black-translucent" as const },
  icons: { apple: "/pwa-192.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><PwaRegister/><div className="app"><Sidebar/><main>{children}</main></div></body></html>;
}