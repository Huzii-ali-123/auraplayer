const scopes = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private'
];

const AUTH_KEY = 'auraplayer-auth';
const VERIFIER_KEY = 'spotify_verifier';
const STATE_KEY = 'spotify_oauth_state';
const REDIRECT_KEY = 'spotify_redirect_uri';
const CANONICAL_REDIRECT = 'http://127.0.0.1:5173/callback';

export type AuthData = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
};

type CallbackResult = { success: boolean; error?: string };
type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export const config = () => ({
  clientId: (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string) || '',
  redirect:
    (import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string) || CANONICAL_REDIRECT
});

function storeValue(key: string, value: string) {
  sessionStorage.setItem(key, value);
  localStorage.setItem(key, value);
}

function readStoredValue(key: string) {
  return sessionStorage.getItem(key) || localStorage.getItem(key);
}

function removeStoredValue(key: string) {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

function clearPendingAuth() {
  removeStoredValue(VERIFIER_KEY);
  removeStoredValue(STATE_KEY);
  removeStoredValue(REDIRECT_KEY);
}

async function tokenResponse(response: Response): Promise<TokenResponse> {
  const body = await response.text();
  try {
    return JSON.parse(body) as TokenResponse;
  } catch {
    throw new Error('Spotify returned an invalid token response. Please try again.');
  }
}

export const save = (auth: AuthData) => {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
};

export const readAuth = (): AuthData | null => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthData) : null;
  } catch {
    return null;
  }
};

export function logout() {
  try {
    localStorage.removeItem(AUTH_KEY);
    clearPendingAuth();
  } catch {}
  exchangePromise = null;
}

function randomBase64Url(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function challenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function login() {
  const { clientId, redirect } = config();
  if (!clientId) throw new Error('Set VITE_SPOTIFY_CLIENT_ID in .env, then restart Vite.');
  if (redirect !== CANONICAL_REDIRECT) {
    throw new Error(`Set VITE_SPOTIFY_REDIRECT_URI to exactly ${CANONICAL_REDIRECT}, then restart Vite.`);
  }
  if (window.location.origin !== 'http://127.0.0.1:5173') {
    window.location.replace(`http://127.0.0.1:5173${window.location.pathname}${window.location.search}${window.location.hash}`);
    return;
  }

  const verifier = randomBase64Url(64);
  const state = randomBase64Url(32);
  try {
    storeValue(VERIFIER_KEY, verifier);
    storeValue(STATE_KEY, state);
    storeValue(REDIRECT_KEY, redirect);
  } catch {
    throw new Error('AuraPlayer could not save the Spotify sign-in session. Enable browser storage and try again.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirect,
    scope: scopes.join(' '),
    code_challenge_method: 'S256',
    code_challenge: await challenge(verifier),
    state
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

// Shared by all StrictMode effect runs so a one-time Spotify code is exchanged once.
let exchangePromise: Promise<CallbackResult> | null = null;

export function handleCallback(): Promise<CallbackResult> {
  if (exchangePromise) return exchangePromise;

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const oauthError = params.get('error');
  const returnedState = params.get('state');

  if (!code && !oauthError) return Promise.resolve({ success: true });

  // Remove one-time authorization data before any async work or React StrictMode replay.
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);

  if (oauthError) {
    clearPendingAuth();
    exchangePromise = Promise.resolve({
      success: false,
      error: `Spotify authorization was not completed (${oauthError}). Try again.`
    });
    return exchangePromise;
  }

  const verifier = readStoredValue(VERIFIER_KEY);
  const expectedState = readStoredValue(STATE_KEY);
  const savedRedirect = readStoredValue(REDIRECT_KEY);
  const { clientId, redirect } = config();

  if (!verifier) {
    exchangePromise = Promise.resolve({
      success: false,
      error: 'The Spotify sign-in verifier is missing. Open AuraPlayer at http://127.0.0.1:5173/ and try again.'
    });
    return exchangePromise;
  }
  if (!expectedState || !returnedState || returnedState !== expectedState) {
    clearPendingAuth();
    exchangePromise = Promise.resolve({
      success: false,
      error: 'Spotify sign-in state did not match. Start a fresh sign-in and try again.'
    });
    return exchangePromise;
  }
  if (!clientId || !savedRedirect || savedRedirect !== redirect || redirect !== CANONICAL_REDIRECT) {
    clearPendingAuth();
    exchangePromise = Promise.resolve({
      success: false,
      error: `The Spotify redirect URI changed during sign-in. Set it to exactly ${CANONICAL_REDIRECT} and try again.`
    });
    return exchangePromise;
  }

  exchangePromise = (async () => {
    try {
      const body = new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code: code!,
        redirect_uri: redirect,
        code_verifier: verifier
      });
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      const data = await tokenResponse(response);
      if (!response.ok || !data.access_token || !data.expires_in) {
        clearPendingAuth();
        return {
          success: false,
          error: data.error_description || data.error || `Spotify sign-in failed (HTTP ${response.status}).`
        };
      }

      save({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000
      });
      clearPendingAuth();
      return { success: true };
    } catch (error) {
      clearPendingAuth();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'A network error interrupted Spotify sign-in. Try again.'
      };
    }
  })();

  return exchangePromise;
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshToken(): Promise<string | null> {
  const auth = readAuth();
  if (!auth?.refresh_token) {
    logout();
    return null;
  }
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { clientId } = config();
      const body = new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: auth.refresh_token!
      });
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      const data = await tokenResponse(response);
      if (!response.ok || !data.access_token || !data.expires_in) {
        logout();
        return null;
      }
      const updated: AuthData = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || auth.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000
      };
      save(updated);
      return updated.access_token;
    } catch {
      logout();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function validToken(): Promise<string | null> {
  const auth = readAuth();
  if (!auth) return null;
  if (auth.expires_at > Date.now() + 60_000) return auth.access_token;
  return refreshToken();
}
