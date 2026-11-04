import Link from "next/link";
import { ArrowLeft, House } from "lucide-react";

export default function NotFound() {
  return <main className="portal-section-page"><div className="portal-empty"><House size={38} /><h1>Góc này chưa mở cửa</h1><p>Trang bạn tìm hiện chưa có hoặc đã chuyển sang một địa chỉ khác. Về nhà mình để chọn một ứng dụng nhé.</p><Link className="portal-feature-action" href="/"><ArrowLeft size={17} />Về trang chủ</Link></div></main>;
}
