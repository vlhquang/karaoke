import { streamDriveFile } from "@/lib/movie/drive-service";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const rangeHeader = request.headers.get("Range");

  try {
    const result = await streamDriveFile(fileId, rangeHeader);
    const webStream = Readable.toWeb(result.stream as import("stream").Readable) as ReadableStream;
    return new Response(webStream, { status: result.status, headers: result.headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stream error";
    return new Response(JSON.stringify({ ok: false, message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
