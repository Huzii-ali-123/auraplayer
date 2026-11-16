const YTM_ORIGIN = 'https://music.youtube.com';
const SW_JS_DATA_URL = `${YTM_ORIGIN}/sw.js_data`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    res.status(200).json({ visitorData: token });
  } catch (err) {
    res.status(502).json({ error: err.message || 'visitor data bootstrap failed' });
  }
}
