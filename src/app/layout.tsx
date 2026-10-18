import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Newsreader } from "next/font/google";
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
  title: "Aitio",
  description: "Suomen teatterin päiväkirja: mitä on ohjelmassa, mitä olet nähnyt ja mitä muut ajattelivat.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fi" data-theme="light" className={`${newsreader.variable} ${atkinson.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
