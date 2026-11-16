/*
 * YouTube Music session / visitor-data bootstrap.
 * All requests go through the local backend proxy (server/index.js) so the browser
 * never hits music.youtube.com directly — that avoids CORS blocks (sw.js_data sends
 * no Access-Control-Allow-Origin). The proxy makes server-to-server requests.
 * Mirrors limusic's InnerTube transport (context/01, context/04).
 */

const PROXY_BASE = '/api/ytmusic';

export type YTMusicClient = {
  clientName: string;
  clientVersion: string;
  clientId: string; // numeric id, sent as X-YouTube-Client-Name
  userAgent: string;
};

// WEB_REMIX — the metadata client limusic uses for search/next. Client id 67.
export const WEB_REMIX: YTMusicClient = {
  clientName: 'WEB_REMIX',
  clientVersion: '1.20260213.01.00',
  clientId: '67',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
};

// IOS_MUSIC — mobile client that returns timedLyricsData (synced lyrics). Client id 26.
export const IOS_MUSIC: YTMusicClient = {
  clientName: 'IOS_MUSIC',
  clientVersion: '7.01.05',
  clientId: '26',
  userAgent:
    'com.google.ios.youtubemusic/7.01.05 (iPhone16,2; U; CPU iOS 18_2 like Mac OS X;)',
};

// VISIONOS — direct-URL stream client, no cipher / PoToken needed (limusic STREAM_FALLBACK_ORDER[0]).
export const VISIONOS: YTMusicClient = {
  clientName: 'VISIONOS',
  clientVersion: '0.1',
  clientId: '101',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
};

const VISITOR_DATA_KEY = 'ytmusic_visitor_data';
const VISITOR_DATA_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export function readVisitorData(): string | null {
  try {
    const raw = localStorage.getItem(VISITOR_DATA_KEY);
    if (!raw) return null;
    const { value, ts } = JSON.parse(raw) as { value: string; ts: number };
    if (Date.now() - ts > VISITOR_DATA_TTL) {
      localStorage.removeItem(VISITOR_DATA_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function writeVisitorData(value: string) {
  try {
    localStorage.setItem(
      VISITOR_DATA_KEY,
      JSON.stringify({ value, ts: Date.now() })
    );
  } catch { /* private browsing */ }
}

export function clearVisitorData() {
  try { localStorage.removeItem(VISITOR_DATA_KEY); } catch {}
}

/** Bootstrap a fresh visitorData token via the backend proxy. Cached for 7 days. */
export async function ensureVisitorData(): Promise<string> {
  const cached = readVisitorData();
  if (cached) return cached;

  const res = await fetch(`${PROXY_BASE}/sw.js_data`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`YouTube Music visitor data bootstrap failed (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { visitorData?: string; error?: string };
  if (!data.visitorData) {
    throw new Error(data.error || 'YouTube Music visitor data token not found.');
  }
  writeVisitorData(data.visitorData);
  return data.visitorData;
}

/** Build the InnerTube `context` object sent with every request. */
export function buildContext(client: YTMusicClient, visitorData: string | null): Record<string, unknown> {
  return {
    client: {
      clientName: client.clientName,
      clientVersion: client.clientVersion,
      clientScreen: 'EMBED',
    },
    ...(visitorData ? { visitorData } : {}),
  };
}

/** Per-request headers for youtubei/v1 — forwarded to the proxy. */
export function buildHeaders(client: YTMusicClient, visitorData: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Goog-Api-Format-Version': '1',
    'X-YouTube-Client-Name': client.clientId,
    'X-YouTube-Client-Version': client.clientVersion,
    'X-Origin': 'https://music.youtube.com',
    Referer: 'https://music.youtube.com/',
    'User-Agent': client.userAgent,
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (visitorData) {
    headers['X-Goog-Visitor-Id'] = visitorData;
  }
  return headers;
}

/** POST a JSON body to a youtubei/v1 endpoint via the backend proxy. */
export async function ytPost(
  path: string,
  client: YTMusicClient,
  body: unknown,
  visitorData: string | null
): Promise<any> {
  const res = await fetch(`${PROXY_BASE}/youtubei/v1/${path}`, {
    method: 'POST',
    headers: buildHeaders(client, visitorData),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`YouTube Music ${path} failed (HTTP ${res.status})${text ? `: ${text.slice(0, 200)}` : ''}.`);
  }
  return res.json();
}

