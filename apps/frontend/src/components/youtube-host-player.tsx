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
    playVideo?: () => void;
    getIframe?: () => HTMLIFrameElement;
    destroy: () => void;
  } | null>(null);
  const onEndedRef = useRef(onEnded);
  const readyRef = useRef(false);
  const latestVideoIdRef = useRef<string | null>(videoId);
  const containerId = useId().replace(/:/g, "_");

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const syncVideoToPlayer = (id: string | null): void => {
    if (!readyRef.current || !isValidVideoId(id) || !playerRef.current) {
      return;
    }

    const player = playerRef.current as Record<string, unknown>;
    const load = player.loadVideoById;
    if (typeof load === "function") {
      load.call(playerRef.current, id);
      const play = player.playVideo;
      if (typeof play === "function") {
        play.call(playerRef.current);
      }
      return;
    }

    const cue = player.cueVideoById;
    if (typeof cue === "function") {
      cue.call(playerRef.current, id);
      const play = player.playVideo;
      if (typeof play === "function") {
        play.call(playerRef.current);
      }
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
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 1,
          fs: 1,
          playsinline: 0,
          iv_load_policy: 3,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target as {
              loadVideoById?: (id: string) => void;
              cueVideoById?: (id: string) => void;
              playVideo?: () => void;
              getIframe?: () => HTMLIFrameElement;
              destroy: () => void;
            };

            const iframe = playerRef.current.getIframe?.();
            if (iframe) {
              iframe.setAttribute("allowfullscreen", "true");
              iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
            }
            readyRef.current = true;
            syncVideoToPlayer(latestVideoIdRef.current);
          },
          onStateChange: (event) => {
            if (window.YT?.PlayerState && event.data === window.YT.PlayerState.ENDED) {
              onEndedRef.current();
              return;
            }
            if (window.YT?.PlayerState && event.data === window.YT.PlayerState.CUED) {
              playerRef.current?.playVideo?.();
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
  }, [containerId]);

  useEffect(() => {
    latestVideoIdRef.current = videoId;
    syncVideoToPlayer(videoId);
  }, [videoId]);

  return <div id={containerId} className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-700 bg-black" />;
};
