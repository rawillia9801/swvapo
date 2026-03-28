import type { Metadata } from "next";
import { Merriweather, Open_Sans } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "My Puppy Portal | Southwest Virginia Chihuahua",
  description: "Private puppy portal for Southwest Virginia Chihuahua families.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${openSans.variable} ${merriweather.variable} bg-[#f0ebe0] text-[#23170f] antialiased [font-family:var(--font-open-sans)]`}
      >
        {children}
      </body>
    </html>
  );
}
