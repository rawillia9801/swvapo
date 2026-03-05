import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from '@/components/Header'; // <-- 1. Imported the NEW Header instead of Navbar
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
  title: "Southwest Virginia Chihuahua",
  description: "Championship Lineage Breeding Program",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-stone-50 text-stone-900`}>
        
        {/* 2. Used the NEW Header here */}
        <Header /> 
        
        {children}
      </body>
    </html>
  );
}