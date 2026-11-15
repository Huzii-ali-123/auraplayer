import { contrastRatio, parseHex, pickReadable, relativeLuminance } from './contrast.ts';

export type Palette = {
  bg: string;
  surface: string;
  accent: string;
  accent2: string;
  ink: string;
  paper: string;
  onBg: string;
  onSurface: string;
  onAccent: string;
  onAccentAlt: string;
};

export type PaletteSeeds = {
  bg?: string;
  surface?: string;
  accent?: string;
  accent2?: string;
};

export const INK = '#111111';
export const PAPER = '#fff9e8';

type HSL = { h: number; s: number; l: number };

function rgbToHsl(hex: string): HSL {
  const { r: rr, g: gg, b: bb } = parseHex(hex);
  const r = rr / 255, g = gg / 255, b = bb / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return { h: h * 360, s, l };
}

function hslToHex({ h, s, l }: HSL): string {
  const hue = ((h % 360) + 360) % 360 / 360;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue * 12) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * value).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function usableSeed(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const lum = relativeLuminance(value);
    const { s } = rgbToHsl(value);
    return lum < 0.025 || lum > 0.96 || s < 0.2 ? undefined : value;
  } catch { return undefined; }
}

function separatedBackground(seed: string): string {
  const base = rgbToHsl(seed);
  let best = seed;
  let score = Infinity;
  // Keep the saturated album hue, but limit luminance so both ink and paper borders
  // remain distinct and either readable text candidate can reach WCAG AA.
  for (let i = 0; i <= 200; i++) {
    const l = i / 200;
    const candidate = hslToHex({ h: base.h, s: Math.max(0.62, base.s), l });
    const lum = relativeLuminance(candidate);
    const readable = Math.max(contrastRatio(candidate, INK), contrastRatio(candidate, PAPER)) >= 4.5;
    const blackBorder = contrastRatio(candidate, INK) >= 3;
    if (!readable || !blackBorder || lum > 0.55) continue;
    const distance = Math.abs(l - base.l);
    if (distance < score) { best = candidate; score = distance; }
  }
  return best;
}

function distinctAccent(seed: string, bg: string, surface: string): string {
  const base = rgbToHsl(seed);
  const lightnesses = [0.56, 0.48, 0.64, 0.4, 0.7, 0.34];
  for (let hueStep = 0; hueStep <= 12; hueStep++) {
    const direction = hueStep % 2 === 0 ? 1 : -1;
    const magnitude = Math.ceil(hueStep / 2) * 30;
    const hue = base.h + direction * magnitude;
    for (const l of lightnesses) {
      const candidate = hslToHex({ h: hue, s: Math.max(0.72, base.s), l });
      const lum = relativeLuminance(candidate);
      const hueDistance = Math.min(Math.abs(((rgbToHsl(candidate).h - rgbToHsl(bg).h + 540) % 360) - 180), 180);
      const contrast = Math.min(contrastRatio(candidate, bg), contrastRatio(candidate, surface));
      if (lum >= 0.14 && lum <= 0.58 && contrast >= 1.5 && (hueDistance >= 24 || Math.abs(l - rgbToHsl(bg).l) >= 0.16)) return candidate;
    }
  }
  return hslToHex({ h: base.h + 150, s: 0.82, l: 0.52 });
}

function pickSource(colors: readonly string[] | undefined, fallback: string): string {
  const valid = (colors || []).map(usableSeed).filter((color): color is string => !!color);
  if (!valid.length) return fallback || '#3478A8';
  // Saturation-forward score stops a large flat neutral field from washing out the palette.
  return valid.sort((a, b) => {
    const score = (hex: string) => rgbToHsl(hex).s * (0.45 + Math.min(1, relativeLuminance(hex)));
    return score(b) - score(a);
  })[0];
}

export function buildPalette(
  albumColors: readonly string[] | undefined,
  sceneSeeds: PaletteSeeds,
  curated?: PaletteSeeds
): Palette {
  const sourceColors = albumColors || [];
  const bgSeed = curated?.bg || pickSource(sourceColors, sceneSeeds.bg || '#3478A8');
  const bg = separatedBackground(bgSeed || sceneSeeds.bg || '#3478A8');
  const bgHsl = rgbToHsl(bg);
  const surfaceSeed = curated?.surface || sceneSeeds.surface || '#fff1d2';
  let surfaceHsl: HSL;
  try { surfaceHsl = rgbToHsl(surfaceSeed); }
  catch { surfaceHsl = rgbToHsl('#fff1d2'); }
  surfaceHsl = { h: surfaceHsl.h, s: Math.min(0.22, surfaceHsl.s), l: 0.94 };
  let surface = hslToHex(surfaceHsl);
  if (contrastRatio(surface, bg) < 1.5) {
    surface = hslToHex({ ...surfaceHsl, h: (bgHsl.h + 180) % 360, l: 0.97 });
  }

  const accentSeed = curated?.accent || sourceColors.find(color => usableSeed(color) && color !== bgSeed) || sceneSeeds.accent || '#ee654d';
  const accent = distinctAccent(accentSeed || sceneSeeds.accent || '#ee654d', bg, surface);
  const accent2Seed = curated?.accent2 || sourceColors.find(color => usableSeed(color) && color !== accentSeed) || sceneSeeds.accent2 || '#f3c43a';
  const accent2 = distinctAccent(accent2Seed || '#f3c43a', surface, bg);

  const onBg = pickReadable(bg, [INK, PAPER] as const);
  const onSurface = pickReadable(surface, [INK, PAPER] as const);
  const onAccent = pickReadable(accent, [INK, PAPER] as const);
  const onAccentAlt = onAccent === INK ? PAPER : INK;
  return { bg, surface, accent, accent2, ink: INK, paper: PAPER, onBg, onSurface, onAccent, onAccentAlt };
}

