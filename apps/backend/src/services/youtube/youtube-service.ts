import { env } from "../../config/env.js";
import type { YouTubeSearchItem } from "@karaoke/shared";

interface SearchResponse {
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

  const totalMinutes = hours * 60 + minutes;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${totalMinutes}:${String(seconds).padStart(2, "0")}`;
};

export class YouTubeService {
  async searchKaraoke(query: string): Promise<YouTubeSearchItem[]> {
    if (!env.YOUTUBE_API_KEY) {
      throw new Error("Missing YOUTUBE_API_KEY");
    }

    const encodedQ = encodeURIComponent(`${query} karaoke`);
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodedQ}&key=${env.YOUTUBE_API_KEY}`;

    const searchResp = await fetch(searchUrl);
    if (!searchResp.ok) {
      throw new Error("YouTube search failed");
    }

    const searchData = (await searchResp.json()) as SearchResponse;
    const videoIds = searchData.items
      .map((item) => item.id.videoId)
      .filter((videoId): videoId is string => Boolean(videoId));

    if (videoIds.length === 0) {
      return [];
    }

    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds.join(",")}&key=${env.YOUTUBE_API_KEY}`;
    const videosResp = await fetch(videosUrl);
    if (!videosResp.ok) {
      throw new Error("YouTube video details failed");
    }

    const videosData = (await videosResp.json()) as VideosResponse;
    const durationByVideoId = new Map(videosData.items.map((item) => [item.id, durationFromISO8601(item.contentDetails.duration)]));

    return searchData.items
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
          duration: durationByVideoId.get(videoId) ?? "0:00"
        };
      })
      .filter((item): item is YouTubeSearchItem => item !== null);
  }
}
