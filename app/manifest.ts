import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vibe OS — Vibe & A Half",
    short_name: "Vibe OS",
    description: "Private Vibe & A Half business command center",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f0e8",
    theme_color: "#284b3c",
    icons: [
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}