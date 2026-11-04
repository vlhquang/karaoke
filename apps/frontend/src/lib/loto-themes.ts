export interface LotoThemeConfig {
    name: string;
    /** Root background + text */
    classes: string;
    /** Border color for cards/sections */
    border: string;
    /** Card/section background */
    cardBg: string;
    /** Accent color for primary buttons and highlights */
    accent: string;
    /** Text color on accent backgrounds */
    accentText: string;
    /** Muted/secondary text */
    muted: string;
    /** Input/select background */
    inputBg: string;
    /** Input border */
    inputBorder: string;
    /** Called number cell */
    calledCell: string;
    /** Current number highlight */
    currentCell: string;
    /** Uncalled number cell */
    uncalledCell: string;
    /** Matched bingo cell */
    matchedCell: string;
    /** Unmatched bingo cell */
    unmatchedCell: string;
}

export const LOTO_THEMES: Record<string, LotoThemeConfig> = {
    "default": {
        name: "Mát mẻ (Mặc định)",
        classes: "bg-slate-950 text-slate-200",
        border: "border-slate-700",
        cardBg: "bg-slate-900/60",
        accent: "bg-cyan-500",
        accentText: "text-slate-900",
        muted: "text-slate-400",
        inputBg: "bg-slate-950",
        inputBorder: "border-slate-600",
        calledCell: "border border-cyan-400/40 bg-cyan-500/30 text-cyan-100",
        currentCell: "bg-cyan-500 text-slate-900 ring-2 ring-cyan-300",
        uncalledCell: "border border-slate-700/40 bg-slate-800/60 text-slate-500",
        matchedCell: "bg-cyan-500 text-slate-900",
        unmatchedCell: "border border-slate-700 bg-slate-800 text-slate-200",
    },
    "kim": {
        name: "Kim (Vàng/Trắng)",
        classes: "bg-amber-50 text-amber-950",
        border: "border-amber-200",
        cardBg: "bg-white/80",
        accent: "bg-amber-700",
        accentText: "text-white",
        muted: "text-amber-700",
        inputBg: "bg-white/80",
        inputBorder: "border-amber-200",
        calledCell: "border border-amber-300 bg-amber-100 text-amber-900",
        currentCell: "bg-amber-700 text-white ring-2 ring-amber-300",
        uncalledCell: "border border-amber-100 bg-amber-50 text-amber-700",
        matchedCell: "bg-amber-700 text-white",
        unmatchedCell: "border border-amber-200 bg-white/80 text-amber-900",
    },
    "moc": {
        name: "Mộc (Xanh lá)",
        classes: "bg-emerald-50 text-emerald-950",
        border: "border-emerald-200",
        cardBg: "bg-white/80",
        accent: "bg-emerald-700",
        accentText: "text-white",
        muted: "text-emerald-700",
        inputBg: "bg-white/80",
        inputBorder: "border-emerald-200",
        calledCell: "border border-emerald-300 bg-emerald-100 text-emerald-900",
        currentCell: "bg-emerald-700 text-white ring-2 ring-emerald-300",
        uncalledCell: "border border-emerald-100 bg-emerald-50 text-emerald-700",
        matchedCell: "bg-emerald-700 text-white",
        unmatchedCell: "border border-emerald-200 bg-white/80 text-emerald-900",
    },
    "thuy": {
        name: "Thủy (Xanh dương)",
        classes: "bg-blue-50 text-blue-950",
        border: "border-blue-200",
        cardBg: "bg-white/80",
        accent: "bg-blue-700",
        accentText: "text-white",
        muted: "text-blue-700",
        inputBg: "bg-white/80",
        inputBorder: "border-blue-200",
        calledCell: "border border-blue-300 bg-blue-100 text-blue-900",
        currentCell: "bg-blue-700 text-white ring-2 ring-blue-300",
        uncalledCell: "border border-blue-100 bg-blue-50 text-blue-700",
        matchedCell: "bg-blue-700 text-white",
        unmatchedCell: "border border-blue-200 bg-white/80 text-blue-900",
    },
    "hoa": {
        name: "Hỏa (Đỏ/Tím)",
        classes: "bg-rose-50 text-rose-950",
        border: "border-rose-200",
        cardBg: "bg-white/80",
        accent: "bg-rose-700",
        accentText: "text-white",
        muted: "text-rose-700",
        inputBg: "bg-white/80",
        inputBorder: "border-rose-200",
        calledCell: "border border-rose-300 bg-rose-100 text-rose-900",
        currentCell: "bg-rose-700 text-white ring-2 ring-rose-300",
        uncalledCell: "border border-rose-100 bg-rose-50 text-rose-700",
        matchedCell: "bg-rose-700 text-white",
        unmatchedCell: "border border-rose-200 bg-white/80 text-rose-900",
    },
    "tho": {
        name: "Thổ (Nâu/Cam)",
        classes: "bg-orange-50 text-orange-950",
        border: "border-orange-200",
        cardBg: "bg-white/80",
        accent: "bg-orange-700",
        accentText: "text-white",
        muted: "text-orange-700",
        inputBg: "bg-white/80",
        inputBorder: "border-orange-200",
        calledCell: "border border-orange-300 bg-orange-100 text-orange-900",
        currentCell: "bg-orange-700 text-white ring-2 ring-orange-300",
        uncalledCell: "border border-orange-100 bg-orange-50 text-orange-700",
        matchedCell: "bg-orange-700 text-white",
        unmatchedCell: "border border-orange-200 bg-white/80 text-orange-900",
    },
};
