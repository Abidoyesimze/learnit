import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const dynamic = "force-dynamic"; // Privy needs a real app id at runtime, not at build

export const metadata: Metadata = {
  title: "LearnIt",
  description: "Learn a language. Earn G$.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#ffd60a", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
