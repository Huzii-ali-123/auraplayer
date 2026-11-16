export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Range');
    res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;
  const streamUrl = Array.isArray(url) ? url[0] : url;
  if (!streamUrl) {
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
      for await (const chunk of body) {
        res.write(chunk);
      }
      res.end();
    } else {
      res.status(502).json({ error: 'No stream body' });
    }
  } catch (err) {
    res.status(502).json({ error: err.message || 'stream proxy failed' });
  }
}
