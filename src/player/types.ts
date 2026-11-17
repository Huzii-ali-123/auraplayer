import type { SpotifyTrack } from '../spotify/api';

export type SourceId = 'spotify' | 'youtube';
export type SourceState = { playing: boolean; positionMs: number; durationMs: number; ended?: boolean; error?: string };

/** Shared track shape consumed by scenes, lyrics, artwork, wheel, and queue UI. */
export type Track = {
  id: string;
  source: SourceId;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string;
  uri: string;
  artistId?: string;
  videoId?: string;
};

export type QueueTrack = Track & { isAutoplay?: boolean };

export function fromSpotifyTrack(track: SpotifyTrack): Track {
  return {
    id: track.id,
    source: 'spotify',
    title: track.name,
    artist: track.artists.map(artist => artist.name).filter(Boolean).join(', '),
    album: track.album?.name || '',
    durationMs: track.duration_ms || 0,
    artworkUrl: track.album?.images?.[0]?.url || '',
    uri: track.uri,
    artistId: track.artists[0]?.id
  };
}

export function toSpotifyTrack(track: Track): SpotifyTrack {
  return {
    id: track.id,
    name: track.title,
    uri: track.uri,
    duration_ms: track.durationMs,
    artists: [{ name: track.artist, id: track.artistId || '' }],
    album: { name: track.album, images: track.artworkUrl ? [{ url: track.artworkUrl }] : [] }
  };
}
