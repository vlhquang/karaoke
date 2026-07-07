import { NextResponse } from "next/server";
import { getYtDlp } from "@/lib/movie/yt-dlp-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface YtFormat {
  format_id: string;
  height?: number;
  width?: number;
  ext?: string;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
}

function heightLabel(h: number): string {
  if (h >= 2160) return "4K";
  if (h >= 1440) return "1440p QHD";
  if (h >= 1080) return "1080p FHD";
  if (h >= 720) return "720p HD";
  if (h >= 480) return "480p";
  if (h >= 360) return "360p";
  return `${h}p`;
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ ok: false, message: "Missing url" }, { status: 400 });
  }

  try {
    const ytDlp = await getYtDlp();
    const info = await ytDlp.getVideoInfo(url) as { title?: string; formats?: YtFormat[] };

    const formats: YtFormat[] = info.formats ?? [];

    // Chỉ lấy các format có video, bỏ audio-only
    const videoFormats = formats.filter(
      (f) => f.height && f.height > 0 && f.vcodec && f.vcodec !== "none"
    );

    // Deduplicate theo height, giữ format có filesize lớn nhất (chất lượng tốt hơn)
    const byHeight = new Map<number, YtFormat>();
    for (const f of videoFormats) {
      const h = f.height!;
      const existing = byHeight.get(h);
      const newSize = f.filesize ?? f.filesize_approx ?? 0;
      const existSize = existing ? (existing.filesize ?? existing.filesize_approx ?? 0) : 0;
      if (!existing || newSize > existSize) byHeight.set(h, f);
    }

    const resolutions = Array.from(byHeight.entries())
      .sort(([a], [b]) => b - a)
      .map(([height, f]) => ({
        height,
        label: heightLabel(height),
        formatId: f.format_id,
        filesize: f.filesize ?? f.filesize_approx,
        ext: f.ext ?? "mp4",
      }));

    return NextResponse.json({ ok: true, title: info.title ?? "", resolutions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
