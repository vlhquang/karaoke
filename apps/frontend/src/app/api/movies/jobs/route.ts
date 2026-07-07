import { NextResponse } from "next/server";
import { getAllJobs } from "@/lib/movie/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, jobs: getAllJobs() });
}
