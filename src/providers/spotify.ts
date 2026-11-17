import { login, logout, readAuth } from '../auth/pkce';
import { spotify, type Playback, type SpotifyTrack } from '../spotify/api';
import { fromSpotifyTrack } from '../player/types';
import type { MusicProvider } from './types';

export const spotifyProvider: MusicProvider = {
  id: 'spotify',
  name: 'Spotify',
  capabilities: new Set(['search', 'playlists', 'metadata', 'playback', 'seek', 'volume', 'shuffle', 'repeat']),
  isConnected: () => Boolean(readAuth()?.access_token),
  connect: login,
  disconnect: logout,
  async searchTracks(query: string) {
    const response = await spotify<{ tracks?: { items?: SpotifyTrack[] } }>(
      `/search?type=track&limit=8&q=${encodeURIComponent(query)}`
    );
    return (response?.tracks?.items || []).map(fromSpotifyTrack);
  },
  async getPlaylists() {
    const response = await spotify<{ items?: unknown[] }>('/me/playlists?limit=30');
    return response?.items || [];
  },
  async getCurrentTrack() {
    const response = await spotify<Playback>('/me/player');
    return response?.item ? fromSpotifyTrack(response.item) : null;
  },
  async play(track, deviceId) {
    const suffix = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    await spotify(`/me/player/play${suffix}`, { method: 'PUT', body: JSON.stringify({ uris: [track.uri] }) });
  },
  async pause(deviceId) {
    const suffix = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    await spotify(`/me/player/pause${suffix}`, { method: 'PUT' });
  },
  async resume(deviceId) {
    const suffix = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    await spotify(`/me/player/play${suffix}`, { method: 'PUT' });
  },
  async next(deviceId) {
    const suffix = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    await spotify(`/me/player/next${suffix}`, { method: 'POST' });
  },
  async previous(deviceId) {
    const suffix = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    await spotify(`/me/player/previous${suffix}`, { method: 'POST' });
  },
  async seek(positionMs, deviceId) {
    const query = new URLSearchParams({ position_ms: String(Math.max(0, Math.round(positionMs))) });
    if (deviceId) query.set('device_id', deviceId);
    await spotify(`/me/player/seek?${query}`, { method: 'PUT' });
  },
  async setVolume(volumePercent, deviceId) {
    const query = new URLSearchParams({ volume_percent: String(Math.max(0, Math.min(100, Math.round(volumePercent)))) });
    if (deviceId) query.set('device_id', deviceId);
    await spotify(`/me/player/volume?${query}`, { method: 'PUT' });
  },
  async setShuffle(enabled, deviceId) {
    const query = new URLSearchParams({ state: String(enabled) });
    if (deviceId) query.set('device_id', deviceId);
    await spotify(`/me/player/shuffle?${query}`, { method: 'PUT' });
  },
  async setRepeat(mode, deviceId) {
    const query = new URLSearchParams({ state: mode });
    if (deviceId) query.set('device_id', deviceId);
    await spotify(`/me/player/repeat?${query}`, { method: 'PUT' });
  }
};
