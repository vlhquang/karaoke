import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Realtime Karaoke Room",
  description: "Host and queue YouTube karaoke songs in real time"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
