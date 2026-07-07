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
        classes: "bg-amber-50 text-slate-900",
        border: "border-amber-300",
        cardBg: "bg-white/80",
        accent: "bg-amber-500",
        accentText: "text-white",
        muted: "text-amber-700/70",
        inputBg: "bg-amber-50",
        inputBorder: "border-amber-300",
        calledCell: "border border-amber-400 bg-amber-400/30 text-amber-900",
        currentCell: "bg-amber-500 text-white ring-2 ring-amber-300",
        uncalledCell: "border border-amber-200 bg-amber-50 text-amber-400",
        matchedCell: "bg-amber-500 text-white",
        unmatchedCell: "border border-amber-200 bg-white text-slate-700",
    },
    "moc": {
        name: "Mộc (Xanh lá)",
        classes: "bg-emerald-950 text-emerald-50",
        border: "border-emerald-700",
        cardBg: "bg-emerald-900/60",
        accent: "bg-emerald-500",
        accentText: "text-emerald-950",
        muted: "text-emerald-400",
        inputBg: "bg-emerald-950",
        inputBorder: "border-emerald-600",
        calledCell: "border border-emerald-400/40 bg-emerald-500/30 text-emerald-100",
        currentCell: "bg-emerald-500 text-emerald-950 ring-2 ring-emerald-300",
        uncalledCell: "border border-emerald-700/40 bg-emerald-800/60 text-emerald-500",
        matchedCell: "bg-emerald-500 text-emerald-950",
        unmatchedCell: "border border-emerald-700 bg-emerald-800 text-emerald-200",
    },
    "thuy": {
        name: "Thủy (Xanh dương/Đen)",
        classes: "bg-blue-950 text-blue-50",
        border: "border-blue-700",
        cardBg: "bg-blue-900/60",
        accent: "bg-blue-500",
        accentText: "text-blue-950",
        muted: "text-blue-400",
        inputBg: "bg-blue-950",
        inputBorder: "border-blue-600",
        calledCell: "border border-blue-400/40 bg-blue-500/30 text-blue-100",
        currentCell: "bg-blue-500 text-blue-950 ring-2 ring-blue-300",
        uncalledCell: "border border-blue-700/40 bg-blue-800/60 text-blue-500",
        matchedCell: "bg-blue-500 text-blue-950",
        unmatchedCell: "border border-blue-700 bg-blue-800 text-blue-200",
    },
    "hoa": {
        name: "Hỏa (Đỏ/Tím)",
        classes: "bg-rose-950 text-rose-50",
        border: "border-rose-700",
        cardBg: "bg-rose-900/60",
        accent: "bg-rose-500",
        accentText: "text-rose-950",
        muted: "text-rose-400",
        inputBg: "bg-rose-950",
        inputBorder: "border-rose-600",
        calledCell: "border border-rose-400/40 bg-rose-500/30 text-rose-100",
        currentCell: "bg-rose-500 text-rose-950 ring-2 ring-rose-300",
        uncalledCell: "border border-rose-700/40 bg-rose-800/60 text-rose-500",
        matchedCell: "bg-rose-500 text-rose-950",
        unmatchedCell: "border border-rose-700 bg-rose-800 text-rose-200",
    },
    "tho": {
        name: "Thổ (Nâu/Cam)",
        classes: "bg-orange-950 text-orange-50",
        border: "border-orange-700",
        cardBg: "bg-orange-900/60",
        accent: "bg-orange-500",
        accentText: "text-orange-950",
        muted: "text-orange-400",
        inputBg: "bg-orange-950",
        inputBorder: "border-orange-600",
        calledCell: "border border-orange-400/40 bg-orange-500/30 text-orange-100",
        currentCell: "bg-orange-500 text-orange-950 ring-2 ring-orange-300",
        uncalledCell: "border border-orange-700/40 bg-orange-800/60 text-orange-500",
        matchedCell: "bg-orange-500 text-orange-950",
        unmatchedCell: "border border-orange-700 bg-orange-800 text-orange-200",
    },
};
