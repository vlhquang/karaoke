import type { Metadata, Viewport } from "next";
import PhongThuyApp from "../../phong-thuy/PhongThuyApp";

export const metadata: Metadata = {
  title: "Bản đồ phong thuỷ",
  description: "Đặt nhiều la bàn trên bản đồ, phác thảo nhà theo mét và xem hướng cửa chính, bếp, lối vào nhà.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5, userScalable: true };

export default function PhongThuyPage() { return <PhongThuyApp />; }
