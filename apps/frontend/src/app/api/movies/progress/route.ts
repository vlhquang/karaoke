import { movieEmitter, getAllJobs } from "@/lib/movie/job-store";
import type { Job } from "@/lib/movie/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // client disconnected
        }
      };

      // Send current state immediately on connect
      send({ type: "snapshot", jobs: getAllJobs() });

      const onUpdate = (job: Job) => send({ type: "job_update", job });
      movieEmitter.on("job_update", onUpdate);

      // Keep-alive every 25s
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 25_000);

      // Cleanup on close
      const cleanup = () => {
        movieEmitter.off("job_update", onUpdate);
        clearInterval(keepAlive);
      };

      // Store cleanup on the controller for cancel
      (controller as unknown as { _cleanup: () => void })._cleanup = cleanup;
    },
    cancel(controller) {
      const c = controller as unknown as { _cleanup?: () => void };
      c._cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
