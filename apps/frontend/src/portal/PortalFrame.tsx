"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Command, Grid2X2, House, Search, X } from "lucide-react";
import { AppIcon } from "./AppIcon";
import { findCurrentApp, matchesApp, PORTAL_APPS, readAppIds, RECENT_KEY } from "./catalog";

const IMMERSIVE = ["/ve-vui", "/co-ty-phu", "/game-hub", "/hud", "/mo-phong", "/hien-tuong-khoa-hoc"];

export function PortalFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const app = findCurrentApp(pathname);
  const immersive = IMMERSIVE.includes(pathname);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const results = PORTAL_APPS.filter(item => !item.unavailable && matchesApp(item, query));
  useEffect(() => {
    setOpen(false);
    if (!app || app.unavailable) return;
    try { localStorage.setItem(RECENT_KEY, JSON.stringify([app.id, ...readAppIds(RECENT_KEY).filter(id => id !== app.id)].slice(0, 6))); window.dispatchEvent(new Event("portal:recent")); } catch { /* Browsing also works with storage disabled. */ }
  }, [pathname, app]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(previous => !previous); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) { if (dialog.open) dialog.close(); return; }
    setQuery("");
    if (!dialog.open) dialog.showModal();
    searchRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; if (dialog.open) dialog.close(); };
  }, [open]);
  return <div className={`portal-app${pathname === "/" ? " portal-home" : ""}`} data-portal-mode={immersive ? "immersive" : "standard"} data-portal-app={app?.id ?? (pathname.startsWith("/hoc-tap") ? "learning" : "home")}>
    {!immersive && <header className="portal-topbar">
      <Link href="/" className="portal-brand" aria-label="Nhà mình — về trang chủ"><span className="portal-brand-mark"><House size={23} strokeWidth={1.8} /></span><span>nhà mình<span className="portal-brand-caption">Một nơi, nhiều niềm vui.</span></span></Link>
      {pathname === "/" ? <nav className="portal-topnav" aria-label="Điều hướng chính"><a href="#ung-dung" className="is-active">Khám phá</a><Link href="/hoc-tap">Học cùng nhau</Link><Link href="/karaoke">Mở phòng hát</Link></nav> : <div className="portal-location"><span />{app ? <><AppIcon name={app.icon} size={18} /><span>{app.title}</span></> : <span>{pathname.startsWith("/hoc-tap") ? "Học & khám phá" : "Không gian của bạn"}</span>}</div>}
      <div className="portal-topbar-actions"><button type="button" className="portal-search-trigger" onClick={() => setOpen(true)} aria-label="Tìm và mở ứng dụng"><Search size={18} /><span>Tìm ứng dụng</span><kbd><Command size={11} />K</kbd></button>{pathname !== "/" && <Link href="/" className="portal-icon-button" aria-label="Về trang chủ"><Grid2X2 size={20} /></Link>}<span className="portal-profile" title="Không gian gia đình"><House size={18} /></span></div>
    </header>}
    {!immersive && <a className="portal-skip" href="#portal-content">Bỏ qua điều hướng</a>}
    <div id="portal-content" className={immersive ? `portal-immersive${app && ["science", "simulation"].includes(app.id) ? " portal-themed" : ""}` : "portal-content portal-themed"}>{children}</div>
    <dialog className="portal-switcher" ref={dialogRef} aria-labelledby={titleId} onClose={() => setOpen(false)}>
      <div className="portal-switcher-heading"><h2 id={titleId}>Bạn muốn làm gì hôm nay?</h2><button type="button" className="portal-icon-button" aria-label="Đóng danh sách ứng dụng" onClick={() => setOpen(false)}><X size={20} /></button></div>
      <label className="portal-switcher-search"><Search size={20} /><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm trò chơi, học tập, tiện ích..." aria-label="Tìm ứng dụng trong portal" /></label>
      <div className="portal-switcher-results">{results.map(item => <Link key={item.id} href={item.href} className="portal-switcher-item" onClick={() => setOpen(false)}><span className={`portal-app-icon tone-${item.tone}`}><AppIcon name={item.icon} size={22} /></span><span><b>{item.title}</b><small>{item.description}</small></span><ArrowUpRight size={17} /></Link>)}{!results.length && <p className="portal-switcher-empty">Chưa tìm thấy ứng dụng. Thử một từ khóa ngắn hơn nhé.</p>}</div>
      <div className="portal-switcher-footer"><Link href="/" onClick={() => setOpen(false)}><ArrowLeft size={15} />Tất cả ứng dụng</Link><span>Esc để đóng</span></div>
    </dialog>
  </div>;
}
