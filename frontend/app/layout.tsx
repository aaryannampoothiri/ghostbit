import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GhostBit",
  description: "Entropy-adaptive steganography dashboard"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
