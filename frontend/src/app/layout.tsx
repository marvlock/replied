import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Replied — Curated Silence",
  description: "The anonymous sanctuary for professional curation. Share your link, receive honest messages, and publish the responses that define you.",
  keywords: ["anonymous messages", "curation", "feedback", "professional profiles", "replied"],
  authors: [{ name: "Replied Team" }],
  openGraph: {
    title: "Replied — Curated Silence",
    description: "The anonymous sanctuary for professional curation.",
    type: "website",
    siteName: "Replied",
  },
  twitter: {
    card: "summary_large_image",
    title: "Replied — Curated Silence",
    description: "Share your link, receive honest messages, and publish response.",
  },
  icons: {
    icon: "/icon.svg",
  },
};

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <TooltipProvider>
          {children}
          <Toaster position="top-center" />
        </TooltipProvider>
      </body>
    </html>
  );
}
