import type { SourceState, Track } from '../player/types';
import type { PlayerSource } from '../player/source';

export type YouTubePlayerApi = {
  playVideo(): void; pauseVideo(): void; loadVideoById(videoId: string): void; cueVideoById(videoId: string): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void; nextVideo(): void; previousVideo(): void;
  setVolume(volume: number): void; getCurrentTime(): number; getDuration(): number;
  getPlayerState(): number; destroy(): void;
};
let apiPromise: Promise<void> | null = null;
export function loadYouTubeIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previousReady?.(); resolve(); };
    let script = document.querySelector<HTMLScriptElement>('script[data-auraplayer-youtube-api]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.auraplayerYoutubeApi = 'true';
      script.onerror = () => { apiPromise = null; reject(new Error('Could not load YouTube’s player API.')); };
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}

export class YouTubeSource implements PlayerSource {
  private player: YouTubePlayerApi | null = null;
  private readyResolve: (() => void) | null = null;
  private readyPromise = new Promise<void>(resolve => { this.readyResolve = resolve; });
  private listeners = new Set<(state: SourceState) => void>();
  private positionMs = 0;
  private durationMs = 0;
  private pollTimer: number | undefined;
  private state = -1;
  private hasLoadedVideo = false;
  private onEnded: (() => void) | null = null;
  private onError: (() => void) | null = null;
  private onNext: (() => void) | null = null;
  private onPrevious: (() => void) | null = null;
  private onReady: (() => void) | null = null;
  private initialized = false;

  setCallbacks(callbacks: { onEnded?: () => void; onError?: () => void; onNext?: () => void; onPrevious?: () => void; onReady?: () => void }) {
    this.onEnded = callbacks.onEnded || null;
    this.onError = callbacks.onError || null;
    this.onNext = callbacks.onNext || null;
    this.onPrevious = callbacks.onPrevious || null;
    this.onReady = callbacks.onReady || null;
  }
  async mount(element: HTMLElement) {
    if (this.initialized) return;
    this.initialized = true;
    try {
      await loadYouTubeIframeApi();
      const YT = window.YT;
      if (!YT) throw new Error('YouTube’s player API did not initialize.');
      new YT.Player(element, {
        width: '640', height: '360',
        playerVars: {
          enablejsapi: 1, playsinline: 1, controls: 0, rel: 0, modestbranding: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event: { target: YouTubePlayerApi }) => this.attach(event.target),
          onStateChange: (event: { data: number }) => this.handleState(event.data),
          onError: (event: { data: number }) => this.handleError(event.data)
        }
      });
    } catch (error) {
      this.initialized = false;
      this.readyResolve?.();
      this.readyResolve = null;
      this.emit({ playing: false, positionMs: 0, durationMs: 0, error: error instanceof Error ? error.message : 'YouTube player failed to load.' });
    }
  }
  attach(player: YouTubePlayerApi) { this.player = player; this.readyResolve?.(); this.readyResolve = null; this.onReady?.(); }
  handleState(state: number) {
    this.state = state;
    if (state === 1) {
      this.durationMs = Math.round((this.player?.getDuration() || 0) * 1000);
      this.positionMs = Math.round((this.player?.getCurrentTime() || 0) * 1000);
      if (this.pollTimer) window.clearInterval(this.pollTimer);
      this.pollTimer = window.setInterval(() => {
        if (this.state !== 1 || !this.player) return;
        this.positionMs = Math.round(this.player.getCurrentTime() * 1000);
        this.durationMs = Math.round(this.player.getDuration() * 1000);
        this.emit({ playing: true, positionMs: this.positionMs, durationMs: this.durationMs });
      }, 250);
      this.emit({ playing: true, positionMs: this.positionMs, durationMs: this.durationMs });
    } else {
      if (this.pollTimer) window.clearInterval(this.pollTimer);
      this.pollTimer = undefined;
      this.positionMs = Math.round((this.player?.getCurrentTime() || 0) * 1000);
      if (state === 0) {
        this.emit({ playing: false, positionMs: this.positionMs, durationMs: this.durationMs, ended: true });
        this.onEnded?.();
      } else if (state === 2 || state === 3 || state === 5 || state === -1) {
        this.emit({ playing: false, positionMs: this.positionMs, durationMs: this.durationMs });
      }
    }
  }
  handleError(code: number) {
    const skippable = [2, 5, 100, 101, 150].includes(code);
    const message = skippable
      ? `This video can’t be embedded or played here (YouTube error ${code}). Skipping to the next queued video.`
      : `YouTube player reported an error (${code}). Try another video.`;
    this.emit({ playing: false, positionMs: this.positionMs, durationMs: this.durationMs, error: message });
    if (skippable) this.onError?.();
  }
  async play(track: Track) {
    await this.readyPromise;
    if (!this.player || !track.videoId) throw new Error('YouTube player is not ready.');
    this.hasLoadedVideo = true;
    this.player.loadVideoById(track.videoId);
  }
  async cue(track: Track) {
    await this.readyPromise;
    if (!this.player || !track.videoId) throw new Error('YouTube player is not ready.');
    this.hasLoadedVideo = true;
    this.player.cueVideoById(track.videoId);
  }
  hasMedia() { return this.hasLoadedVideo; }
  async pause() { await this.readyPromise; this.player?.pauseVideo(); }
  async resume() { await this.readyPromise; this.player?.playVideo(); }
  async next() { this.onNext?.(); }
  async previous() { this.onPrevious?.(); }
  async seek(ms: number) { await this.readyPromise; this.player?.seekTo(Math.max(0, ms) / 1000, true); }
  async setVolume(value: number) { await this.readyPromise; this.player?.setVolume(Math.max(0, Math.min(1, value)) * 100); }
  getPositionMs() { return this.positionMs; }
  onStateChange(callback: (state: SourceState) => void) { this.listeners.add(callback); return () => this.listeners.delete(callback); }
  emit(state: SourceState) { for (const callback of this.listeners) callback(state); }
  destroy() { if (this.pollTimer) window.clearInterval(this.pollTimer); this.player?.destroy(); this.player = null; }
}
