import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Puppy Portal | Southwest Virginia Chihuahua",
  description:
    "A private homecoming portal for Southwest Virginia Chihuahua families.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
