import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { LOCALES } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { SITE_URL } from "@/lib/site";
import { TOKENS } from "@/lib/tokens";
import "../globals.css";

const serif = Source_Serif_4({ subsets: ["latin", "latin-ext"], variable: "--font-source-serif", display: "swap" });
const sans = Source_Sans_3({ subsets: ["latin", "latin-ext"], variable: "--font-source-sans", display: "swap" });

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    metadataBase: SITE_URL,
    title: { default: `${t.site.name}: ${t.site.tagline}`, template: `%s · ${t.site.name}` },
    description: t.site.description,
    applicationName: t.site.name,
    icons: { apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { title: t.site.name, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = { themeColor: TOKENS.paper, colorScheme: "light" };

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const { locale, t } = await getDictionary();
  return (
    <html lang={locale} className={`${serif.variable} ${sans.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-paper focus:p-3"
        >
          {t.site.skipToContent}
        </a>
        <SiteHeader locale={locale} t={t} />
        <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {children}
        </main>
        <SiteFooter locale={locale} t={t} />
      </body>
    </html>
  );
}
