import Link from "next/link";
import { ArrowRight, Check, Crown, DoorOpen, Users } from "lucide-react";
import { AppIcon } from "./AppIcon";
import { PORTAL_APPS } from "./catalog";

export function SectionLanding({ kind }: { kind: "karaoke" | "loto" | "learning" }) {
  const learning = kind === "learning";
  const karaoke = kind === "karaoke";
  const base = karaoke ? "" : "/lo-to";
  const title = learning ? <>Một chút tò mò.<br />Một thế giới mở ra.</> : karaoke ? <>Bài hát bạn thích.<br />Niềm vui cả nhà.</> : <>Hồi hộp từng số.<br />Vui cùng một nhà.</>;
  const description = learning ? "Học một điều mới, đọc một bài hay và khám phá những điều kỳ thú. Bắt đầu từ điều khiến bạn tò mò." : karaoke ? "Mở một phòng hát, gửi lời mời và để những giai điệu kết nối mọi người. Điện thoại của bạn cũng có thể chọn bài." : "Một người gọi số, cả nhà cùng dò. Tạo phòng và gửi mã mời để bắt đầu một buổi chơi thật rộn ràng.";
  const apps = PORTAL_APPS.filter(app => app.category === "learn");
  return <main className="portal-section-page">
    <section className={`portal-section-hero ${learning ? "section-learn" : karaoke ? "section-karaoke" : "section-loto"}`}><div><span className="portal-section-label">{learning ? "Học & khám phá" : "Cả nhà cùng vui"}</span><h1>{title}</h1><p>{description}</p>{!learning && <div className="portal-section-promises"><span><Check size={14} />Vào phòng bằng mã mời</span><span><Check size={14} />Chơi cùng nhiều thiết bị</span></div>}</div><div className="portal-section-art" aria-hidden="true"><div><AppIcon name={learning ? "book" : karaoke ? "mic" : "ticket"} size={79} /></div><span /><i /></div></section>
    {learning ? <section className="portal-section-courses"><div className="portal-library-heading"><div><h2>Hôm nay bạn muốn khám phá gì?</h2><p>Mỗi người một nhịp học, mỗi ngày một điều mới.</p></div></div><div className="portal-app-grid">{apps.map(app => <Link href={app.href} key={app.id} className="portal-app-card portal-card-link"><span className={`portal-app-icon tone-${app.tone}`}><AppIcon name={app.icon} size={27} /></span><h3>{app.title}</h3><p>{app.description}</p><span className="portal-card-footer">Bắt đầu khám phá<ArrowRight size={16} /></span></Link>)}</div></section> : <section className="portal-role-section"><div className="portal-library-heading"><div><h2>Mọi người đã sẵn sàng chưa?</h2><p>Chọn cách tham gia của bạn.</p></div></div><div className="portal-role-grid"><Link href={`${base}/host`} className="portal-role-card"><span className="portal-role-icon"><Crown size={27} /></span><div><h3>Mình mở phòng</h3><p>Tạo một phòng riêng, chọn cài đặt và rủ mọi người cùng tham gia.</p></div><span className="portal-role-action">Tạo phòng mới<ArrowRight size={18} /></span></Link><Link href={`${base}/join`} className="portal-role-card"><span className="portal-role-icon role-join"><Users size={27} /></span><div><h3>Mình có lời mời</h3><p>Nhập tên và mã phòng được chia sẻ. Cả nhà đang chờ bạn!</p></div><span className="portal-role-action">Vào phòng<DoorOpen size={18} /></span></Link></div><p className="portal-role-note">Không cần tài khoản. Chỉ cần có nhau.</p></section>}
  </main>;
}
