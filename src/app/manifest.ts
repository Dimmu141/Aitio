import type { MetadataRoute } from "next";
import { fi } from "@/i18n/dictionaries/fi";
import { TOKENS } from "@/lib/tokens";

/** Installable as a home-screen app. Finnish, the default locale, names it. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${fi.site.name}: ${fi.site.tagline}`,
    short_name: fi.site.name,
    description: fi.site.description,
    lang: "fi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: TOKENS.paper,
    theme_color: TOKENS.paper,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
