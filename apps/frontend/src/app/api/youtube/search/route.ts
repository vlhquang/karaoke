import { NextRequest, NextResponse } from "next/server";

interface SearchResponse {
  nextPageToken?: string;
  items: Array<{
    id: { videoId?: string };
    snippet: {
      title: string;
      channelTitle: string;
      thumbnails: { medium?: { url: string }; default?: { url: string } };
    };
  }>;
}

interface VideosResponse {
  items: Array<{
    id: string;
    contentDetails: { duration: string };
  }>;
}

const durationFromISO8601 = (isoDuration: string): string => {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    return "0:00";
  }
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY ?? "";
    if (!apiKey) {
      return NextResponse.json({ message: "Missing YOUTUBE_API_KEY" }, { status: 500 });
    }

    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    const pageToken = (request.nextUrl.searchParams.get("pageToken") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json({ message: "Query too short" }, { status: 400 });
    }

    const searchParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "10",
      q: `${q} karaoke`,
      key: apiKey
    });
    if (pageToken) {
      searchParams.set("pageToken", pageToken);
    }

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`;
    const searchResp = await fetch(searchUrl, { cache: "no-store" });
    if (!searchResp.ok) {
      const upstream = await searchResp.text();
      return NextResponse.json({ message: "YouTube search failed", details: upstream }, { status: 502 });
    }

    const searchData = (await searchResp.json()) as SearchResponse;
    const videoIds = searchData.items
      .map((item) => item.id.videoId)
      .filter((videoId): videoId is string => Boolean(videoId));

    if (videoIds.length === 0) {
      return NextResponse.json({ items: [], nextPageToken: searchData.nextPageToken ?? null });
    }

    const videosUrl =
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds.join(",")}&key=${apiKey}`;
    const videosResp = await fetch(videosUrl, { cache: "no-store" });
    if (!videosResp.ok) {
      const upstream = await videosResp.text();
      return NextResponse.json({ message: "YouTube details failed", details: upstream }, { status: 502 });
    }

    const videosData = (await videosResp.json()) as VideosResponse;
    const durationMap = new Map(videosData.items.map((item) => [item.id, durationFromISO8601(item.contentDetails.duration)]));

    const items = searchData.items
      .map((item) => {
        const videoId = item.id.videoId;
        if (!videoId) {
          return null;
        }
        return {
          videoId,
          title: item.snippet.title,
          thumbnailUrl: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? "",
          channelTitle: item.snippet.channelTitle,
          duration: durationMap.get(videoId) ?? "0:00"
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({ items, nextPageToken: searchData.nextPageToken ?? null });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
