export type RGB = { r: number; g: number; b: number };

export function parseHex(hex: string): RGB {
  const value = hex.trim().replace(/^#/, '');
  const expanded = value.length === 3 ? value.split('').map(ch => ch + ch).join('') : value;
  if (!/^[\da-f]{6}$/i.test(expanded)) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16)
  };
}

export function srgbToLinear(channel: number): number {
  const value = channel > 1 ? channel / 255 : channel;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string | RGB): number {
  const rgb = typeof color === 'string' ? parseHex(color) : color;
  return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);
}

export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function pickReadable<T extends string>(background: string, candidates: readonly T[]): T {
  if (!candidates.length) throw new Error('pickReadable requires at least one candidate');
  return candidates.reduce((best, candidate) =>
    contrastRatio(background, candidate) > contrastRatio(background, best) ? candidate : best
  );
}
