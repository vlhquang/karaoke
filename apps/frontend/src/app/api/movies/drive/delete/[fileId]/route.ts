import { NextResponse } from "next/server";
import { deleteDriveFile } from "@/lib/movie/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  try {
    await deleteDriveFile(fileId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
