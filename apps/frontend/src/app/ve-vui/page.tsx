import type { Metadata, Viewport } from "next";
import { DrawingGame } from "../../ve-vui/DrawingGame";
import "../../ve-vui/ve-vui.css";

export const metadata: Metadata = { title: "Vẽ vui cùng nhà", description: "Một người vẽ, cả nhà đoán. Tạo phòng chơi vẽ và đoán trực tiếp cho 2–8 người, không cần tài khoản." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, minimumScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover", interactiveWidget: "resizes-content" };
export default function DrawingPage() { return <DrawingGame />; }
