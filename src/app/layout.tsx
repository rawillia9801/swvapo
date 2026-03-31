import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-merriweather",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "My Puppy Portal | Southwest Virginia Chihuahua",
  description: "Private puppy portal for Southwest Virginia Chihuahua families.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${playfair.variable} bg-[#fafaf9] text-[#1c1917] antialiased [font-family:var(--font-open-sans)]`}
      >
        {children}
      </body>
    </html>
  );
}
