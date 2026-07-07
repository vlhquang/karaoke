import { NextResponse } from "next/server";
import { listDriveFiles } from "@/lib/movie/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const files = await listDriveFiles();
    return NextResponse.json({ ok: true, files });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Drive error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
