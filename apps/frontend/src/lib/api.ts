import type { YouTubeSearchItem } from "@karaoke/shared";
import { env } from "./env";

interface SearchApiResponse {
  items: YouTubeSearchItem[];
  nextPageToken?: string | null;
}

interface ApiErrorResponse {
  message?: string;
  details?: string;
}

export interface SearchYouTubeResult {
  items: YouTubeSearchItem[];
  nextPageToken: string | null;
}

export const searchYouTube = async (query: string, pageToken?: string): Promise<SearchYouTubeResult> => {
  const q = encodeURIComponent(query.trim());
  const base = env.apiBaseUrl ? env.apiBaseUrl.replace(/\/$/, "") : "";
  const tokenPart = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
  const response = await fetch(`${base}/api/youtube/search?q=${q}${tokenPart}`);
  if (!response.ok) {
    let errorBody: ApiErrorResponse | null = null;
    try {
      errorBody = (await response.json()) as ApiErrorResponse;
    } catch {
      errorBody = null;
    }
    const message = errorBody?.message ?? "YouTube search thất bại";
    const details = errorBody?.details ? `: ${errorBody.details}` : "";
    throw new Error(`${message}${details}`);
  }
  const data = (await response.json()) as SearchApiResponse;
  return {
    items: data.items,
    nextPageToken: data.nextPageToken ?? null
  };
};
