const YTM_ORIGIN = 'https://music.youtube.com';
const YTM_BASE = `${YTM_ORIGIN}/youtubei/v1`;

function ytmHeaders(req) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Goog-Api-Format-Version': '1',
    'X-Origin': YTM_ORIGIN,
    Referer: `${YTM_ORIGIN}/`,
    'Accept-Language': 'en-US,en;q=0.9',
  };
  for (const key of [
    'x-youtube-client-name',
    'x-youtube-client-version',
    'x-goog-visitor-id',
    'user-agent',
  ]) {
    if (req.headers[key]) headers[key] = req.headers[key];
  }
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  return headers;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { path = '' } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : path;
  const url = `${YTM_BASE}/${pathStr}`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: ytmHeaders(req),
      body: JSON.stringify(req.body || {}),
    });
    const body = await resp.text();
    res.status(resp.status).set('Content-Type', 'application/json').send(body);
  } catch (err) {
    res.status(502).json({ error: err.message || 'proxy request failed' });
  }
}
