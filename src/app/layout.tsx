import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, Newsreader } from "next/font/google";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { SiteNav } from "@/components/site/site-nav";
import "./globals.css";

// Geist is a placeholder for body text. IBM Plex Mono and Newsreader italic
// are Vedant's current choices for the prompt and the headline.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["italic"],
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
      className={`${geistSans.variable} ${plexMono.variable} ${newsreader.variable} antialiased`}
    >
      <body>
        <SmoothScroll />
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
