import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Newsreader } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { t } from "@/i18n/fi";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

// Designed for low-vision readers; much of the audience is 55–74.
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${t.site.name}: ${t.site.tagline}`, template: `%s | ${t.site.name}` },
  description: t.site.description,
  openGraph: { siteName: t.site.name, locale: "fi_FI", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#f7f2e8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fi" data-theme="light" className={`${newsreader.variable} ${atkinson.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-measure flex-1 px-4 pt-6">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
