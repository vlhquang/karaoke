import { NextResponse } from "next/server";
import { pauseDownload, cancelDownload, resumeDownload } from "@/lib/movie/download-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { action } = await request.json();

  let ok = false;
  if (action === "pause") ok = pauseDownload(id);
  else if (action === "cancel") ok = cancelDownload(id);
  else if (action === "resume") ok = resumeDownload(id);
  else return NextResponse.json({ ok: false, message: "Invalid action" }, { status: 400 });

  return NextResponse.json({ ok });
}
