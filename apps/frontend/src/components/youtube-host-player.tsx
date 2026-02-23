"use client";

import { useEffect, useId, useRef } from "react";

interface Props {
  videoId: string | null;
  onEnded: () => void;
}

const isValidVideoId = (id: string | null): id is string => Boolean(id && /^[a-zA-Z0-9_-]{11}$/.test(id));

export const YouTubeHostPlayer = ({ videoId, onEnded }: Props) => {
  const playerRef = useRef<{
    loadVideoById?: (id: string) => void;
    cueVideoById?: (id: string) => void;
    destroy: () => void;
  } | null>(null);
  const readyRef = useRef(false);
  const latestVideoIdRef = useRef<string | null>(videoId);
  const containerId = useId().replace(/:/g, "_");

  const syncVideoToPlayer = (id: string | null): void => {
    if (!readyRef.current || !isValidVideoId(id) || !playerRef.current) {
      return;
    }

    const player = playerRef.current as Record<string, unknown>;
    const load = player.loadVideoById;
    if (typeof load === "function") {
      load.call(playerRef.current, id);
      return;
    }

    const cue = player.cueVideoById;
    if (typeof cue === "function") {
      cue.call(playerRef.current, id);
    }
  };

  useEffect(() => {
    const createPlayer = () => {
      if (!window.YT?.Player || playerRef.current) {
        return;
      }

      const options: {
        width: string;
        height: string;
        videoId?: string;
        playerVars: Record<string, number>;
        events: {
          onReady: (event: { target: { destroy: () => void } }) => void;
          onStateChange: (event: { data: number }) => void;
        };
      } = {
        width: "100%",
        height: "420",
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target as {
              loadVideoById?: (id: string) => void;
              cueVideoById?: (id: string) => void;
              destroy: () => void;
            };
            readyRef.current = true;
            syncVideoToPlayer(latestVideoIdRef.current);
          },
          onStateChange: (event) => {
            if (window.YT?.PlayerState && event.data === window.YT.PlayerState.ENDED) {
              onEnded();
            }
          }
        }
      };

      if (isValidVideoId(videoId)) {
        options.videoId = videoId;
      }

      playerRef.current = new window.YT.Player(containerId, options);
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const scriptId = "youtube-iframe-api";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }

      window.onYouTubeIframeAPIReady = () => {
        createPlayer();
      };
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      readyRef.current = false;
    };
  }, [containerId, onEnded]);

  useEffect(() => {
    latestVideoIdRef.current = videoId;
    syncVideoToPlayer(videoId);
  }, [videoId]);

  return <div id={containerId} className="w-full overflow-hidden rounded-2xl border border-slate-700 bg-black" />;
};
