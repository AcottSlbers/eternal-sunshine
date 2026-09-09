import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eternal Sunshine — The best sunset on Earth right now",
  description: "Eternal Sunshine finds current sunsets through webcams around the world and brings the most beautiful one into view.",
  openGraph: {
    title: "Eternal Sunshine — The best sunset on Earth right now",
    description: "Discover the best sunset visible on webcams around the world right now.",
    type: "website",
    siteName: "Eternal Sunshine",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
