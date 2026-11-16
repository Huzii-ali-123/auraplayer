/*
 * YouTube Music InnerTube API client.
 * Port of limusic's innertube crate endpoints (search, next, player, lyrics) to TypeScript.
 * Base URL: https://music.youtube.com/youtubei/v1/
 *
 * Data shapes mirror what limusic's parsers extract — video_id, title, artists, album,
 * thumbnail, duration, lyrics_browse_id — so the rest of auraplayer can consume them the
 * same way it consumes Spotify tracks.
 */

import {
  WEB_REMIX,
  IOS_MUSIC,
  VISIONOS,
  buildContext,
  ytPost,
  ensureVisitorData,
} from './auth';

// Search filter params (opaque base64) — same values limusic uses.
export const FILTER_SONG = 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D';
export const FILTER_VIDEO = 'EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D';

export type YTArtist = { name: string; id?: string };

export type YTTrack = {
  id: string; // YouTube videoId
  name: string;
  artists: YTArtist[];
  album?: string;
  albumId?: string;
  duration_ms?: number;
  thumbnail?: string;
  isVideo?: boolean;
  explicit?: boolean;
  lyricsBrowseId?: string; // browseId for the lyrics tab, from /next
};

export type YTSearchResult = {
  items: YTTrack[];
};

export type YTNextResult = {
  items: YTTrack[];
  continuation?: string;
  lyricsBrowseId?: string;
  automixPlaylistId?: string;
};

export type YTLyrics = {
  timed: { time_ms: number; text: string }[]; // synced lines (IOS_MUSIC client)
  plain?: string; // plain text (WEB_REMIX client)
  footer?: string;
};

export type YTStreamFormat = {
  url: string;
  itag: number;
  mimeType: string;
  bitrate?: number;
  audioOnly: boolean;
};

/* ---------------------------------------------------------------- helpers */

function msFromDurationString(d?: string): number {
  if (!d) return 0;
  const m = d.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (!m) return 0;
  const hours = m[3] ? Number(m[3]) : 0;
  const minutes = Number(m[1]);
  const seconds = Number(m[2]);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

// Walk raw JSON looking for a key, collecting all matching values. (Same idea as limusic's find_all.)
function findAll(obj: unknown, key: string): unknown[] {
  const out: unknown[] = [];
  const walk = (node: unknown) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === 'object') {
      const o = node as Record<string, unknown>;
      if (key in o) out.push(o[key]);
      for (const v of Object.values(o)) walk(v);
    }
  };
  walk(obj);
  return out;
}

function firstStr(obj: unknown, key: string): string | undefined {
  const found = findAll(obj, key);
  for (const v of found) {
    if (typeof v === 'string') return v;
  }
  return undefined;
}

// Extract thumbnail URL from a thumbnail renderer tree — pick the largest resolution.
function extractThumbnail(obj: unknown): string | undefined {
  const thumbnails = findAll(obj, 'thumbnails');
  let best: { url?: string; width?: number; height?: number } | null = null;
  for (const t of thumbnails) {
    if (!Array.isArray(t)) continue;
    for (const thumb of t) {
      if (typeof thumb !== 'object' || thumb === null) continue;
      const th = thumb as Record<string, unknown>;
      const url = firstStr(th, 'url');
      if (!url) continue;
      const w = typeof th['width'] === 'number' ? th['width'] : 0;
      const h = typeof th['height'] === 'number' ? th['height'] : 0;
      if (!best || (w + h) > (best.width + best.height)) {
        best = { url, width: w, height: h };
      }
    }
  }
  if (best?.url) return upscaleThumbnail(best.url);
  // Also try direct thumbnail.url / thumbnail.src shapes.
  const direct = firstStr(obj, 'url');
  return direct ? upscaleThumbnail(direct) : undefined;
}

// YouTube/Google thumbnail URLs support size params (e.g. =w60-h60-l90-rj).
// Upscale to a larger resolution so album art stays sharp.
function upscaleThumbnail(url: string): string {
  return url.replace(/=w[0-9]+-h[0-9]+-[a-z0-9-]+/, '=w600-h600-l90-rj');
}

// Extract text from a "runs" array: [{ text: "..." }, ...]
function runsText(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const o = node as Record<string, unknown>;
  const runs = o['runs'];
  if (Array.isArray(runs)) {
    return runs.map(r => (typeof r === 'object' && r !== null && typeof (r as any).text === 'string' ? (r as any).text : '')).join('');
  }
  if (typeof o['simpleText'] === 'string') return o['simpleText'] as string;
  return undefined;
}

// Parse a musicResponsiveListItemRenderer row into a YTTrack.
// YouTube Music nests videoId inside navigationEndpoint.watchEndpoint.videoId,
// title/artists inside flexColumns[].text.runs, and thumbnail inside
// thumbnail.musicThumbnailRenderer.thumbnail.thumbnails.
function parseTrackRow(renderer: unknown): YTTrack | null {
  if (!renderer || typeof renderer !== 'object') return null;
  const r = renderer as Record<string, unknown>;

  // Flex columns hold title (col 0) and artists (col 1).
  const flexColumns = r['flexColumns'];
  if (!Array.isArray(flexColumns) || flexColumns.length === 0) return null;

  let videoId: string | undefined;
  let title = '';
  let artists: YTArtist[] = [];

  for (const col of flexColumns) {
    if (typeof col !== 'object' || col === null) continue;
    const c = col as Record<string, unknown>;
    const flex = c['musicResponsiveListItemFlexColumnRenderer'];
    if (!flex || typeof flex !== 'object') continue;
    const f = flex as Record<string, unknown>;
    const textNode = f['text'];
    const runs = runsTextNode(textNode);
    if (!runs || runs.length === 0) continue;

    // First column: title + videoId
    if (!title) {
      title = runs.map(r => r.text).join('');
      const nav = findFirstWatchEndpointVideoId(textNode);
      if (nav) videoId = nav;
    } else if (artists.length === 0) {
      // Second column: artists (join runs, drop separators)
      const parts: string[] = [];
      for (const run of runs) {
        const t = run.text.trim();
        if (!t) continue;
        if (t === ',' || t === '&' || t === '•') continue;
        parts.push(t);
      }
      const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
      if (joined) artists = [{ name: joined }];
    }
  }

  if (!videoId || !title) return null;

  // Thumbnail from thumbnail.musicThumbnailRenderer.thumbnail.thumbnails
  const thumbnail = extractThumbnail(r);

  // Duration from a duration column (usually a later flex column)
  let duration_ms: number | undefined;
  for (const col of flexColumns) {
    if (typeof col !== 'object' || col === null) continue;
    const c = col as Record<string, unknown>;
    const flex = c['musicResponsiveListItemFlexColumnRenderer'];
    if (!flex || typeof flex !== 'object') continue;
    const f = flex as Record<string, unknown>;
    const textNode = f['text'];
    const text = runsText(textNode);
    if (text && /^\d+:\d{2}$/.test(text)) {
      duration_ms = msFromDurationString(text);
      break;
    }
  }

  return {
    id: videoId,
    name: title,
    artists,
    ...(duration_ms ? { duration_ms } : {}),
    ...(thumbnail ? { thumbnail } : {}),
    // lyricsBrowseId is populated later via nextTrack() when the track is played
  };
}

// Extract { text, navigationEndpoint? } from a runs node.
function runsTextNode(node: unknown): { text: string; navigationEndpoint?: Record<string, unknown> }[] | null {
  if (!node || typeof node !== 'object') return null;
  const o = node as Record<string, unknown>;
  const runs = o['runs'];
  if (!Array.isArray(runs)) return null;
  const out: { text: string; navigationEndpoint?: Record<string, unknown> }[] = [];
  for (const run of runs) {
    if (typeof run !== 'object' || run === null) continue;
    const r = run as Record<string, unknown>;
    const text = typeof r['text'] === 'string' ? r['text'] : '';
    const nav = r['navigationEndpoint'];
    out.push({ text, ...(nav ? { navigationEndpoint: nav as Record<string, unknown> } : {}) });
  }
  return out;
}

// Find videoId inside navigationEndpoint.watchEndpoint.videoId within a text node tree.
function findFirstWatchEndpointVideoId(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const o = node as Record<string, unknown>;
  const nav = o['navigationEndpoint'];
  if (nav && typeof nav === 'object') {
    const n = nav as Record<string, unknown>;
    const we = n['watchEndpoint'];
    if (we && typeof we === 'object') {
      const w = we as Record<string, unknown>;
      const vid = w['videoId'];
      if (typeof vid === 'string') return vid;
    }
  }
  for (const v of Object.values(o)) {
    const found = findFirstWatchEndpointVideoId(v);
    if (found) return found;
  }
  return undefined;
}

/* ---------------------------------------------------------------- search */

/** Search YouTube Music songs only (FILTER_SONG). Mirrors InnerTube::search_songs. */
export async function searchSongs(query: string): Promise<YTSearchResult> {
  const visitorData = await ensureVisitorData();
  const body = {
    context: buildContext(WEB_REMIX, visitorData),
    query,
    params: FILTER_SONG,
  };
  const value = await ytPost('search', WEB_REMIX, body, visitorData);
  const items: YTTrack[] = [];

  // YouTube search returns musicResponsiveListItemRenderer rows nested under contents.
  for (const node of findAll(value, 'musicResponsiveListItemRenderer')) {
    const track = parseTrackRow(node);
    if (track) items.push(track);
  }

  return { items };
}

/* ---------------------------------------------------------------- next */

/** Up-next queue / radio for a video. Mirrors InnerTube::next. */
export async function nextTrack(videoId?: string): Promise<YTNextResult> {
  const visitorData = await ensureVisitorData();
  const body: Record<string, unknown> = {
    context: buildContext(WEB_REMIX, visitorData),
    is_audio_only: true,
  };
  if (videoId) body['videoId'] = videoId;

  const value = await ytPost('next', WEB_REMIX, body, visitorData);
  const items: YTTrack[] = [];
  let lyricsBrowseId: string | undefined;
  let automixPlaylistId: string | undefined;
  let continuation: string | undefined;

  // Panel rows are playlistPanelVideoRenderer; parse each like a track row.
  for (const node of findAll(value, 'playlistPanelVideoRenderer')) {
    const track = parseTrackRow(node);
    if (track) items.push(track);
  }

  // Lyrics browseId comes from the next response (music queue / watch next).
  const lb = firstStr(value, 'lyricsBrowseId');
  if (lb) lyricsBrowseId = lb;

  const ap = firstStr(value, 'automixPlaylistId');
  if (ap) automixPlaylistId = ap;

  const ct = firstStr(value, 'continuation');
  if (ct) continuation = ct;

  return { items, lyricsBrowseId, automixPlaylistId, continuation };
}

/** Get a single track by videoId (for a pasted YouTube link). */
export async function getTrack(videoId: string): Promise<YTTrack | null> {
  const result = await nextTrack(videoId);
  return result.items.find(i => i.id === videoId) ?? null;
}

/* ---------------------------------------------------------------- player (stream URL) */

/** Get playback stream formats for a video. Mirrors InnerTube::player. */
export async function getPlayer(videoId: string): Promise<any> {
  const visitorData = await ensureVisitorData();
  const body = {
    context: buildContext(VISIONOS, visitorData),
    videoId,
    is_audio_only: true,
    content_check_ok: true,
    racy_check_ok: true,
  };
  return ytPost('player', VISIONOS, body, visitorData);
}

/** Extract the best audio stream URL from a /player response. */
export function extractStreamUrl(playerResponse: any): string | null {
  if (!playerResponse || typeof playerResponse !== 'object') return null;
  const pr = playerResponse as Record<string, unknown>;

  const streamingData = pr['streamingData'];
  if (!streamingData || typeof streamingData !== 'object') return null;
  const sd = streamingData as Record<string, unknown>;

  const formats = (sd['adaptiveFormats'] as unknown[]) ?? (sd['formats'] as unknown[]) ?? [];
  let best: { url?: string; bitrate?: number; audioOnly?: boolean } | null = null;

  for (const f of formats) {
    if (typeof f !== 'object' || f === null) continue;
    const fmt = f as Record<string, unknown>;
    const mime = (fmt['mimeType'] as string) || '';
    // Prefer audio-only (webm/mp4 audio). Skip video.
    if (!mime.includes('audio')) continue;
    const bitrate = typeof fmt['bitrate'] === 'number' ? fmt['bitrate'] as number : 0;
    if (!best || (bitrate || 0) > (best.bitrate || 0)) {
      best = fmt;
    }
  }

  if (best?.url) return best.url as string;
  // Some responses cipher the URL; look for cipher or signatureCipher.
  for (const f of formats) {
    if (typeof f !== 'object' || f === null) continue;
    const fmt = f as Record<string, unknown>;
    if (fmt['cipher'] || fmt['signatureCipher']) {
      // Ciphered URLs need deciphering (Phase 2 — not implemented here).
      return null;
    }
  }
  return null;
}

/* ---------------------------------------------------------------- lyrics */

/** Fetch synced (timed) lyrics via the IOS_MUSIC client. Mirrors lyrics_timed. */
export async function getTimedLyrics(browseId: string): Promise<{ time_ms: number; text: string }[]> {
  const visitorData = await ensureVisitorData();
  const body = {
    context: buildContext(IOS_MUSIC, visitorData),
    browseId,
  };
  const value = await ytPost('browse', IOS_MUSIC, body, visitorData);
  const lines: { time_ms: number; text: string }[] = [];

  for (const node of findAll(value, 'timedLyricsData')) {
    if (!Array.isArray(node)) continue;
    for (const entry of node) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const text = typeof e['lyricLine'] === 'string' ? (e['lyricLine'] as string) : undefined;
      if (!text) continue;
      const cue = e['cueRange'];
      let ms = 0;
      if (cue && typeof cue === 'object') {
        const start = (cue as Record<string, unknown>)['startTimeMilliseconds'];
        if (typeof start === 'string') ms = Number(start) || 0;
      }
      lines.push({ time_ms: ms, text });
    }
    if (lines.length) break; // first populated block is the lyrics
  }
  return lines;
}

/** Fetch plain-text lyrics via WEB_REMIX (musicDescriptionShelfRenderer). Mirrors lyrics_plain. */
export async function getPlainLyrics(browseId: string): Promise<{ text: string; footer?: string } | null> {
  const visitorData = await ensureVisitorData();
  const body = {
    context: buildContext(WEB_REMIX, visitorData),
    browseId,
  };
  const value = await ytPost('browse', WEB_REMIX, body, visitorData);

  const shelves = findAll(value, 'musicDescriptionShelfRenderer');
  for (const shelf of shelves) {
    if (typeof shelf !== 'object' || shelf === null) continue;
    const s = shelf as Record<string, unknown>;
    const desc = s['description'];
    const text = runsText(desc);
    if (!text) continue;
    const footer = s['footer'] ? runsText(s['footer']) : undefined;
    return { text, ...(footer ? { footer } : {}) };
  }
  return null;
}

/** Try timed lyrics first, fall back to plain. */
export async function getLyrics(browseId: string): Promise<YTLyrics | null> {
  // Try timed (synced) lyrics via IOS_MUSIC.
  try {
    const timed = await getTimedLyrics(browseId);
    if (timed.length) {
      return { timed };
    }
  } catch { /* fall through to plain */ }

  // Fall back to plain text via WEB_REMIX.
  try {
    const plain = await getPlainLyrics(browseId);
    if (plain) return { timed: [], ...plain };
  } catch { /* no lyrics */ }

  return null;
}

