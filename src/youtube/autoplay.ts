import type { Track } from '../player/types';
import { findYouTubeAutoplay } from './api';

type LastFmSuggestion = { name?: string; artist?: { name?: string } };
const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

export async function fillYouTubeQueue(track: Track): Promise<Track[]> {
  const key = import.meta.env.VITE_LASTFM_API_KEY as string | undefined;
  if (!key) return [];
  const request = async (method: string, params: Record<string, string>) => {
    const url = new URL('https://ws.audioscrobbler.com/2.0/');
    url.search = new URLSearchParams({ method, api_key: key, format: 'json', limit: '10', ...params }).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error('Last.fm related-track lookup failed.');
    return response.json() as Promise<any>;
  };
  let candidates: LastFmSuggestion[] = [];
  try {
    const data = await request('track.getSimilar', { artist: track.artist, track: track.title });
    candidates = data?.similartracks?.track || [];
  } catch { /* fall back to the artist endpoint */ }
  if (!candidates.length) {
    try {
      const data = await request('artist.getSimilar', { artist: track.artist });
      candidates = data?.similarartists?.artist || [];
    } catch { return []; }
  }
  const results: Track[] = [];
  const seen = new Set<string>([track.id]);
  for (const candidate of candidates.slice(0, 5)) {
    const title = candidate.name?.trim();
    const artist = candidate.artist?.name?.trim() || track.artist;
    if (!title || !artist) continue;
    await wait(350);
    try {
      const found = await findYouTubeAutoplay(`${artist} ${title}`);
      if (found && !seen.has(found.id)) { seen.add(found.id); results.push(found); }
    } catch {
      // A single failed video lookup should not discard suggestions already resolved.
    }
  }
  return results;
}
