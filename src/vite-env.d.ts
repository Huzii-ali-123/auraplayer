/// <reference types="vite/client" />
interface Window {
  onSpotifyWebPlaybackSDKReady?: () => void;
  Spotify?: { Player: new(options: { name: string; getOAuthToken: (cb: (token: string) => void) => void; volume: number }) => SpotifyPlayer };
  onYouTubeIframeAPIReady?: () => void;
  YT?: {
    Player: new(element: HTMLElement, options: {
      width: string; height: string; videoId?: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: { target: import('./youtube/source').YouTubePlayerApi }) => void;
        onStateChange: (event: { data: number }) => void;
        onError: (event: { data: number }) => void;
      };
    }) => import('./youtube/source').YouTubePlayerApi;
    PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number; UNSTARTED: number };
  };
}
interface SpotifyPlayer {
  connect: () => Promise<boolean>; disconnect: () => void;
  addListener: (event: string, callback: (data: any) => void) => boolean;
  getCurrentState: () => Promise<any>; togglePlay: () => Promise<void>;
  pause: () => Promise<void>; resume: () => Promise<void>;
  nextTrack: () => Promise<void>; previousTrack: () => Promise<void>;
  seek: (ms: number) => Promise<void>; setVolume: (v: number) => Promise<void>;
  activateElement: () => Promise<void>;
}
