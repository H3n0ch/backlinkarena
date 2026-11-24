import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { Suspense } from "react";
import { Analytics } from "@/components/Analytics";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LiveClock } from "@/components/LiveClock";
import { SITE_URL } from "@/lib/env";
import { JsonLd, SITE_SCHEMA } from "@/lib/json-ld";
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
    default: "Backlink Arena: Launch Your SaaS & Win DA 50+ Backlinks",
    template: "%s · Backlink Arena",
  },
  description:
    "Launch your SaaS in free 1v1 tournaments, compete for visibility, and get real user votes, traffic, and backlinks. The champion wins a DA 50+ backlink.",
  openGraph: { siteName: "Backlink Arena", type: "website" },
  twitter: { card: "summary_large_image" },
  // Google Search Console "HTML tag" verification (only needed if you don't verify via DNS).
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: "#f97316",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <JsonLd data={SITE_SCHEMA} />
        <Suspense fallback={<div className="h-10 bg-dark-gradient" />}>
          <AnnouncementBar />
        </Suspense>
        <Header />
        <main className="flex-1 w-full">{children}</main>
        <Footer />
        <Analytics />
        <LiveClock />
      </body>
    </html>
  );
}
