import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Newsreader } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TabBar } from "@/components/TabBar";
import { LOCALES } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { SITE_URL } from "@/lib/site";
import { TOKENS } from "@/lib/tokens";
import "../globals.css";

// Variable font with the optical-size axis: poster titles get the display cut, stubs the text cut.
const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});
const sans = Atkinson_Hyperlegible({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-atkinson",
  display: "swap",
});

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
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:bg-paper-raised focus:p-3"
        >
          {t.site.skipToContent}
        </a>
        <SiteHeader locale={locale} t={t} />
        <main id="main" className="mx-auto w-full max-w-measure flex-1 px-4 pt-4 pb-8">
          {children}
        </main>
        <SiteFooter locale={locale} t={t} />
        <TabBar locale={locale} t={t} />
      </body>
    </html>
  );
}
