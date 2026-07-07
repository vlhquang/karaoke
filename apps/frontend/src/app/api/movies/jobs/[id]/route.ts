import { NextResponse } from "next/server";
import { removeJob } from "@/lib/movie/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const removed = removeJob(id);
  if (!removed) return NextResponse.json({ ok: false, message: "Job not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
