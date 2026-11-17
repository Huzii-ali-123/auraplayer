import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

const YTM_ORIGIN = 'https://music.youtube.com';
const YTM_BASE = `${YTM_ORIGIN}/youtubei/v1`;
const SW_JS_DATA_URL = `${YTM_ORIGIN}/sw.js_data`;

app.use(cors());
app.use(express.json({ limit: '4mb' }));

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

// Bootstrap visitor data
app.post('/api/ytmusic/sw.js_data', async (_req, res) => {
  try {
    const resp = await fetch(SW_JS_DATA_URL, {
      headers: { Accept: '*/*', Referer: `${YTM_ORIGIN}/` },
    });
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `sw.js_data failed (HTTP ${resp.status})` });
    }
    const text = await resp.text();
    const start = text.indexOf('[');
    if (start < 0) return res.status(502).json({ error: 'visitor data not found' });
    const value = JSON.parse(text.slice(start));
    const arr = Array.isArray(value) ? value[0]?.[2] : null;
    const candidates = Array.isArray(arr) ? arr : [];
    const token = candidates.find(
      (s) => typeof s === 'string' && (s.startsWith('Cgt') || s.startsWith('Cgs'))
    );
    if (!token) return res.status(502).json({ error: 'visitor data token not found' });
    res.json({ visitorData: token });
  } catch (err) {
    res.status(502).json({ error: err.message || 'visitor data bootstrap failed' });
  }
});

// Proxy youtubei/v1 endpoints
app.post('/api/ytmusic/youtubei/v1/:path(*)', async (req, res) => {
  const { path } = req.params;
  const url = `${YTM_BASE}/${path}`;
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
});

// Proxy audio stream with CORS
app.get('/api/ytmusic/stream', async (req, res) => {
  const streamUrl = req.query.url;
  if (!streamUrl || typeof streamUrl !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const resp = await fetch(streamUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
        Accept: '*/*',
        Range: req.headers.range || '',
        Referer: 'https://music.youtube.com/',
      },
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Range');
    res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    if (resp.headers.get('content-type')) res.set('Content-Type', resp.headers.get('content-type'));
    if (resp.headers.get('content-length')) res.set('Content-Length', resp.headers.get('content-length'));
    if (resp.headers.get('content-range')) res.set('Content-Range', resp.headers.get('content-range'));
    if (resp.headers.get('accept-ranges')) res.set('Accept-Ranges', resp.headers.get('accept-ranges'));
    if (resp.headers.get('cache-control')) res.set('Cache-Control', resp.headers.get('cache-control'));

    res.status(resp.status);

    const body = resp.body;
    if (body) {
      body.pipe(res);
    } else {
      res.status(502).json({ error: 'No stream body' });
    }
  } catch (err) {
    res.status(502).json({ error: err.message || 'stream proxy failed' });
  }
});

app.options('/api/ytmusic/stream', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Range');
  res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Dev proxy listening on http://localhost:${PORT}`);
});
