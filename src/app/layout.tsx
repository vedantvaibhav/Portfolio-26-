import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { SiteNav } from "@/components/site/site-nav";
import "./globals.css";

// Placeholder faces. The real type choice comes with the art direction.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vedantvaibhav.com"),
  title: {
    default: "Vedant Vaibhav",
    template: "%s · Vedant Vaibhav",
  },
  description:
    "Vedant Vaibhav. Senior Product Designer at ShopOS, Bangalore. Design, motion and engineering.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        <SmoothScroll />
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
