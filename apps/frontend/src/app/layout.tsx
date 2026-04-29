import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL('https://karaoke-lqjm.onrender.com'),
  title: {
    default: "Portal Dịch vụ Tiện ích & Giải trí",
    template: "%s | Portal Dịch vụ"
  },
  description: "Kho ứng dụng web đa năng: Đồng hồ đo tốc độ GPS HUD cho ô tô/xe máy, phòng hát Karaoke realtime, game Lô tô, Lì xì online, theo dõi Cổ phiếu và nhiều tiện ích giải trí khác.",
  keywords: ["HUD tốc độ", "đồng hồ đo tốc độ xe máy", "GPS speedometer", "karaoke online", "game lô tô online", "phát bao lì xì", "theo dõi cổ phiếu", "mini game"],
  authors: [{ name: "Portal Developer" }],
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: 'https://karaoke-lqjm.onrender.com',
    siteName: 'Portal Dịch vụ Tiện ích',
    title: 'Cổng Ứng Dụng Giải Trí & Tiện Ích Đa Năng',
    description: 'Trải nghiệm đo tốc độ kính lái HUD cho ô tô, phòng hát karaoke chia sẻ, và các mini game vui nhộn trực tuyến ngay trên trình duyệt.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cổng Ứng Dụng Giải Trí & Tiện Ích Đa Năng',
    description: 'Trải nghiệm đo tốc độ kính lái HUD cho ô tô, phòng hát karaoke chia sẻ, và các mini game vui nhộn trực tuyến ngay trên trình duyệt.',
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
