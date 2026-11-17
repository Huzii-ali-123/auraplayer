import { cleanVideoMetadata, parseIsoDuration } from './cleanTitle';
import type { Track } from '../player/types';

type YouTubeSnippet = {
  title?: string;
  channelTitle?: string;
  thumbnails?: Record<string, { url?: string }>;
};
type SearchResponse = { items?: { id?: { videoId?: string }; snippet?: YouTubeSnippet }[] };
type VideoResponse = { items?: { id: string; contentDetails?: { duration?: string }; snippet?: YouTubeSnippet }[] };
type CachedSearch = { at: number; tracks: Track[] };

const memoryCache = new Map<string, Track[]>();
const dailyCap = 100;
const quotaPrefix = 'auraplayer_youtube_searches_';
const cachePrefix = 'auraplayer_youtube_search_cache_';

function todayKey() { return new Date().toISOString().slice(0, 10); }
function getCounter() {
  try {
    const value = Number(localStorage.getItem(quotaPrefix + todayKey()) || '0');
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch { return 0; }
}
function setCounter(value: number) {
  try { localStorage.setItem(quotaPrefix + todayKey(), String(value)); } catch { /* storage can be disabled */ }
}
export function getYouTubeQuota() {
  const searches = getCounter();
  return { searches, limit: dailyCap, low: searches >= 80, exhausted: searches >= dailyCap };
}

function cached(query: string): Track[] | null {
  if (memoryCache.has(query)) return memoryCache.get(query)!;
  try {
    const raw = sessionStorage.getItem(cachePrefix + encodeURIComponent(query));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSearch;
    if (!Array.isArray(parsed.tracks)) return null;
    memoryCache.set(query, parsed.tracks);
    return parsed.tracks;
  } catch { return null; }
}
function storeCache(query: string, tracks: Track[]) {
  memoryCache.set(query, tracks);
  try { sessionStorage.setItem(cachePrefix + encodeURIComponent(query), JSON.stringify({ at: Date.now(), tracks } satisfies CachedSearch)); }
  catch { /* results remain cached for this page session */ }
}

async function request<T>(url: URL): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({})) as {
    error?: { message?: string; errors?: { reason?: string }[] };
  } & T;
  if (!response.ok) {
    const reason = payload.error?.errors?.[0]?.reason;
    if (response.status === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')) {
      throw new Error('YOUTUBE QUOTA EXHAUSTED. Search quota resets daily; Spotify still works.');
    }
    throw new Error(payload.error?.message || `YouTube request failed (HTTP ${response.status}).`);
  }
  return payload;
}

export async function searchYouTube(queryInput: string): Promise<Track[]> {
  const query = queryInput.trim().toLocaleLowerCase();
  if (!query) return [];
  const hit = cached(query);
  if (hit) return hit;
  const key = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
  if (!key) throw new Error('Add VITE_YOUTUBE_API_KEY to .env and restrict it to your website in Google Cloud Console.');
  const quota = getYouTubeQuota();
  if (quota.exhausted) throw new Error('YOUTUBE QUOTA LOW. Today’s 100-search safety limit is reached; Spotify remains available.');
  // Count before making the request because failed Google API calls can also consume quota.
  setCounter(quota.searches + 1);

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.search = new URLSearchParams({
    part: 'snippet', type: 'video', videoCategoryId: '10', videoEmbeddable: 'true',
    videoSyndicated: 'true', maxResults: '10', q: queryInput.trim(), key
  }).toString();
  const search = await request<SearchResponse>(searchUrl);
  const candidates = (search.items || []).filter(item => item.id?.videoId && item.snippet);
  const ids = candidates.map(item => item.id!.videoId!);
  if (!ids.length) { storeCache(query, []); return []; }

  const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  detailsUrl.search = new URLSearchParams({ part: 'contentDetails,snippet', id: ids.join(','), key }).toString();
  const details = await request<VideoResponse>(detailsUrl);
  const byId = new Map((details.items || []).map(item => [item.id, item]));
  const tracks = candidates.flatMap(item => {
    const videoId = item.id!.videoId!;
    const detail = byId.get(videoId);
    const snippet = detail?.snippet || item.snippet!;
    const clean = cleanVideoMetadata(snippet.title || '', snippet.channelTitle || '');
    const thumbs = snippet.thumbnails || item.snippet?.thumbnails || {};
    const artworkUrl = thumbs.maxres?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || '';
    return [{
      id: videoId, source: 'youtube' as const, title: clean.title, artist: clean.artist,
      album: 'YouTube video', durationMs: parseIsoDuration(detail?.contentDetails?.duration || ''),
      artworkUrl, uri: `https://www.youtube.com/watch?v=${videoId}`, videoId
    }];
  });
  storeCache(query, tracks);
  return tracks;
}

export async function findYouTubeAutoplay(query: string): Promise<Track | null> {
  return (await searchYouTube(query))[0] || null;
}
