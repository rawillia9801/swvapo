import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-merriweather",
  subsets: ["latin"],
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
        className={`${inter.variable} ${manrope.variable} bg-[#edf2f8] text-[#162033] antialiased [font-family:var(--font-open-sans)]`}
      >
        {children}
      </body>
    </html>
  );
}
