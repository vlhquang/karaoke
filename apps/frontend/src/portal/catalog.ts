export type AppCategory = "family" | "games" | "utilities" | "learn" | "media";
export type AppTone = "violet" | "blue" | "mint" | "rose" | "amber";
export interface PortalApp {
  id: string; href: string; title: string; description: string; category: AppCategory;
  icon: string; tone: AppTone; keywords: string; unavailable?: boolean;
}

export const CATEGORIES = [
  { id: "all", title: "Tất cả ứng dụng", icon: "grid" },
  { id: "family", title: "Cả nhà cùng vui", icon: "heart" },
  { id: "games", title: "Trò chơi", icon: "game" },
  { id: "utilities", title: "Tiện ích mỗi ngày", icon: "sparkles" },
  { id: "learn", title: "Học & khám phá", icon: "book" },
  { id: "media", title: "Video & sáng tạo", icon: "video" },
] as const;

export const PORTAL_APPS: PortalApp[] = [
  { id: "karaoke", href: "/karaoke", title: "Karaoke", description: "Mở phòng hát, chọn bài yêu thích và cùng nhau cất giọng.", category: "family", icon: "mic", tone: "violet", keywords: "hat nhac youtube phong hat" },
  { id: "ve-vui", href: "/ve-vui", title: "Vẽ vui cùng nhà", description: "Một người vẽ, cả nhà đoán. Nét vẽ vụng cũng thành niềm vui.", category: "family", icon: "pencil", tone: "rose", keywords: "ve doan tranh gia dinh" },
  { id: "lo-to", href: "/lo-to", title: "Lô tô", description: "Rủ cả nhà dò số, chờ một tiếng kinh thật giòn.", category: "family", icon: "ticket", tone: "amber", keywords: "loto bingo so may man" },
  { id: "bao-li-xi", href: "/bao-li-xi", title: "Bao lì xì", description: "Gửi một chút may mắn, nhận một niềm vui nho nhỏ.", category: "family", icon: "gift", tone: "rose", keywords: "li xi tet cao so" },
  { id: "co-ty-phu", href: "/co-ty-phu", title: "Cờ tỷ phú Việt Nam", description: "Gieo xúc xắc, ghé thăm Việt Nam và xây cơ nghiệp của bạn.", category: "family", icon: "landmark", tone: "mint", keywords: "co ty phu monopoly board" },
  { id: "li-xi-nang-cao", href: "/li-xi-nang-cao", title: "Đại tiệc mini game", description: "Thi trí nhớ, oẳn tù tì và tranh tài cùng bạn bè trong phòng.", category: "family", icon: "party", tone: "violet", keywords: "li xi nang cao mini game realtime" },
  { id: "game-hub", href: "/game-hub", title: "Game Hub 3D", description: "Hai người, một màn đấu và nhiều trò chơi để thử sức.", category: "games", icon: "game", tone: "blue", keywords: "3d hai nguoi choi" },
  { id: "fitness-game", href: "/fitness-game", title: "Vận động cùng nhau", description: "Biến phòng khách thành đường đua và sàn đấu vui nhộn.", category: "games", icon: "activity", tone: "mint", keywords: "fitness tv boxing chay van dong" },
  { id: "camera-dodge", href: "/camera-dodge", title: "Né vật rơi", description: "Bật camera, di chuyển thật khéo và giữ năng lượng của bạn.", category: "games", icon: "camera", tone: "amber", keywords: "camera ne vat roi" },
  { id: "game-battle", href: "/game-battle/index.html", title: "Thủ thành tri thức", description: "Trả lời câu hỏi và bảo vệ căn cứ qua từng đợt tấn công.", category: "games", icon: "shield", tone: "violet", keywords: "quiz survival highway defense" },
  { id: "racing-game", href: "/racing-game/index.html", title: "Đường đua vui nhộn", description: "Chọn chiếc xe yêu thích và so tài trên đường đua.", category: "games", icon: "car", tone: "blue", keywords: "racing dua xe" },
  { id: "co-phieu", href: "/co-phieu", title: "Danh mục cổ phiếu", description: "Theo dõi giao dịch, giá cổ phiếu và danh mục của bạn.", category: "utilities", icon: "chart", tone: "blue", keywords: "co phieu dau tu chung khoan google sheets" },
  { id: "chi-tieu", href: "/chi-tieu", title: "Sổ chi tiêu", description: "Ghi lại thu chi và nhìn rõ hơn những khoản tiền mỗi ngày.", category: "utilities", icon: "wallet", tone: "mint", keywords: "chi tieu thu chi tien ngan sach" },
  { id: "hud", href: "/hud", title: "HUD tốc độ", description: "Đồng hồ GPS, thông tin tốc độ và chế độ hắt kính lái.", category: "utilities", icon: "gauge", tone: "blue", keywords: "hud gps toc do xe hanh trinh" },
  { id: "gps-tracker", href: "/gps-tracker/sender.html", title: "Chia sẻ hành trình", description: "Theo dõi và chia sẻ vị trí trên hành trình của bạn.", category: "utilities", icon: "map", tone: "mint", keywords: "gps vi tri ban do" },
  { id: "java", href: "/hoc-tap/java-core", title: "Java Core", description: "Từ những dòng code đầu tiên đến các chủ đề Java chuyên sâu.", category: "learn", icon: "code", tone: "amber", keywords: "java lap trinh coding tai lieu" },
  { id: "english", href: "/hoc-tap/tieng-anh", title: "Tiếng Anh mỗi ngày", description: "Luyện phát âm, học từ mới và làm quen những mẫu câu.", category: "learn", icon: "languages", tone: "blue", keywords: "tieng anh english phat am" },
  { id: "articles", href: "/hoc-tap/bai-viet", title: "Góc đọc", description: "Lưu những bài viết hay và trở lại đọc khi có thời gian.", category: "learn", icon: "file", tone: "mint", keywords: "bai viet doc tai lieu html" },
  { id: "science", href: "/hien-tuong-khoa-hoc", title: "Khám phá vũ trụ", description: "Cùng bé tìm hiểu ngày đêm, các mùa và những điều kỳ thú.", category: "learn", icon: "orbit", tone: "violet", keywords: "khoa hoc thien van vu tru mat troi" },
  { id: "simulation", href: "/mo-phong", title: "Bàn mô phỏng 3D", description: "Sắp đặt vật thể và khám phá một thế giới theo cách của bạn.", category: "learn", icon: "boxes", tone: "blue", keywords: "mo phong trai dat 3d vat ly" },
  { id: "tao-video", href: "/tao-video", title: "Xưởng video AI", description: "Bắt đầu một video ngắn từ ý tưởng và câu chuyện của bạn.", category: "media", icon: "clapperboard", tone: "violet", keywords: "tao video ai shorts noi dung" },
  { id: "xem-phim", href: "/xem-phim", title: "Thư viện phim", description: "Tải, lưu và thưởng thức những video yêu thích của bạn.", category: "media", icon: "film", tone: "rose", keywords: "xem phim tai video youtube drive" },
];
export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
}
export function matchesApp(app: PortalApp, query: string): boolean {
  const haystack = normalizeSearch(`${app.title} ${app.description} ${app.keywords}`);
  return normalizeSearch(query).split(/\s+/).every(word => haystack.includes(word));
}
export function findCurrentApp(pathname: string): PortalApp | undefined {
  if (/^\/(host|join|room)(\/|$)/.test(pathname)) return PORTAL_APPS[0];
  return PORTAL_APPS.find(app => pathname === app.href || pathname.startsWith(`${app.href}/`));
}
export const FAVORITES_KEY = "portal.favorites.v1";
export const RECENT_KEY = "portal.recent.v1";
export function readAppIds(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && PORTAL_APPS.some(app => app.id === id)))] : [];
  } catch { return []; }
}
