declare global {
  interface YouTubePlayerInstance {
    loadVideoById?: (videoId: string) => void;
    cueVideoById?: (videoId: string) => void;
    playVideo?: () => void;
    getIframe?: () => HTMLIFrameElement;
    destroy: () => void;
  }

  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          height?: string;
          width?: string;
          videoId?: string;
          playerVars?: Record<string, number>;
          events?: {
            onReady?: (event: { target: YouTubePlayerInstance }) => void;
            onStateChange?: (event: { data: number }) => void;
          };
        }
      ) => YouTubePlayerInstance;
      PlayerState: {
        ENDED: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export {};
