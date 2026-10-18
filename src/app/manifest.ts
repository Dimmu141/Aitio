import type { MetadataRoute } from "next";
import { t } from "@/i18n/fi";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${t.site.name}: ${t.site.tagline}`,
    short_name: t.site.name,
    description: t.site.description,
    lang: "fi",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f2e8",
    theme_color: "#f7f2e8",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
