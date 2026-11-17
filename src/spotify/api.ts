import { logout, refreshToken, validToken } from '../auth/pkce';

export type Artist = {
  name: string;
  id: string;
};

export type AlbumImage = {
  url: string;
  height?: number;
  width?: number;
};

export type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: Artist[];
  album: {
    name: string;
    images: AlbumImage[];
    release_date?: string;
  };
};

export type Playback = {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
  device?: { volume_percent: number };
  shuffle_state?: boolean;
  repeat_state?: 'off' | 'context' | 'track';
};

export class SpotifyAccessLimitedError extends Error {
  readonly status = 403;
  constructor(readonly path: string, readonly responseBody: string, message?: string) {
    super(message || 'Spotify access is limited to accounts allowlisted by this app’s owner.');
    this.name = 'SpotifyAccessLimitedError';
  }
}

/**
 * Robust Spotify Web API fetch wrapper with:
 * - 401 handling: automatically refreshes token once and retries
 * - 403 handling: clear message about Spotify Developer App account whitelist
 * - 429 handling: respects Retry-After header and retries once
 * - Network failure handling: friendly user-facing errors
 */
export async function spotify<T>(
  path: string,
  init: RequestInit = {},
  isRetry = false
): Promise<T | null> {
  const token = await validToken();
  if (!token) {
    throw new Error('Your Spotify session expired. Connect again.');
  }

  let res: Response;
  try {
    res = await fetch(`https://api.spotify.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...init.headers
      }
    });
  } catch {
    throw new Error('Network error reaching Spotify. Check your internet connection.');
  }

  // Handle 401 Unauthorized: token expired mid-session
  if (res.status === 401 && !isRetry) {
    const newToken = await refreshToken();
    if (newToken) {
      return spotify<T>(path, init, true);
    }
    logout();
    throw new Error('Spotify session expired. Please connect again.');
  }

  // Handle 429 Rate Limit
  if (res.status === 429 && !isRetry) {
    const retryAfterSec = Math.min(10, Math.max(1, Number(res.headers.get('Retry-After')) || 2));
    await new Promise(r => setTimeout(r, retryAfterSec * 1000));
    return spotify<T>(path, init, true);
  }

  const endpoint = path.split('?')[0];
  const responseBody = await res.text();
  let payload: { error?: { message?: string } } | T | null = null;
  if (responseBody.trim()) {
    try { payload = JSON.parse(responseBody) as { error?: { message?: string } } | T; }
    catch {
      if (res.status === 403) {
        console.error('[AuraPlayer] Spotify API returned HTTP 403', { path: endpoint, status: res.status, body: responseBody });
        throw new SpotifyAccessLimitedError(endpoint, responseBody);
      }
      if (!(res.ok && /^\/me\/player\/(next|previous|pause|play|seek|shuffle|repeat|volume)$/.test(endpoint))) {
        throw new Error(`Spotify returned an unreadable response for ${endpoint} (HTTP ${res.status}).`);
      }
    }
  }

  // Handle 403 Forbidden: developer app whitelist restriction or missing Premium
  if (res.status === 403) {
    console.error('[AuraPlayer] Spotify API returned HTTP 403', { path: endpoint, status: res.status, body: responseBody });
    const errorMsg = (payload as { error?: { message?: string } } | null)?.error?.message;
    if (errorMsg && /premium/i.test(errorMsg)) {
      throw new Error('Spotify Premium is required for browser playback.');
    }
    throw new SpotifyAccessLimitedError(endpoint, responseBody, errorMsg);
  }

  if (!res.ok) {
    const errorMsg = (payload as { error?: { message?: string } } | null)?.error?.message;
    if (res.status === 404) {
      throw new Error('No active Spotify device. Start playback on AuraPlayer first.');
    }
    throw new Error(errorMsg || `Spotify error (HTTP ${res.status}).`);
  }

  return payload as T | null;
}
