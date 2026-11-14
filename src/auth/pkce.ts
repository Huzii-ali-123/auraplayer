const scopes = ['streaming','user-read-email','user-read-private','user-read-playback-state','user-modify-playback-state','user-read-currently-playing','playlist-read-private'];
const key = 'auraplayer-auth';
export type AuthData = { access_token: string; refresh_token?: string; expires_at: number };
const config = () => ({ clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID as string, redirect: import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string });
async function tokenResponse(response:Response){const body=await response.text();try{return JSON.parse(body) as {access_token?:string;refresh_token?:string;expires_in?:number;error_description?:string}}catch{throw new Error('Spotify returned an invalid token response. Reconnect Spotify and try again.')}}
const save = (d: AuthData) => localStorage.setItem(key, JSON.stringify(d));
export const readAuth = (): AuthData | null => { try { const d = JSON.parse(localStorage.getItem(key) || 'null') as AuthData | null; return d; } catch { return null; } };
export function logout() { localStorage.removeItem(key); }
async function challenge(value: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
export async function login() {
  const { clientId, redirect } = config(); if (!clientId || !redirect) throw new Error('Add your Spotify client ID and redirect URI to .env.');
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(64)), b => b.toString(16).padStart(2,'0')).join(''); sessionStorage.setItem('spotify_verifier', verifier);
  const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirect, scope: scopes.join(' '), code_challenge_method: 'S256', code_challenge: await challenge(verifier) });
  location.assign(`https://accounts.spotify.com/authorize?${params}`);
}
export async function handleCallback() {
  const params = new URLSearchParams(location.search); const code = params.get('code'); if (!code) return;
  const verifier = sessionStorage.getItem('spotify_verifier'); sessionStorage.removeItem('spotify_verifier'); if (!verifier) throw new Error('Spotify sign-in expired. Please try again.');
  const { clientId, redirect } = config(); const body = new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: redirect, code_verifier: verifier });
  const res = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body }); const data = await tokenResponse(res); if (!res.ok) throw new Error(data.error_description || 'Spotify sign-in failed.'); if(!data.access_token||!data.expires_in)throw new Error('Spotify did not return a usable access token. Reconnect Spotify.');
  save({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + data.expires_in * 1000 }); history.replaceState({}, '', location.pathname);
}
export async function validToken() {
  let auth = readAuth(); if (!auth) return null; if (auth.expires_at > Date.now() + 60_000) return auth.access_token;
  if (!auth.refresh_token) { logout(); return null; }
  const { clientId } = config(); const body = new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: auth.refresh_token });
  const res = await fetch('https://accounts.spotify.com/api/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });let data:{access_token?:string;refresh_token?:string;expires_in?:number;error_description?:string};try{data=await tokenResponse(res)}catch{logout();return null}
  if (!res.ok||!data.access_token||!data.expires_in) { logout(); return null; } auth = { access_token:data.access_token, refresh_token:data.refresh_token || auth.refresh_token, expires_at:Date.now()+data.expires_in*1000 }; save(auth); return auth.access_token;
}
