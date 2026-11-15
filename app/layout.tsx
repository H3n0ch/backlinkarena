import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { Suspense } from "react";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const display = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  style: ["normal", "italic"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Backlink Arena: play for a DA 50+ backlink",
    template: "%s · Backlink Arena",
  },
  description:
    "Strong backlinks shouldn't only be for companies with big budgets. Enter your website, win 1v1 votes, and win a backlink on a real DA 50+ site in your niche.",
  openGraph: { siteName: "Backlink Arena", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Suspense fallback={<div className="h-10 bg-dark-gradient" />}>
          <AnnouncementBar />
        </Suspense>
        <Header />
        <main className="flex-1 w-full">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
