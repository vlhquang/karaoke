import { NextResponse } from "next/server";
import { z } from "zod";
import { enqueueDownload } from "@/lib/movie/download-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  url: z.string().url(),
  name: z.string().trim().max(200).optional(),
  resolution: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, name, resolution } = schema.parse(body);
    const job = await enqueueDownload(url, name || undefined, resolution);
    return NextResponse.json({ ok: true, job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
