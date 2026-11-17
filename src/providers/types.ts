import type { Track } from '../player/types';

export type ProviderId = 'spotify' | 'apple-music' | 'soundcloud' | 'youtube-music' | 'youtube-videos';
export type ProviderCapability =
  | 'search' | 'playlists' | 'metadata' | 'playback' | 'seek' | 'volume' | 'shuffle' | 'repeat';
export type ProviderTrackRef = { id: string; uri: string };

export interface MusicProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly capabilities: ReadonlySet<ProviderCapability>;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): void;
  searchTracks?(query: string): Promise<Track[]>;
  getPlaylists?(): Promise<unknown[]>;
  getCurrentTrack?(): Promise<Track | null>;
  play?(track: ProviderTrackRef, deviceId?: string): Promise<void>;
  pause?(deviceId?: string): Promise<void>;
  resume?(deviceId?: string): Promise<void>;
  next?(deviceId?: string): Promise<void>;
  previous?(deviceId?: string): Promise<void>;
  seek?(positionMs: number, deviceId?: string): Promise<void>;
  setVolume?(volumePercent: number, deviceId?: string): Promise<void>;
  setShuffle?(enabled: boolean, deviceId?: string): Promise<void>;
  setRepeat?(mode: 'off' | 'context' | 'track', deviceId?: string): Promise<void>;
}

export type ProviderCatalogEntry = {
  id: ProviderId;
  name: string;
  integration: 'full' | 'not-implemented' | 'not-available';
  summary: string;
  capabilities: string[];
  requirement: string;
};
