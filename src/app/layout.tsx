import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { themeInitScript } from "@/lib/utilities/theme";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mabojolu by Westforge",
    template: "%s | Mabojolu",
  },
  description:
    "Mabojolu is an AI assistant for thinking, writing, analysis, planning, and research. A Westforge Holdings Product.",
  applicationName: "Mabojolu",
  authors: [{ name: "Westforge Holdings Inc." }],
  metadataBase: new URL("https://mabojolu.com"),
  openGraph: {
    title: "Mabojolu by Westforge",
    description:
      "An AI assistant for thinking, writing, analysis, planning, and research.",
    url: "https://mabojolu.com",
    siteName: "Mabojolu",
    type: "website",
  },
  // The product is a private conversational tool, so search indexing of the app
  // surface is off by default.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch zoom is left enabled. Locking it breaks a genuine accessibility need
  // and buys nothing here.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1a15" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Set by the inline script below before paint; React must not fight it.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
         * Applies the stored theme before first paint to avoid a flash of the
         * wrong theme. The content is a compile-time constant from our own
         * module, never user input, so there is no injection surface here.
         */}
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
