import { EventEmitter } from "events";

export type JobStage = "pending" | "downloading" | "uploading" | "done" | "error" | "paused" | "cancelled";

export interface Job {
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
  updatedAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __movieJobStore: Map<string, Job> | undefined;
  // eslint-disable-next-line no-var
  var __movieEmitter: EventEmitter | undefined;
}

export const jobStore: Map<string, Job> =
  globalThis.__movieJobStore ?? (globalThis.__movieJobStore = new Map());

export const movieEmitter: EventEmitter =
  globalThis.__movieEmitter ?? (globalThis.__movieEmitter = new EventEmitter());

movieEmitter.setMaxListeners(50);

export function updateJob(id: string, patch: Partial<Job>): void {
  const job = jobStore.get(id);
  if (!job) return;
  const updated = { ...job, ...patch, updatedAt: new Date().toISOString() };
  jobStore.set(id, updated);
  movieEmitter.emit("job_update", updated);
}

export function removeJob(id: string): boolean {
  return jobStore.delete(id);
}

export function getAllJobs(): Job[] {
  return Array.from(jobStore.values()).sort((a, b) => {
    // error luôn lên đầu
    if (a.stage === "error" && b.stage !== "error") return -1;
    if (b.stage === "error" && a.stage !== "error") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
