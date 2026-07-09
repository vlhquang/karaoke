"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import VideoPlayer from "./VideoPlayer";

/* ─── Types ─────────────────────────────────────────── */
type JobStage = "pending" | "downloading" | "uploading" | "done" | "error" | "paused" | "cancelled";

interface Job {
  id: string;
  url: string;
  title: string;
  customName?: string;
  resolution?: number;
  stage: JobStage;
  downloadPercent: number;
  uploadPercent: number;
  speed?: string;
  eta?: string;
  error?: string;
  driveFileId?: string;
  driveFileName?: string;
  createdAt: string;
}

interface DriveFile {
  id: string;
  name: string;
  size: string;
  mimeType: string;
  createdTime: string;
  thumbnailLink?: string;
}

interface Resolution {
  height: number;
  label: string;
  formatId: string;
  filesize?: number;
}

// Group của các file cùng tên khác resolution
interface FileGroup {
  baseName: string;
  qualities: Array<{ height: number | null; label: string; file: DriveFile }>;
}

/* ─── Helpers ─────────────────────────────────────────── */
const STAGE_LABEL: Record<JobStage, string> = {
  pending: "Chờ xử lý",
  downloading: "Đang tải phim",
  uploading: "Đang upload Drive",
  done: "Hoàn thành",
  error: "Lỗi",
  paused: "Tạm ngừng",
  cancelled: "Đã huỷ",
};

const STAGE_COLOR: Record<JobStage, string> = {
  pending: "text-slate-400",
  downloading: "text-cyan-400",
  uploading: "text-violet-400",
  done: "text-emerald-400",
  error: "text-red-400",
  paused: "text-amber-400",
  cancelled: "text-slate-500",
};

function formatBytes(bytes: string | number | undefined): string {
  const n = Number(bytes);
  if (!n) return "—";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Tách tên file ra base + resolution: "Movie [720p].mp4" → { base: "Movie", height: 720 }
function parseFileName(name: string): { base: string; height: number | null } {
  const ext = name.lastIndexOf(".") > 0 ? name.slice(name.lastIndexOf(".")) : "";
  const withoutExt = ext ? name.slice(0, -ext.length) : name;
  const match = withoutExt.match(/^(.+?)\s*\[(\d+)p\]$/);
  if (match) return { base: match[1].trim(), height: parseInt(match[2], 10) };
  return { base: withoutExt, height: null };
}

function groupFiles(files: DriveFile[]): FileGroup[] {
  const map = new Map<string, FileGroup>();
  for (const file of files) {
    const { base, height } = parseFileName(file.name);
    if (!map.has(base)) map.set(base, { baseName: base, qualities: [] });
    const label = height ? `${height}p` : "Original";
    map.get(base)!.qualities.push({ height, label, file });
  }
  // Sort qualities desc trong mỗi group
  for (const g of map.values()) {
    g.qualities.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  }
  return Array.from(map.values());
}

// Chọn quality phù hợp với tốc độ mạng
function autoSelectQuality(qualities: FileGroup["qualities"]): number {
  if (qualities.length <= 1) return 0;
  try {
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    const type = conn?.effectiveType;
    if (type === "slow-2g" || type === "2g") {
      // Chọn thấp nhất
      return qualities.length - 1;
    }
    if (type === "3g") {
      // Chọn 480p hoặc thấp hơn
      const idx = qualities.findIndex((q) => (q.height ?? 9999) <= 480);
      return idx >= 0 ? idx : qualities.length - 1;
    }
  } catch {
    // ignore
  }
  return 0; // default: cao nhất
}

/* ─── Sub-components ─────────────────────────────────── */
function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

function JobCard({
  job,
  onRetry,
  onRemove,
  onPause,
  onCancel,
  onResume,
}: {
  job: Job;
  onRetry?: (job: Job) => void;
  onRemove?: (id: string) => void;
  onPause?: (id: string) => void;
  onCancel?: (id: string) => void;
  onResume?: (id: string) => void;
}) {
  const isFinished = job.stage === "done" || job.stage === "error" || job.stage === "cancelled";
  const isActive = job.stage === "downloading" || job.stage === "uploading" || job.stage === "paused";
  const displayTitle = job.title !== job.url
    ? job.title
    : (() => { try { return new URL(job.url).hostname; } catch { return job.url; } })();

  return (
    <div className={`rounded-xl border bg-slate-800/60 p-4 ${
      job.stage === "error" ? "border-red-500/40"
      : job.stage === "paused" ? "border-amber-500/30"
      : job.stage === "cancelled" ? "border-slate-700/50 opacity-60"
      : "border-slate-700"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-1 flex-1 text-sm font-medium text-slate-200">
          {displayTitle}
          {job.resolution && (
            <span className="ml-2 rounded bg-slate-700 px-1.5 py-0.5 text-xs text-cyan-400">
              {job.resolution}p
            </span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`text-xs font-semibold ${STAGE_COLOR[job.stage]}`}>
            {STAGE_LABEL[job.stage]}
          </span>

          {/* Active controls */}
          {job.stage === "downloading" && onPause && (
            <button onClick={() => onPause(job.id)} title="Tạm ngừng" className="rounded-lg p-1 text-slate-400 hover:bg-amber-500/20 hover:text-amber-400 transition">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
            </button>
          )}
          {job.stage === "paused" && onResume && (
            <button onClick={() => onResume(job.id)} title="Tiếp tục" className="rounded-lg p-1 text-slate-400 hover:bg-cyan-500/20 hover:text-cyan-400 transition">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
          )}
          {isActive && onCancel && (
            <button onClick={() => onCancel(job.id)} title="Huỷ tải" className="rounded-lg p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
            </button>
          )}

          {/* Finished controls */}
          {job.stage === "error" && onRetry && (
            <button onClick={() => onRetry(job)} title="Thử lại" className="rounded-lg bg-slate-700 px-2 py-0.5 text-xs text-cyan-400 hover:bg-cyan-500 hover:text-slate-900 transition">
              Thử lại
            </button>
          )}
          {isFinished && onRemove && (
            <button onClick={() => onRemove(job.id)} title="Xoá khỏi lịch sử" className="rounded-lg p-1 text-slate-500 hover:bg-slate-700 hover:text-red-400 transition">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{job.url}</p>

      {job.stage === "downloading" && (
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Tải phim {job.downloadPercent}%</span>
            {job.speed && <span>{job.speed}</span>}
            {job.eta && <span>còn {job.eta}</span>}
          </div>
          <ProgressBar percent={job.downloadPercent} color="bg-cyan-500" />
        </div>
      )}

      {job.stage === "uploading" && (
        <div className="mt-3 space-y-2">
          <div>
            <p className="text-xs text-slate-400">Tải phim 100%</p>
            <ProgressBar percent={100} color="bg-cyan-500" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Upload Drive {job.uploadPercent}%</p>
            <ProgressBar percent={job.uploadPercent} color="bg-violet-500" />
          </div>
        </div>
      )}

      {job.stage === "done" && (
        <div className="mt-2">
          <ProgressBar percent={100} color="bg-emerald-500" />
          <p className="mt-1 text-xs text-emerald-400">Đã lưu: {job.driveFileName ?? "—"}</p>
        </div>
      )}

      {job.stage === "error" && (
        <p className="mt-2 text-xs text-red-400">{job.error}</p>
      )}

      {job.stage === "paused" && (
        <div className="mt-2">
          <ProgressBar percent={job.downloadPercent} color="bg-amber-500" />
          <p className="mt-1 text-xs text-amber-400">Tạm ngừng tại {job.downloadPercent}% — nhấn ▶ để tiếp tục</p>
        </div>
      )}
    </div>
  );
}

const HISTORY_PAGE = 10;

function HistorySection({
  jobs,
  onRetry,
  onRemove,
}: {
  jobs: Job[];
  onRetry: (job: Job) => void;
  onRemove: (id: string) => void;
}) {
  const [limit, setLimit] = useState(HISTORY_PAGE);
  const visible = jobs.slice(0, limit);
  const remaining = jobs.length - limit;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
          Lịch sử
        </h2>
        <span className="text-xs text-slate-500">
          Hiện {visible.length} / {jobs.length}
        </span>
      </div>

      <div className="space-y-2">
        {visible.map((job) => (
          <JobCard key={job.id} job={job} onRetry={onRetry} onRemove={onRemove} />
        ))}
      </div>

      {remaining > 0 && (
        <button
          onClick={() => setLimit((l) => l + HISTORY_PAGE)}
          className="mt-3 w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
        >
          Xem thêm {Math.min(remaining, HISTORY_PAGE)} dòng
          <span className="ml-1 text-slate-500">({remaining} còn lại)</span>
        </button>
      )}
    </section>
  );
}

function VideoModal({
  group,
  onClose,
}: {
  group: FileGroup;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [qualityIdx, setQualityIdx] = useState(() => autoSelectQuality(group.qualities));
  const [isAuto, setIsAuto] = useState(true);

  const currentFile = group.qualities[qualityIdx]?.file;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Khi đổi quality, giữ thời gian phát
  const handleQualityChange = (idx: number) => {
    const currentTime = videoRef.current?.currentTime ?? 0;
    setIsAuto(false);
    setQualityIdx(idx);
    setTimeout(() => {
      if (videoRef.current) videoRef.current.currentTime = currentTime;
    }, 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl overflow-hidden rounded-2xl bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <p className="line-clamp-1 flex-1 text-sm font-medium text-slate-200">{group.baseName}</p>

          {/* Quality selector */}
          {group.qualities.length > 1 && (
            <div className="mx-3 flex items-center gap-1.5">
              <button
                onClick={() => { setIsAuto(true); setQualityIdx(autoSelectQuality(group.qualities)); }}
                className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                  isAuto ? "bg-cyan-500 text-slate-900" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                Auto
              </button>
              {group.qualities.map((q, i) => (
                <button
                  key={q.file.id}
                  onClick={() => handleQualityChange(i)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                    !isAuto && qualityIdx === i
                      ? "bg-cyan-500 text-slate-900"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Video */}
        {currentFile && (
          <video
            ref={videoRef}
            key={currentFile.id}
            src={`/api/movies/drive/stream/${currentFile.id}`}
            controls
            autoPlay
            className="w-full bg-black"
            style={{ maxHeight: "70vh" }}
          />
        )}

        {/* File info */}
        <div className="flex items-center gap-3 border-t border-slate-700 px-4 py-2 text-xs text-slate-500">
          <span>{group.qualities[qualityIdx]?.label}{isAuto ? " (auto)" : ""}</span>
          <span>·</span>
          <span>{formatBytes(currentFile?.size)}</span>
        </div>
      </div>
    </div>
  );
}

function DriveFileCard({
  group,
  onClick,
  onDelete,
  onRename,
  deleting,
}: {
  group: FileGroup;
  onClick: () => void;
  onDelete: (e: React.MouseEvent, fileId: string) => void;
  onRename: (fileId: string, newName: string) => Promise<void>;
  deleting: Set<string>;
}) {
  const topFile = group.qualities[0]?.file;
  const isDeletingAny = group.qualities.some((q) => deleting.has(q.file.id));
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent, fileId: string, currentName: string) => {
    e.stopPropagation();
    const { base } = parseFileName(currentName);
    setEditName(base);
    setEditingFileId(fileId);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelEdit = () => { setEditingFileId(null); setEditName(""); };

  const saveEdit = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!editingFileId || !editName.trim()) return;
    setIsSaving(true);
    try {
      // Giữ lại suffix resolution nếu có
      const q = group.qualities.find((q) => q.file.id === editingFileId);
      const ext = q ? q.file.name.slice(q.file.name.lastIndexOf(".")) : ".mp4";
      const resSuffix = q?.height ? ` [${q.height}p]` : "";
      const newFullName = `${editName.trim()}${resSuffix}${ext}`;
      await onRename(editingFileId, newFullName);
      cancelEdit();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60 transition hover:border-cyan-500/50 hover:bg-slate-800">
      {isDeletingAny && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/70 backdrop-blur-sm">
          <svg className="h-6 w-6 animate-spin text-red-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-xs text-red-300">Đang xoá...</span>
        </div>
      )}

      {/* Quality badges + actions */}
      {!isDeletingAny && (
        <div className="absolute left-2 right-2 top-2 z-10 flex items-start justify-between">
          <div className="flex flex-wrap gap-1">
            {group.qualities.map((q) => (
              <span key={q.file.id} className="rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-cyan-300">
                {q.label}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-1 opacity-0 transition group-hover:opacity-100">
            {group.qualities.map((q) => (
              <div key={q.file.id} className="flex gap-1">
                <button
                  onClick={(e) => startEdit(e, q.file.id, q.file.name)}
                  title={`Đổi tên ${q.label}`}
                  className="rounded-lg bg-black/60 p-1.5 text-slate-400 hover:bg-slate-600 hover:text-white"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => onDelete(e, q.file.id)}
                  title={`Xoá ${q.label}`}
                  className="rounded-lg bg-black/60 p-1.5 text-slate-400 hover:bg-red-600 hover:text-white"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={(e) => { if (editingFileId) { e.preventDefault(); return; } onClick(); }} className="w-full text-left">
        <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
          {topFile?.thumbnailLink ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={topFile.thumbnailLink} alt={group.baseName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl text-slate-600">🎬</div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/50">
            <div className="rounded-full bg-cyan-500 p-3 shadow-lg">
              <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Tên — inline edit hoặc hiển thị */}
        <div className="p-3" onClick={(e) => editingFileId && e.stopPropagation()}>
          {editingFileId ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") saveEdit(e); if (e.key === "Escape") cancelEdit(); }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 rounded-lg border border-cyan-500 bg-slate-700 px-2 py-1 text-xs text-white outline-none"
                disabled={isSaving}
              />
              <button onClick={saveEdit} disabled={isSaving} className="rounded-lg bg-cyan-500 p-1.5 text-slate-900 hover:bg-cyan-400 disabled:opacity-50">
                {isSaving
                  ? <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                }
              </button>
              <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="rounded-lg bg-slate-700 p-1.5 text-slate-400 hover:text-white">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          ) : (
            <p className="line-clamp-2 text-xs font-medium text-slate-200">{group.baseName}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {formatBytes(topFile?.size)} · {topFile ? new Date(topFile.createdTime).toLocaleDateString("vi-VN") : ""}
          </p>
        </div>
      </button>
    </div>
  );
}

function DriveFileRow({
  group,
  onClick,
  onDelete,
  onRename,
  deleting,
}: {
  group: FileGroup;
  onClick: () => void;
  onDelete: (e: React.MouseEvent, fileId: string) => void;
  onRename: (fileId: string, newName: string) => Promise<void>;
  deleting: Set<string>;
}) {
  const topFile = group.qualities[0]?.file;
  const isDeletingAny = group.qualities.some((q) => deleting.has(q.file.id));
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent, fileId: string, currentName: string) => {
    e.stopPropagation();
    const { base } = parseFileName(currentName);
    setEditName(base);
    setEditingFileId(fileId);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const cancelEdit = () => { setEditingFileId(null); setEditName(""); };
  const saveEdit = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!editingFileId || !editName.trim()) return;
    setIsSaving(true);
    try {
      const q = group.qualities.find((q) => q.file.id === editingFileId);
      const ext = q ? q.file.name.slice(q.file.name.lastIndexOf(".")) : ".mp4";
      const resSuffix = q?.height ? ` [${q.height}p]` : "";
      await onRename(editingFileId, `${editName.trim()}${resSuffix}${ext}`);
      cancelEdit();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`relative flex items-center gap-3 rounded-xl border bg-slate-800/60 px-3 py-2.5 transition hover:bg-slate-800 ${isDeletingAny ? "border-red-500/30" : "border-slate-700 hover:border-cyan-500/40"}`}>
      {isDeletingAny && (
        <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 rounded-xl bg-black/70 backdrop-blur-sm">
          <svg className="h-4 w-4 animate-spin text-red-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-xs text-red-300">Đang xoá...</span>
        </div>
      )}

      {/* Thumbnail */}
      <button onClick={onClick} className="group/thumb relative h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-900">
        {topFile?.thumbnailLink ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={topFile.thumbnailLink} alt={group.baseName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-600">🎬</div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition group-hover/thumb:bg-black/60">
          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </div>
      </button>

      {/* Name + qualities */}
      <div className="min-w-0 flex-1">
        {editingFileId ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") saveEdit(e); if (e.key === "Escape") cancelEdit(); }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded-lg border border-cyan-500 bg-slate-700 px-2 py-1 text-xs text-white outline-none"
              disabled={isSaving}
            />
            <button onClick={saveEdit} disabled={isSaving} className="rounded-lg bg-cyan-500 p-1.5 text-slate-900 hover:bg-cyan-400 disabled:opacity-50">
              {isSaving
                ? <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              }
            </button>
            <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="rounded-lg bg-slate-700 p-1.5 text-slate-400 hover:text-white">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        ) : (
          <button onClick={onClick} className="block max-w-full text-left">
            <p className="line-clamp-1 text-sm font-medium text-slate-200 hover:text-cyan-300">{group.baseName}</p>
          </button>
        )}
        <div className="mt-0.5 flex flex-wrap gap-1">
          {group.qualities.map((q) => (
            <span key={q.file.id} className="rounded bg-slate-700/80 px-1.5 py-0.5 text-xs font-semibold text-cyan-300">{q.label}</span>
          ))}
        </div>
      </div>

      {/* Size */}
      <div className="hidden w-20 shrink-0 text-right text-xs text-slate-500 sm:block">
        {formatBytes(topFile?.size)}
      </div>

      {/* Date */}
      <div className="hidden w-24 shrink-0 text-right text-xs text-slate-500 md:block">
        {topFile ? new Date(topFile.createdTime).toLocaleDateString("vi-VN") : ""}
      </div>

      {/* Per-quality actions */}
      <div className="flex shrink-0 items-center gap-2">
        {group.qualities.map((q) => (
          <div key={q.file.id} className="flex items-center gap-0.5">
            <button onClick={(e) => startEdit(e, q.file.id, q.file.name)} title={`Đổi tên ${q.label}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-white">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button onClick={(e) => onDelete(e, q.file.id)} title={`Xoá ${q.label}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-600/20 hover:text-red-400">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────── */
export default function XemPhimPage() {
  const [url, setUrl] = useState("");
  const [movieName, setMovieName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Resolution picker
  const [isFetchingFormats, setIsFetchingFormats] = useState(false);
  const [formatError, setFormatError] = useState("");
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [selectedRes, setSelectedRes] = useState<number | null>(null); // null = best
  const [fetchedUrl, setFetchedUrl] = useState("");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveError, setDriveError] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [playingGroup, setPlayingGroup] = useState<FileGroup | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"name" | "date">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  /* SSE */
  useEffect(() => {
    const es = new EventSource("/api/movies/progress");
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "snapshot") {
        setJobs(data.jobs);
      } else if (data.type === "job_update") {
        setJobs((prev) => {
          const idx = prev.findIndex((j) => j.id === data.job.id);
          if (idx === -1) return [data.job, ...prev];
          const next = [...prev];
          next[idx] = data.job;
          return next;
        });
        if (data.job.stage === "done") fetchDriveFiles();
      }
    };
    return () => es.close();
  }, []);

  const fetchDriveFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/movies/drive/files");
      const data = await res.json();
      if (data.ok) { setDriveFiles(data.files); setDriveError(""); }
      else setDriveError(data.message);
    } catch { setDriveError("Không kết nối được Google Drive"); }
    finally { setLoadingFiles(false); }
  }, []);

  useEffect(() => { fetchDriveFiles(); }, [fetchDriveFiles]);

  /* Lấy danh sách resolution */
  const handleFetchFormats = async () => {
    if (!url.trim()) return;
    setIsFetchingFormats(true);
    setFormatError("");
    setResolutions([]);
    setSelectedRes(null);
    setFetchedUrl(url.trim());
    try {
      const res = await fetch(`/api/movies/formats?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);
      setResolutions(data.resolutions ?? []);
      if (data.title && !movieName) setMovieName(data.title);
    } catch (err) {
      setFormatError(err instanceof Error ? err.message : "Lỗi lấy định dạng");
    } finally {
      setIsFetchingFormats(false);
    }
  };

  /* URL changed → reset formats */
  const handleUrlChange = (v: string) => {
    setUrl(v);
    if (v.trim() !== fetchedUrl) { setResolutions([]); setSelectedRes(null); setFormatError(""); }
  };

  /* Submit */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/movies/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), name: movieName.trim() || undefined, resolution: selectedRes ?? undefined }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);
      setUrl(""); setMovieName(""); setResolutions([]); setSelectedRes(null); setFetchedUrl("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* Delete Drive file */
  const handleDelete = async (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    if (!confirm("Xoá file này khỏi Google Drive?")) return;
    setDeletingIds((prev) => new Set(prev).add(fileId));
    if (playingGroup?.qualities.some((q) => q.file.id === fileId)) setPlayingGroup(null);
    try {
      await fetch(`/api/movies/drive/delete/${fileId}`, { method: "DELETE" });
      setDriveFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch { alert("Xoá thất bại, thử lại sau."); }
    finally { setDeletingIds((prev) => { const s = new Set(prev); s.delete(fileId); return s; }); }
  };

  /* Rename Drive file */
  const handleRename = async (fileId: string, newName: string) => {
    const res = await fetch(`/api/movies/drive/rename/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message);
    setDriveFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, name: data.name } : f))
    );
  };

  /* Retry failed job */
  const handleRetry = async (job: Job) => {
    try {
      const res = await fetch("/api/movies/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: job.url,
          name: job.customName || undefined,
          resolution: job.resolution || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể thử lại");
    }
  };

  /* Remove job from history */
  const handleRemoveHistory = async (id: string) => {
    await fetch(`/api/movies/jobs/${id}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const jobControl = async (id: string, action: "pause" | "cancel" | "resume") => {
    await fetch(`/api/movies/jobs/${id}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  };

  const allFileGroups = groupFiles(driveFiles);
  const q = searchQuery.trim().toLowerCase();
  const fileGroups = q
    ? allFileGroups.filter((g) => g.baseName.toLowerCase().includes(q))
    : allFileGroups;

  const toggleSort = (field: "name" | "date") => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir(field === "name" ? "asc" : "desc"); }
  };
  const displayGroups = viewMode === "list"
    ? [...fileGroups].sort((a, b) => {
        if (sortBy === "name") {
          const cmp = a.baseName.localeCompare(b.baseName, "vi");
          return sortDir === "asc" ? cmp : -cmp;
        }
        const aDate = Math.max(...a.qualities.map((qq) => new Date(qq.file.createdTime).getTime()));
        const bDate = Math.max(...b.qualities.map((qq) => new Date(qq.file.createdTime).getTime()));
        return sortDir === "asc" ? aDate - bDate : bDate - aDate;
      })
    : fileGroups;

  const activeJobs = jobs.filter((j) => j.stage !== "done" && j.stage !== "error" && j.stage !== "cancelled");
  const finishedJobs = jobs.filter((j) => j.stage === "done" || j.stage === "error" || j.stage === "cancelled");

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 md:px-8">
      {/* Header */}
      <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/40 p-6 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Thư viện</p>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">Tải & Xem Phim</h1>
        <p className="mt-1 text-sm text-slate-400">Nhập link phim, chọn chất lượng, tải và xem online qua Google Drive.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-2">
          {/* URL row */}
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.bilibili.tv/vi/video/..."
              className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={handleFetchFormats}
              disabled={!url.trim() || isFetchingFormats || isSubmitting}
              className="shrink-0 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFetchingFormats ? (
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Đang lấy...
                </span>
              ) : "Lấy chất lượng"}
            </button>
          </div>

          {formatError && <p className="text-xs text-red-400">{formatError}</p>}

          {/* Resolution selector */}
          {resolutions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedRes(null)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selectedRes === null ? "bg-cyan-500 text-slate-900" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                Tốt nhất
              </button>
              {resolutions.map((r) => (
                <button
                  key={r.height}
                  type="button"
                  onClick={() => setSelectedRes(r.height)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    selectedRes === r.height ? "bg-cyan-500 text-slate-900" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {r.label}
                  {r.filesize && <span className="ml-1 opacity-60">~{formatBytes(r.filesize)}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Name + submit row */}
          <div className="flex gap-2">
            <input
              type="text"
              value={movieName}
              onChange={(e) => setMovieName(e.target.value)}
              placeholder="Tên phim (tuỳ chọn)"
              className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting || !url.trim()}
              className="shrink-0 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Đang xử lý..." : selectedRes ? `Tải ${selectedRes}p` : "Tải phim"}
            </button>
          </div>
        </form>

        {submitError && <p className="mt-2 text-xs text-red-400">{submitError}</p>}
        <Link href="/" className="mt-5 inline-block text-xs text-slate-400 hover:text-cyan-300">← Quay lại Portal</Link>
      </div>

      {/* Active jobs */}
      {activeJobs.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Đang xử lý</h2>
          <div className="space-y-3">{activeJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onPause={(id) => jobControl(id, "pause")}
              onCancel={(id) => jobControl(id, "cancel")}
              onResume={(id) => jobControl(id, "resume")}
            />
          ))}</div>
        </section>
      )}

      {/* Drive library */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Thư viện Drive</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("grid")}
              title="Dạng lưới"
              className={`rounded-lg p-1.5 transition ${viewMode === "grid" ? "bg-slate-700 text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="Dạng danh sách"
              className={`rounded-lg p-1.5 transition ${viewMode === "list" ? "bg-slate-700 text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <button onClick={fetchDriveFiles} className="ml-2 text-xs text-slate-400 hover:text-cyan-300">Làm mới</button>
          </div>
        </div>

        {/* Search bar */}
        {allFileGroups.length > 0 && (
          <div className="relative mb-4">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Tìm trong ${allFileGroups.length} phim...`}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 py-2.5 pl-9 pr-9 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {driveError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{driveError}</div>
        ) : loadingFiles ? (
          <div className="py-12 text-center text-slate-500">Đang tải danh sách...</div>
        ) : allFileGroups.length === 0 ? (
          <div className="rounded-xl border border-slate-700 py-16 text-center text-slate-500">
            <p className="text-4xl">🎬</p>
            <p className="mt-3 text-sm">Chưa có phim nào. Nhập link để tải phim đầu tiên.</p>
          </div>
        ) : fileGroups.length === 0 ? (
          <div className="rounded-xl border border-slate-700 py-10 text-center text-slate-500">
            <p className="text-3xl">🔍</p>
            <p className="mt-3 text-sm">Không tìm thấy phim nào khớp với &quot;{searchQuery}&quot;</p>
            <button onClick={() => setSearchQuery("")} className="mt-3 text-xs text-cyan-400 hover:text-cyan-300">Xoá bộ lọc</button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {displayGroups.map((group) => (
              <DriveFileCard
                key={group.baseName}
                group={group}
                onClick={() => setPlayingGroup(group)}
                onDelete={handleDelete}
                onRename={handleRename}
                deleting={deletingIds}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* List column headers */}
            <div className="flex items-center gap-3 px-3 pb-1 text-xs font-medium text-slate-500">
              <div className="h-10 w-16 shrink-0" />
              <button onClick={() => toggleSort("name")} className={`flex flex-1 items-center gap-1 text-left transition hover:text-slate-300 ${sortBy === "name" ? "text-cyan-400" : ""}`}>
                Tên phim
                <span className="text-[10px]">{sortBy === "name" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
              </button>
              <div className="hidden w-20 shrink-0 text-right sm:block">Dung lượng</div>
              <button onClick={() => toggleSort("date")} className={`hidden w-24 shrink-0 items-center justify-end gap-1 transition hover:text-slate-300 md:flex ${sortBy === "date" ? "text-cyan-400" : ""}`}>
                Ngày upload
                <span className="text-[10px]">{sortBy === "date" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
              </button>
              <div className="shrink-0 pr-1 text-right">Thao tác</div>
            </div>
            {displayGroups.map((group) => (
              <DriveFileRow
                key={group.baseName}
                group={group}
                onClick={() => setPlayingGroup(group)}
                onDelete={handleDelete}
                onRename={handleRename}
                deleting={deletingIds}
              />
            ))}
          </div>
        )}
      </section>

      {/* History */}
      {finishedJobs.length > 0 && (
        <HistorySection
          jobs={finishedJobs}
          onRetry={handleRetry}
          onRemove={handleRemoveHistory}
        />
      )}

      {playingGroup && (
        <VideoPlayer group={playingGroup} onClose={() => setPlayingGroup(null)} />
      )}
    </main>
  );
}
