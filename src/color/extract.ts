const cache = new Map<string, Promise<string[]>>();

function rgbHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function hashSeed(seed: string): number {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i++) value = Math.imul(value ^ seed.charCodeAt(i), 16777619) >>> 0;
  return value >>> 0;
}

function seedColors(seed: string): string[] {
  const hue = hashSeed(seed) % 360;
  const hsl = (h: number, s: number, l: number) => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  };
  return [hsl(hue, 0.82, 0.52), hsl((hue + 34) % 360, 0.76, 0.44), hsl((hue + 196) % 360, 0.8, 0.58)];
}

function sampleImage(image: HTMLImageElement): string[] {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(image, 0, 0, 48, 48);
  const pixels = context.getImageData(0, 0, 48, 48).data;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number; sat: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (pixels[i + 3] < 180) continue;
    const lum = (r * 299 + g * 587 + b * 114) / 1000;
    const sat = saturation(r, g, b);
    if (lum < 12 || lum > 246 || sat < 0.16) continue;
    const key = `${r >> 5}:${g >> 5}:${b >> 5}`;
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0, sat: 0 };
    bucket.count++;
    bucket.r += r; bucket.g += g; bucket.b += b; bucket.sat += sat;
    buckets.set(key, bucket);
  }
  const ranked = [...buckets.values()].sort((a, b) => {
    const score = (bucket: typeof a) => bucket.count * (0.35 + bucket.sat / bucket.count) ** 1.7;
    return score(b) - score(a);
  });
  const colors: string[] = [];
  for (const bucket of ranked) {
    const color = rgbHex(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count);
    if (colors.every(existing => {
      const a = existing.slice(1).match(/../g)!.map(x => parseInt(x, 16));
      const c = color.slice(1).match(/../g)!.map(x => parseInt(x, 16));
      return Math.sqrt(a.reduce((sum, value, index) => sum + (value - c[index]) ** 2, 0)) > 72;
    })) colors.push(color);
    if (colors.length === 4) break;
  }
  return colors;
}

function loadImage(url: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (cors) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Artwork load failed'));
    image.src = url;
  });
}

async function readAlbumColors(key: string, url: string): Promise<string[]> {
  if (!url || typeof document === 'undefined') return seedColors(key);
  try {
    const image = await loadImage(url, true);
    const colors = sampleImage(image);
    if (colors.length) return colors;
  } catch { /* Try a blob URL when image CORS headers or canvas access fail. */ }

  let objectUrl: string | undefined;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`Artwork fetch failed: ${response.status}`);
    objectUrl = URL.createObjectURL(await response.blob());
    const image = await loadImage(objectUrl, false);
    const colors = sampleImage(image);
    if (colors.length) return colors;
  } catch { /* A video-ID seeded palette keeps every fallback deterministic and distinct. */ }
  finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
  return seedColors(key);
}

export function extractAlbumColors(trackKey: string, url: string): Promise<string[]> {
  if (!trackKey) {
    console.warn('[AuraPlayer] Palette extraction received a missing source:id key; using a URL-scoped fallback.');
    trackKey = url ? `artwork:${url}` : 'artwork:missing';
  }
  if (!cache.has(trackKey)) cache.set(trackKey, readAlbumColors(trackKey, url));
  return cache.get(trackKey)!;
}
