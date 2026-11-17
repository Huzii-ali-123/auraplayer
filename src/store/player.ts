import { create } from 'zustand';
import type { Playback } from '../spotify/api';
import type { SourceId } from '../player/types';
import type { Track } from '../player/types';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
type SourceConnections = Record<SourceId, ConnectionStatus>;
type State = {
  token: string | null;
  playback: Playback | null;
  currentTrack: Track | null;
  playlists: { id: string; name: string; images?: { url: string }[]; tracks?: { total: number } }[];
  error: string;
  loading: boolean;
  activeSource: SourceId | null;
  connections: SourceConnections;
  set: (p: Partial<State>) => void;
};

export const usePlayer = create<State>(set => ({
  token: null,
  playback: null,
  currentTrack: null,
  playlists: [],
  error: '',
  loading: false,
  activeSource: null,
  connections: { spotify: 'disconnected', youtube: 'disconnected' },
  set: p => set(p)
}));
