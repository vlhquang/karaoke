import { NextResponse } from "next/server";
import { z } from "zod";
import { renameDriveFile } from "@/lib/movie/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().trim().min(1).max(255) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  try {
    const body = await request.json();
    const { name } = schema.parse(body);
    const newName = await renameDriveFile(fileId, name);
    return NextResponse.json({ ok: true, name: newName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rename error";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
