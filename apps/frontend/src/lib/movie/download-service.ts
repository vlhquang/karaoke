import fs from "fs";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getYtDlp } from "./yt-dlp-manager";
import { uploadToDrive } from "./drive-service";
import { jobStore, updateJob } from "./job-store";
import type { Job } from "./job-store";

const TMP_DIR = path.join(os.tmpdir(), "movies");

interface ProcessEntry {
  abort: (mode: "pause" | "cancel") => void;
}

declare global {
  // eslint-disable-next-line no-var
  var __movieProcessStore: Map<string, ProcessEntry> | undefined;
}

const processStore: Map<string, ProcessEntry> =
  globalThis.__movieProcessStore ?? (globalThis.__movieProcessStore = new Map());

export async function enqueueDownload(url: string, customName?: string, resolution?: number): Promise<Job> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const job: Job = {
    id,
    url,
    title: customName || url,
    customName,
    resolution,
    stage: "pending",
    downloadPercent: 0,
    uploadPercent: 0,
    createdAt: now,
    updatedAt: now,
  };
  jobStore.set(id, job);
  processJob(id, url, resolution).catch(() => {});
  return job;
}

export function pauseDownload(id: string): boolean {
  const entry = processStore.get(id);
  const job = jobStore.get(id);
  if (!entry || !job || job.stage !== "downloading") return false;
  entry.abort("pause");
  return true;
}

export function cancelDownload(id: string): boolean {
  const entry = processStore.get(id);
  const job = jobStore.get(id);
  if (!job) return false;
  if (entry) {
    entry.abort("cancel");
  } else if (job.stage === "paused") {
    cleanupTempFiles(id);
    updateJob(id, { stage: "cancelled" });
  }
  return true;
}

export function resumeDownload(id: string): boolean {
  const job = jobStore.get(id);
  if (!job || job.stage !== "paused") return false;
  processJob(id, job.url, job.resolution, true).catch(() => {});
  return true;
}

function buildFormatArg(resolution?: number): string {
  if (!resolution) return "bestvideo+bestaudio/best";
  return [
    `bestvideo[height<=${resolution}][ext=mp4]+bestaudio[ext=m4a]`,
    `bestvideo[height<=${resolution}]+bestaudio`,
    `best[height<=${resolution}]`,
    "best",
  ].join("/");
}

function cleanupTempFiles(id: string): void {
  try {
    const files = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith(id));
    for (const f of files) {
      try { fs.unlinkSync(path.join(TMP_DIR, f)); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

async function processJob(id: string, url: string, resolution?: number, resume = false): Promise<void> {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const outputTemplate = path.join(TMP_DIR, `${id}_%(title)s.%(ext)s`);
  let downloadedPath: string | null = null;

  // Ref object: each `.current` read is treated as a fresh read by TypeScript,
  // preventing accumulated CFA narrowing across closure assignments
  const cancelMode = { current: "none" as "none" | "pause" | "cancel" };
  const abortController = new AbortController();
  const uploadSignal = { cancelled: false };

  try {
    updateJob(id, { stage: "downloading", downloadPercent: 0, speed: undefined, eta: undefined });

    const ytDlp = await getYtDlp();

    await new Promise<void>((resolve, reject) => {
      const emitter = ytDlp.exec(
        [
          url,
          "-o", outputTemplate,
          "--format", buildFormatArg(resolution),
          "--merge-output-format", "mp4",
          "--no-playlist",
          "--no-warnings",
          ...(resume ? ["--continue"] : []),
        ],
        {},
        abortController.signal,
      );

      processStore.set(id, {
        abort: (mode) => {
          cancelMode.current = mode;
          abortController.abort();
        },
      });

      emitter.on("progress", (progress: { percent?: number; currentSpeed?: string; eta?: string }) => {
        if (cancelMode.current === "none") {
          updateJob(id, {
            downloadPercent: Math.round(progress.percent ?? 0),
            speed: progress.currentSpeed,
            eta: progress.eta,
          });
        }
      });

      // ytDlpProcess.killed → emits "close" not "error" (per yt-dlp-wrap source)
      emitter.on("error", (err: Error) => reject(err));
      emitter.on("close", () => resolve());
    });

    processStore.delete(id);

    // Re-read into local variable at each check point to avoid TypeScript CFA narrowing
    const modeAfterDownload = cancelMode.current;
    if (modeAfterDownload === "pause") {
      updateJob(id, { stage: "paused" });
      return;
    }
    if (modeAfterDownload === "cancel") {
      cleanupTempFiles(id);
      updateJob(id, { stage: "cancelled" });
      return;
    }

    const files = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith(id) && !f.endsWith(".part"));
    if (!files.length) throw new Error("Downloaded file not found");
    downloadedPath = path.join(TMP_DIR, files[0]);

    const ext = path.extname(downloadedPath) || ".mp4";
    const job = jobStore.get(id)!;

    let displayTitle: string;
    if (job.customName) {
      displayTitle = job.customName;
    } else {
      const basename = path.basename(downloadedPath, ext);
      displayTitle = basename.slice(id.length + 1) || id;
      updateJob(id, { title: displayTitle });
    }

    const resSuffix = resolution ? ` [${resolution}p]` : "";
    const safeTitle = displayTitle.replace(/[/\\:*?"<>|]/g, "_");
    const fileName = `${safeTitle}${resSuffix}${ext}`;

    updateJob(id, { stage: "uploading", downloadPercent: 100 });

    processStore.set(id, {
      abort: (mode) => {
        cancelMode.current = mode;
        uploadSignal.cancelled = true;
      },
    });

    const { id: driveFileId, name: driveFileName } = await uploadToDrive(
      downloadedPath,
      fileName,
      (percent) => updateJob(id, { uploadPercent: percent }),
      uploadSignal,
    );

    processStore.delete(id);

    const modeAfterUpload = cancelMode.current;
    if (modeAfterUpload === "cancel") {
      updateJob(id, { stage: "cancelled" });
      return;
    }

    updateJob(id, { stage: "done", uploadPercent: 100, driveFileId, driveFileName });
  } catch (err) {
    const modeFinal = cancelMode.current;
    if (modeFinal === "cancel") {
      updateJob(id, { stage: "cancelled" });
    } else if (modeFinal === "none") {
      const message = err instanceof Error ? err.message : String(err);
      updateJob(id, { stage: "error", error: message });
    }
  } finally {
    processStore.delete(id);
    if (cancelMode.current !== "pause" && downloadedPath && fs.existsSync(downloadedPath)) {
      try { fs.unlinkSync(downloadedPath); } catch { /* ignore */ }
    }
  }
}
