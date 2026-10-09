import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { appUrl } from "@/lib/config/env";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz", "SOFT"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  openGraph: { title: BRAND.name, description: BRAND.description, images: [{ url: BRAND.logo, width: 512, height: 512, alt: `${BRAND.name} logo` }] },
};

export const viewport: Viewport = {
  themeColor: "#0b2624",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-screen" suppressHydrationWarning>{children}</body>
    </html>
  );
}
