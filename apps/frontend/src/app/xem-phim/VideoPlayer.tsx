"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ─── Types (local — structural typing matches page.tsx) ─── */
interface DriveFile {
  id: string;
  name: string;
  size: string;
  mimeType: string;
  createdTime: string;
  thumbnailLink?: string;
}

interface FileGroup {
  baseName: string;
  qualities: Array<{ height: number | null; label: string; file: DriveFile }>;
}

/* ─── Helpers ──────────────────────────────────────── */
function formatBytes(bytes: string | number | undefined): string {
  const n = Number(bytes);
  if (!n) return "—";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatTime(s: number): string {
  if (!s || !isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function autoSelectQuality(qualities: FileGroup["qualities"]): number {
  if (qualities.length <= 1) return 0;
  try {
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    const type = conn?.effectiveType;
    if (type === "slow-2g" || type === "2g") return qualities.length - 1;
    if (type === "3g") {
      const idx = qualities.findIndex((q) => (q.height ?? 9999) <= 480);
      return idx >= 0 ? idx : qualities.length - 1;
    }
  } catch {
    // ignore
  }
  return 0; // default: cao nhất (phù hợp TV có WiFi mạnh)
}

/* ─── VideoPlayer ─────────────────────────────────── */
export default function VideoPlayer({
  group,
  onClose,
}: {
  group: FileGroup;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeLockRef = useRef<any>(null);
  const seekTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [qualityIdx, setQualityIdx] = useState(() => autoSelectQuality(group.qualities));
  const [isAuto, setIsAuto] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [seekIndicator, setSeekIndicator] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const currentFile = group.qualities[qualityIdx]?.file;
  const STORAGE_KEY = `xp_pos_${group.baseName}`;

  /* ── Wake Lock — ngăn màn hình tắt khi xem phim ── */
  useEffect(() => {
    const req = async () => {
      try {
        if ("wakeLock" in navigator) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch {
        /* ignore — not supported or denied */
      }
    };
    req();
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isPlaying) req();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      wakeLockRef.current?.release?.();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isPlaying]);

  /* ── Restore position khi video load xong ── */
  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setIsBuffering(false);
    setHasError(false);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const pos = parseFloat(saved);
      if (pos > 5 && pos < v.duration - 10) v.currentTime = pos;
    }
  }, [STORAGE_KEY]);

  /* ── Save position mỗi 3 giây ── */
  useEffect(() => {
    const iv = setInterval(() => {
      const v = videoRef.current;
      if (v && v.currentTime > 0) {
        localStorage.setItem(STORAGE_KEY, String(v.currentTime));
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [STORAGE_KEY]);

  /* ── Auto-hide overlay sau 4 giây ── */
  const resetHideTimer = useCallback(() => {
    setShowOverlay(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowOverlay(false), 4000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimerRef.current);
  }, [resetHideTimer]);

  /* ── Cleanup seek indicator timer ── */
  useEffect(() => {
    return () => clearTimeout(seekTimerRef.current);
  }, []);

  /* ── Video events ── */
  const handlePlay = () => { setIsPlaying(true); resetHideTimer(); };
  const handlePause = () => { setIsPlaying(false); setShowOverlay(true); clearTimeout(hideTimerRef.current); };
  const handleTimeUpdate = () => { if (videoRef.current) setProgress(videoRef.current.currentTime); };
  const handleWaiting = () => setIsBuffering(true);
  const handleCanPlay = () => setIsBuffering(false);
  const handleEnded = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsPlaying(false);
    setShowOverlay(true);
  };
  const handleError = () => setHasError(true);

  /* ── Fullscreen toggle ── */
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }, []);

  /* ── Seek feedback hiển thị ngắn ── */
  const showSeekFeedback = useCallback((text: string) => {
    setSeekIndicator(text);
    clearTimeout(seekTimerRef.current);
    seekTimerRef.current = setTimeout(() => setSeekIndicator(null), 800);
  }, []);

  /* ── Keyboard shortcuts (TV remote + bàn phím) ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      resetHideTimer();
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case " ":
        case "Enter":
          e.preventDefault();
          v.paused ? v.play() : v.pause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          showSeekFeedback("−10s");
          break;
        case "ArrowRight":
          e.preventDefault();
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          showSeekFeedback("+10s");
          break;
        case "ArrowUp":
          e.preventDefault();
          v.volume = Math.min(1, v.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          v.volume = Math.max(0, v.volume - 0.1);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "m":
        case "M":
          v.muted = !v.muted;
          setIsMuted(v.muted);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, resetHideTimer, toggleFullscreen, showSeekFeedback]);

  /* ── Quality change — lưu vị trí rồi đổi source ── */
  const handleQualityChange = (idx: number) => {
    const ct = videoRef.current?.currentTime ?? 0;
    localStorage.setItem(STORAGE_KEY, String(ct));
    setIsAuto(false);
    setQualityIdx(idx);
    setIsBuffering(true);
    setHasError(false);
  };

  /* ── Seek bằng click progress bar ── */
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onClick={() => {
        const v = videoRef.current;
        if (v) v.paused ? v.play() : v.pause();
        resetHideTimer();
      }}
    >
      {/* Video — toàn màn hình */}
      {currentFile && (
        <video
          ref={videoRef}
          key={currentFile.id}
          src={`/api/movies/drive/stream/${currentFile.id}`}
          controls={false}
          autoPlay
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={handleTimeUpdate}
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
          onEnded={handleEnded}
          onError={handleError}
        />
      )}

      {/* Loading spinner */}
      {isBuffering && !hasError && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-cyan-400" />
        </div>
      )}

      {/* Error message */}
      {hasError && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="rounded-2xl bg-red-500/20 px-8 py-6 text-center backdrop-blur-sm">
            <p className="text-lg font-semibold text-red-400">Không thể phát video</p>
            <p className="mt-2 text-sm text-red-300/70">Kiểm tra kết nối mạng và thử lại</p>
          </div>
        </div>
      )}

      {/* Seek indicator (−10s / +10s) */}
      {seekIndicator && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="rounded-2xl bg-black/70 px-8 py-4 text-3xl font-bold text-white backdrop-blur-sm">
            {seekIndicator}
          </div>
        </div>
      )}

      {/* Center play button khi tạm dừng */}
      {!isPlaying && !isBuffering && !hasError && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-full bg-cyan-500/80 p-6 shadow-2xl">
            <svg className="h-12 w-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* ── Overlay controls — tự ẩn sau 4 giây ── */}
      <div
        className={`absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-500 ${
          showOverlay ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="bg-gradient-to-b from-black/70 to-transparent px-4 pb-16 pt-4 md:px-6 md:pt-5">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400 md:px-4 md:py-2.5 md:text-base"
              tabIndex={0}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Quay lại</span>
            </button>

            <p className="mx-3 flex-1 truncate text-center text-base font-semibold text-white drop-shadow-lg md:text-xl lg:text-2xl">
              {group.baseName}
            </p>

            <button
              onClick={toggleFullscreen}
              className="rounded-xl bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400 md:p-2.5"
              title="Toàn màn hình (F)"
              tabIndex={0}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-16 md:px-6 md:pb-6">
          {/* Progress bar */}
          <div
            className="group/prog mb-3 h-1.5 w-full cursor-pointer rounded-full bg-white/20 transition-all hover:h-3 md:mb-4"
            onClick={handleProgressClick}
          >
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-150"
              style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 md:gap-4">
            {/* Left: playback controls */}
            <div className="flex items-center gap-1.5 md:gap-2">
              {/* Play/Pause */}
              <button
                onClick={(e) => { e.stopPropagation(); const v = videoRef.current; if (v) v.paused ? v.play() : v.pause(); }}
                className="rounded-xl bg-white/10 p-2.5 text-white backdrop-blur-sm transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400 md:p-3"
                tabIndex={0}
              >
                {isPlaying ? (
                  <svg className="h-5 w-5 md:h-6 md:w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
                ) : (
                  <svg className="h-5 w-5 md:h-6 md:w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>

              {/* Rewind 10s */}
              <button
                onClick={(e) => { e.stopPropagation(); const v = videoRef.current; if (v) { v.currentTime = Math.max(0, v.currentTime - 10); showSeekFeedback("−10s"); } }}
                className="rounded-xl bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400 md:p-2.5"
                title="Lùi 10s (←)"
                tabIndex={0}
              >
                <svg className="h-4 w-4 md:h-5 md:w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6L11 18zm.5-6l8.5 6V6l-8.5 6z"/></svg>
              </button>

              {/* Forward 10s */}
              <button
                onClick={(e) => { e.stopPropagation(); const v = videoRef.current; if (v) { v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); showSeekFeedback("+10s"); } }}
                className="rounded-xl bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400 md:p-2.5"
                title="Tiến 10s (→)"
                tabIndex={0}
              >
                <svg className="h-4 w-4 md:h-5 md:w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
              </button>

              {/* Mute */}
              <button
                onClick={(e) => { e.stopPropagation(); const v = videoRef.current; if (v) { v.muted = !v.muted; setIsMuted(v.muted); } }}
                className="hidden rounded-xl bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400 sm:block md:p-2.5"
                title="Tắt/bật tiếng (M)"
                tabIndex={0}
              >
                {isMuted ? (
                  <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>

              {/* Time */}
              <span className="ml-1 text-xs font-medium text-white/70 md:ml-2 md:text-sm">
                {formatTime(progress)}
                <span className="text-white/40"> / </span>
                {formatTime(duration)}
              </span>
            </div>

            {/* Right: quality selector + file size */}
            <div className="flex items-center gap-2 md:gap-3">
              {group.qualities.length > 1 && (
                <div className="flex items-center gap-1 md:gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsAuto(true); setQualityIdx(autoSelectQuality(group.qualities)); }}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-400 md:px-3 md:py-2 md:text-sm ${
                      isAuto ? "bg-cyan-500 text-slate-900" : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                    tabIndex={0}
                  >
                    Auto
                  </button>
                  {group.qualities.map((q, i) => (
                    <button
                      key={q.file.id}
                      onClick={(e) => { e.stopPropagation(); handleQualityChange(i); }}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-400 md:px-3 md:py-2 md:text-sm ${
                        !isAuto && qualityIdx === i
                          ? "bg-cyan-500 text-slate-900"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                      tabIndex={0}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
              <span className="hidden text-xs text-white/40 md:inline">{formatBytes(currentFile?.size)}</span>
            </div>
          </div>

          {/* Keyboard hints — hiện trên màn hình lớn (TV/desktop) */}
          <div className="mt-2 hidden items-center justify-center gap-3 text-xs text-white/25 lg:flex">
            <span>Space: Play/Pause</span>
            <span>·</span>
            <span>←→: ±10 giây</span>
            <span>·</span>
            <span>↑↓: Âm lượng</span>
            <span>·</span>
            <span>F: Toàn màn hình</span>
            <span>·</span>
            <span>M: Tắt tiếng</span>
            <span>·</span>
            <span>Esc: Đóng</span>
          </div>
        </div>
      </div>
    </div>
  );
}
