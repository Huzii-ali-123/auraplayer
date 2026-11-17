import { spotifyProvider } from '../providers/spotify';
import type { ProgressState } from '../components/WheelPlayer';
import type { SourceState, Track } from './types';

export interface PlayerSource {
  play(track: Track): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(ms: number): Promise<void>;
  setVolume(value: number): Promise<void>;
  getPositionMs(): number;
  onStateChange(callback: (state: SourceState) => void): () => void;
}

type SpotifyControls = {
  activateElement(): Promise<void>; pause(): Promise<void>; resume(): Promise<void>;
  nextTrack(): Promise<void>; previousTrack(): Promise<void>; seek(ms: number): Promise<void>;
  setVolume(value: number): Promise<void>;
};

/** Shared command surface over AuraPlayer's existing Spotify SDK device/API. */
export class SpotifySource implements PlayerSource {
  private listeners = new Set<(state: SourceState) => void>();
  constructor(
    private getPlayer: () => SpotifyControls | null,
    private getDeviceId: () => string,
    private getProgress: () => ProgressState
  ) {}
  async play(track: Track) {
    if (!this.getDeviceId()) throw new Error('Connect Spotify and wait for PLAYER READY first.');
    await this.getPlayer()?.activateElement();
    await spotifyProvider.play?.({ id: track.id, uri: track.uri }, this.getDeviceId());
  }
  async pause() {
    if (this.getPlayer()) await this.getPlayer()!.pause();
    else await spotifyProvider.pause?.(this.getDeviceId());
  }
  async resume() {
    if (this.getPlayer()) { await this.getPlayer()!.activateElement(); await this.getPlayer()!.resume(); }
    else await spotifyProvider.resume?.(this.getDeviceId());
  }
  async next() {
    if (this.getPlayer()) await this.getPlayer()!.nextTrack();
    else await spotifyProvider.next?.(this.getDeviceId());
  }
  async previous() {
    if (this.getPlayer()) await this.getPlayer()!.previousTrack();
    else await spotifyProvider.previous?.(this.getDeviceId());
  }
  async seek(ms: number) {
    if (this.getPlayer()) await this.getPlayer()!.seek(ms);
    else await spotifyProvider.seek?.(ms, this.getDeviceId());
  }
  async setVolume(value: number) {
    if (this.getPlayer()) await this.getPlayer()!.setVolume(value);
    else await spotifyProvider.setVolume?.(value * 100, this.getDeviceId());
  }
  getPositionMs() {
    const progress = this.getProgress();
    return Math.min(progress.duration, progress.position + (progress.playing ? performance.now() - progress.updatedAt : 0));
  }
  onStateChange(callback: (state: SourceState) => void) { this.listeners.add(callback); return () => this.listeners.delete(callback); }
  emit(state: SourceState) { for (const callback of this.listeners) callback(state); }
}
