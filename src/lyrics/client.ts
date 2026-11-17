import type { Track } from '../player/types';

export type LyricsRecord = {
  plainLyrics: string | null;
  syncedLyrics: string | null;
  instrumental: boolean;
};

export type LyricLine = {
  at: number; // millisecond timestamp
  text: string;
  duration: number; // ms
  isChorus: boolean;
  wordsPerSec: number;
  intensity: number; // 0.6 to 2.2
};

export type LyricEnergy = {
  activeIdx: number;
  intensity: number;
  isChorus: boolean;
  isLineStart: boolean; // within 220ms of line trigger
  isInstrumentalGap: boolean; // between lines with > 4s gap
};

const lyricsCache = new Map<string, LyricsRecord | null>();
const parsedLinesCache = new Map<string, LyricLine[]>();
let retryAfter = 0;

export function parseLrc(raw: string): LyricLine[] {
  if (parsedLinesCache.has(raw)) {
    return parsedLinesCache.get(raw)!;
  }

  const rawEntries: { at: number; text: string }[] = [];
  for (const row of raw.split(/\r?\n/)) {
    const times = [...row.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    const text = row.replace(/\[[^\]]+\]/g, '').trim();
    if (!text) continue;
    for (const time of times) {
      const frac = (time[3] || '0').padEnd(3, '0').slice(0, 3);
      const at = (Number(time[1]) * 60 + Number(time[2])) * 1000 + Number(frac);
      rawEntries.push({ at, text });
    }
  }
  rawEntries.sort((a, b) => a.at - b.at);

  // Chorus & Hook Detection: Count repeated lines
  const frequencyMap = new Map<string, number>();
  for (const entry of rawEntries) {
    const norm = entry.text.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (norm.length > 5) {
      frequencyMap.set(norm, (frequencyMap.get(norm) || 0) + 1);
    }
  }

  const result: LyricLine[] = [];
  for (let i = 0; i < rawEntries.length; i++) {
    const entry = rawEntries[i];
    const nextAt = rawEntries[i + 1]?.at;
    const duration = nextAt ? Math.max(1000, nextAt - entry.at) : 4000;
    const norm = entry.text.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const count = frequencyMap.get(norm) || 0;
    const isChorus = count >= 2;

    const words = entry.text.trim().split(/\s+/).filter(Boolean).length;
    const wordsPerSec = words / Math.max(1, duration / 1000);
    // Base intensity scaled by tempo of delivery and boosted for chorus/hook lines
    const intensity = Math.min(2.2, 0.7 + wordsPerSec * 0.32) * (isChorus ? 1.45 : 1.0);

    result.push({
      at: entry.at,
      text: entry.text,
      duration,
      isChorus,
      wordsPerSec,
      intensity
    });
  }

  parsedLinesCache.set(raw, result);
  return result;
}

/**
 * Real-time lyric energy sampler for the sound visualizer
 */
export function sampleLyricEnergy(lines: LyricLine[], positionMs: number): LyricEnergy {
  if (!lines.length) {
    return {
      activeIdx: -1,
      intensity: 1.0,
      isChorus: false,
      isLineStart: false,
      isInstrumentalGap: false
    };
  }

  let low = 0;
  let high = lines.length - 1;
  let idx = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].at <= positionMs) {
      idx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const current = lines[idx];
  const deltaFromStart = positionMs - current.at;
  const isLineStart = deltaFromStart >= 0 && deltaFromStart < 260;
  const isInstrumentalGap = deltaFromStart > current.duration && deltaFromStart > 3800;

  let intensity = current.intensity;
  if (isInstrumentalGap) intensity *= 0.45;
  if (isLineStart) intensity *= 1.35;

  return {
    activeIdx: idx,
    intensity,
    isChorus: current.isChorus,
    isLineStart,
    isInstrumentalGap
  };
}

export async function fetchLyrics(track: Track, signal?: AbortSignal): Promise<LyricsRecord | null> {
  const cacheKey = `${track.source}:${track.id}`;
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey) ?? null;
  }
  if (Date.now() < retryAfter) return null;

  const params = new URLSearchParams({
    track_name: track.title,
    artist_name: track.artist,
    duration: String(Math.max(1, Math.round(track.durationMs / 1000)))
  });
  if (track.album) params.set('album_name', track.album);

  try {
    const response = await fetch(`https://lrclib.net/api/get?${params}`, {
      signal,
      headers: { 'X-User-Agent': 'AURA//PLAYER/2.0' }
    });
    if (response.status === 404) {
      lyricsCache.set(cacheKey, null);
      return null;
    }
    if (response.status === 429) {
      const seconds = Number(response.headers.get('Retry-After')) || 30;
      retryAfter = Date.now() + seconds * 1000;
      return null;
    }
    if (!response.ok) return null;

    const record = (await response.json()) as LyricsRecord;
    if (record.instrumental || (!record.syncedLyrics && !record.plainLyrics)) {
      lyricsCache.set(cacheKey, null);
      return null;
    }
    lyricsCache.set(cacheKey, record);
    return record;
  } catch (error) {
    if (signal?.aborted) return null;
    return null;
  }
}
