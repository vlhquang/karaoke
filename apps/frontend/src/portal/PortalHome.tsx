"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, Check, Clock3, Heart, Mic2, Music2, Pencil, Search, Sparkles, X } from "lucide-react";
import { AppIcon } from "./AppIcon";
import { CATEGORIES, FAVORITES_KEY, matchesApp, PORTAL_APPS, readAppIds, RECENT_KEY, type PortalApp } from "./catalog";

type Category = typeof CATEGORIES[number]["id"];
type View = "all" | "favorites" | "recent";

export function PortalHome() {
  const [category, setCategory] = useState<Category>("all");
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const read = () => { setFavorites(readAppIds(FAVORITES_KEY)); setRecent(readAppIds(RECENT_KEY)); };
    const loadCategory = () => {
      const value = new URLSearchParams(window.location.search).get("nhom");
      setCategory(CATEGORIES.some(item => item.id === value) ? value as Category : "all");
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "/" && !(event.target instanceof HTMLElement && event.target.closest("input,textarea,[contenteditable='true']"))) { event.preventDefault(); inputRef.current?.focus(); }
    };
    read(); loadCategory();
    window.addEventListener("storage", read); window.addEventListener("portal:recent", read); window.addEventListener("popstate", loadCategory); window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener("storage", read); window.removeEventListener("portal:recent", read); window.removeEventListener("popstate", loadCategory); window.removeEventListener("keydown", keydown); };
  }, []);
  useEffect(() => { if (!notice) return; const timeout = setTimeout(() => setNotice(""), 3000); return () => clearTimeout(timeout); }, [notice]);
  const apps = useMemo(() => {
    const source = view === "recent" ? recent.flatMap(id => PORTAL_APPS.find(app => app.id === id) ?? []) : PORTAL_APPS;
    return source.filter(app => (category === "all" || app.category === category) && (view !== "favorites" || favorites.includes(app.id)) && matchesApp(app, query));
  }, [category, favorites, query, recent, view]);
  const chooseCategory = (id: Category) => { setCategory(id); setView("all"); window.history.replaceState(window.history.state, "", id === "all" ? "/" : `/?nhom=${id}`); };
  const chooseView = (next: View) => { setView(next); setCategory("all"); setQuery(""); window.history.replaceState(window.history.state, "", "/"); };
  const toggleFavorite = (app: PortalApp) => {
    const selected = favorites.includes(app.id);
    const next = selected ? favorites.filter(id => id !== app.id) : [...favorites, app.id];
    setFavorites(next);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* Favorites still work for this visit. */ }
    setNotice(selected ? `Đã bỏ lưu ${app.title}.` : `Đã lưu ${app.title} vào yêu thích.`);
  };
  const title = view === "favorites" ? "Những ứng dụng bạn yêu thích" : view === "recent" ? "Tiếp tục những điều đang vui" : category === "all" ? "Khám phá không gian nhà mình" : CATEGORIES.find(item => item.id === category)!.title;
  const showFeatured = view === "all" && category === "all" && !query.trim();

  return <main className="portal-discovery">
    <aside className="portal-sidebar" aria-label="Nhóm ứng dụng">
      <div className="portal-sidebar-label">Không gian của bạn</div>
      <nav className="portal-category-list">{CATEGORIES.map(item => <button key={item.id} type="button" className={view === "all" && category === item.id ? "is-active" : ""} aria-pressed={view === "all" && category === item.id} onClick={() => chooseCategory(item.id)}><AppIcon name={item.icon} size={19} /><span>{item.title}</span><small>{item.id === "all" ? PORTAL_APPS.length : PORTAL_APPS.filter(app => app.category === item.id).length}</small></button>)}</nav>
      <div className="portal-sidebar-divider" /><div className="portal-sidebar-label">Dành riêng cho bạn</div>
      <nav className="portal-personal-list"><button type="button" className={view === "favorites" ? "is-active" : ""} aria-pressed={view === "favorites"} onClick={() => chooseView("favorites")}><Heart size={19} /><span>Yêu thích</span><small>{favorites.length}</small></button><button type="button" className={view === "recent" ? "is-active" : ""} aria-pressed={view === "recent"} onClick={() => chooseView("recent")}><Clock3 size={19} /><span>Mở gần đây</span><small>{recent.length}</small></button></nav>
      <div className="portal-sidebar-note"><span className="portal-note-icon"><Sparkles size={20} /></span><b>Một chút vui mỗi ngày.</b><p>Những điều nhỏ, khiến thời gian bên nhau thêm đáng nhớ.</p><Link href="/ve-vui">Cùng vẽ một bức tranh<ArrowUpRight size={15} /></Link></div>
    </aside>
    <div className="portal-discovery-main">
      <section className="portal-welcome"><div><span className="portal-welcome-label"><span />Chào mừng về nhà</span><h1>Hôm nay, nhà mình<br />cùng làm gì?</h1><p>Một góc nhỏ để giải trí, khám phá và làm cuộc sống dễ dàng hơn.</p></div><span className="portal-welcome-art" aria-hidden="true"><Sparkles size={43} strokeWidth={1.2} /><span /><i /></span></section>
      {showFeatured && <section className="portal-featured" aria-label="Gợi ý cho cả nhà"><Link href="/karaoke" className="portal-feature-card portal-feature-karaoke"><div className="portal-feature-copy"><span className="portal-feature-label"><Music2 size={15} />Cả nhà cùng cất giọng</span><h2>Mở mic lên.<br />Vui hát hết mình.</h2><p>Mỗi người một bài yêu thích.<br />Cùng nhau thành một ban nhạc.</p><span className="portal-feature-action">Mở phòng hát<ArrowRight size={17} /></span></div><div className="portal-mic-art" aria-hidden="true"><span className="portal-mic-ring ring-one" /><span className="portal-mic-ring ring-two" /><div className="portal-mic-orb"><Mic2 size={80} strokeWidth={1.25} /></div><Music2 className="portal-music-note" size={24} /><Sparkles className="portal-mic-sparkle" size={21} /></div></Link><Link href="/ve-vui" className="portal-feature-card portal-feature-drawing"><span className="portal-feature-label"><Heart size={15} />Thêm một chút gần nhau</span><div className="portal-drawing-art" aria-hidden="true"><svg viewBox="0 0 180 110" fill="none"><path d="m42 65 43-37 44 37M52 59v39h66V59" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M77 98V72h18v26" stroke="currentColor" strokeWidth="3" /><circle cx="139" cy="26" r="12" fill="#f5cc6c" /><path d="M142 7v-5m17 24h6m-10-14 4-4M125 11l-4-4M139 44v5" stroke="#dba43b" strokeWidth="2.5" strokeLinecap="round" /><path d="M36 98c-1-16-8-28-13-22s4 15 13 14m3 8c3-17 15-25 16-15s-9 11-16 11" stroke="#74a78c" strokeWidth="2.5" strokeLinecap="round" /><path d="M104 12c-4-7-12-3-8 3l8 8 8-8c4-7-4-10-8-3Z" fill="#e7a7b3" /></svg><Pencil size={37} strokeWidth={1.6} /></div><h2>Nét vẽ nhỏ.<br />Tiếng cười to.</h2><span className="portal-feature-link">Vẽ vui cùng nhà<ArrowUpRight size={18} /></span></Link></section>}
      <section className="portal-app-library" id="ung-dung"><div className="portal-library-heading"><div><h2>{title}</h2><p>{view === "favorites" ? "Lưu những ứng dụng hay dùng để lần sau mở thật nhanh." : view === "recent" ? "Những ứng dụng bạn vừa ghé qua trên thiết bị này." : "Chọn một điều bạn thích, mọi thứ đã ở đây."}</p></div><span className="portal-result-count">{apps.length} ứng dụng</span></div>
        <div className="portal-library-toolbar"><label className="portal-library-search"><Search size={19} /><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm một điều bạn muốn làm..." aria-label="Tìm kiếm ứng dụng" />{query ? <button type="button" aria-label="Xóa từ khóa tìm kiếm" onClick={() => setQuery("")}><X size={17} /></button> : <kbd>/</kbd>}</label><div className="portal-mobile-views"><button type="button" aria-label="Xem ứng dụng yêu thích" aria-pressed={view === "favorites"} onClick={() => chooseView(view === "favorites" ? "all" : "favorites")}><Heart size={19} /></button><button type="button" aria-label="Xem ứng dụng mở gần đây" aria-pressed={view === "recent"} onClick={() => chooseView(view === "recent" ? "all" : "recent")}><Clock3 size={19} /></button></div><span className="portal-library-hint"><Bookmark size={14} />Lưu lại điều bạn thích</span></div>
        <div className="portal-app-grid" aria-live="polite">{apps.map(app => <article key={app.id} className={`portal-app-card${app.unavailable ? " is-unavailable" : ""}`}><button type="button" className={`portal-favorite${favorites.includes(app.id) ? " is-saved" : ""}`} aria-pressed={favorites.includes(app.id)} aria-label={`${favorites.includes(app.id) ? "Bỏ lưu" : "Lưu"} ${app.title}`} onClick={() => toggleFavorite(app)}><Heart size={17} fill={favorites.includes(app.id) ? "currentColor" : "none"} /></button>{app.unavailable ? <div className="portal-card-link"><span className={`portal-app-icon tone-${app.tone}`}><AppIcon name={app.icon} size={27} /></span><h3>{app.title}</h3><p>{app.description}</p><span className="portal-card-footer">Chưa khả dụng</span></div> : <Link className="portal-card-link" href={app.href}><span className={`portal-app-icon tone-${app.tone}`}><AppIcon name={app.icon} size={27} /></span><h3>{app.title}</h3><p>{app.description}</p><span className="portal-card-footer">{CATEGORIES.find(item => item.id === app.category)?.title}<ArrowUpRight size={16} /></span></Link>}</article>)}</div>
        {!apps.length && <div className="portal-empty"><Search size={34} /><h3>{view === "favorites" && !query ? "Góc yêu thích đang chờ bạn" : view === "recent" && !query ? "Bắt đầu khám phá nhà mình nhé" : "Chưa thấy ứng dụng bạn tìm"}</h3><p>{view === "favorites" ? "Chạm vào trái tim trên ứng dụng để lưu vào đây." : "Thử một từ khóa khác hoặc xem tất cả ứng dụng."}</p><button type="button" onClick={() => { chooseView("all"); setQuery(""); }}>Xem tất cả ứng dụng<ArrowRight size={16} /></button></div>}
      </section><footer className="portal-footer"><span><Heart size={14} />Dành thời gian cho những điều bạn thích.</span><span>Nhà mình · Không gian của cả gia đình</span></footer>
    </div>
    {notice && <div className="portal-toast" role="status"><Check size={17} />{notice}</div>}
  </main>;
}
