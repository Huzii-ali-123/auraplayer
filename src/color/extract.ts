const cache = new Map<string, Promise<string[]>>();

function rgbHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

async function readAlbumColors(url: string): Promise<string[]> {
  if (!url || typeof document === 'undefined') return [];
  return new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return resolve([]);
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
        resolve(colors);
      } catch {
        // Some album art hosts deny canvas reads; callers then use the scene palette.
        resolve([]);
      }
    };
    image.onerror = () => resolve([]);
    image.src = url;
  });
}

export function extractAlbumColors(trackId: string, url: string): Promise<string[]> {
  const key = trackId || url;
  if (!cache.has(key)) cache.set(key, readAlbumColors(url));
  return cache.get(key)!;
}

