import type { Track } from '../spotify/api';
import { buildPalette } from '../color/palette';
import type { Palette } from '../color/palette';
import { songMap, songPaletteMap } from './songMap';

export type SceneKey =
  | 'snow'
  | 'rain'
  | 'stars'
  | 'fireflies'
  | 'ember'
  | 'ocean'
  | 'sunset'
  | 'neon'
  | 'blossom'
  | 'thunder'
  | 'desert'
  | 'space'
  | 'art';

export type SceneKind =
  | 'snow'
  | 'rain'
  | 'plus'
  | 'square'
  | 'triangle'
  | 'wave'
  | 'sun'
  | 'city'
  | 'petal'
  | 'lightning'
  | 'heat'
  | 'orbit'
  | 'art';

export type Scene = {
  key: SceneKey;
  label: string;
  background: string;
  ink: string;
  colors: [string, string, string, string];
  keywords: string[];
  kind: SceneKind;
  variants: [string, string, string, string];
  motionVariant?: number; // 0, 1, 2, 3
  motionName?: string;
  revision?: string;
  palette?: Palette;
};

export const scenes: Scene[] = [
  {
    key: 'snow',
    label: 'Snow',
    background: '#6FE7FF',
    ink: '#07121A',
    colors: ['#6FE7FF', '#F8F8F2', '#FF4FA1', '#07121A'],
    keywords: ['snow', 'winter', 'frost', 'ice', 'christmas', 'cold', 'freeze'],
    kind: 'snow',
    variants: ['GENTLE FALL', 'BLIZZARD GUST', 'FLOATING FLAKES', 'SWIRLING VORTEX']
  },
  {
    key: 'rain',
    label: 'Rain',
    background: '#537CF2',
    ink: '#080B20',
    colors: ['#537CF2', '#B9D6FF', '#161A33', '#FC6F58'],
    keywords: ['rain', 'storm', 'tears', 'cloud', 'blue', 'pour', 'drizzle'],
    kind: 'rain',
    variants: ['STEADY DRIZZLE', 'WIND SLANT', 'HEAVY DOWNPOUR', 'CHAOTIC SQUALL']
  },
  {
    key: 'thunder',
    label: 'Thunderstorm',
    background: '#1A1C29',
    ink: '#F4F5F9',
    colors: ['#1A1C29', '#4C5BD4', '#FFE600', '#0D0E15'],
    keywords: ['thunder', 'lightning', 'storm', 'flash', 'strike', 'dark', 'electric', 'voltage'],
    kind: 'lightning',
    variants: ['STROBE SQUALL', 'JAGGED VOLTS', 'RUMBLING HAIL', 'PULSE DISCHARGE']
  },
  {
    key: 'stars',
    label: 'Night Stars',
    background: '#F3C43A',
    ink: '#16140C',
    colors: ['#F3C43A', '#FFF4BD', '#122A4A', '#EF5B43'],
    keywords: ['night', 'star', 'moon', 'dream', 'midnight', 'twilight', 'sleep'],
    kind: 'plus',
    variants: ['STEADY TWINKLE', 'CELESTIAL DRIFT', 'METEOR SHOWER', 'PULSATING NEBULA']
  },
  {
    key: 'fireflies',
    label: 'Fireflies',
    background: '#A7DB55',
    ink: '#10170C',
    colors: ['#A7DB55', '#F5EE9E', '#1F3722', '#FF6F59'],
    keywords: ['love', 'garden', 'field', 'summer', 'wild', 'firefly', 'meadow'],
    kind: 'square',
    variants: ['FOREST MEANDER', 'SYNCHRONIZED SWARM', 'ZEPHYR DRIFT', 'RAPID SCATTER']
  },
  {
    key: 'ember',
    label: 'Embers',
    background: '#F05232',
    ink: '#1A0D0A',
    colors: ['#F05232', '#FFCB46', '#24130F', '#F8EFD8'],
    keywords: ['fire', 'flame', 'burn', 'heat', 'ember', 'red', 'ash', 'blaze'],
    kind: 'triangle',
    variants: ['BONFIRE UPRISING', 'ASHEN DRIFT', 'INFERNO SPIRAL', 'SPARK POPPING']
  },
  {
    key: 'desert',
    label: 'Desert Heat',
    background: '#F59E0B',
    ink: '#1C1204',
    colors: ['#F59E0B', '#EF4444', '#78350F', '#FEF3C7'],
    keywords: ['desert', 'heat', 'sand', 'dune', 'dry', 'mirage', 'oasis', 'sun'],
    kind: 'heat',
    variants: ['THERMAL WAVES', 'SHIMMERING MIRAGE', 'SIROCCO DUST', 'GOLDEN HORIZON']
  },
  {
    key: 'ocean',
    label: 'Ocean',
    background: '#27B8B1',
    ink: '#071819',
    colors: ['#27B8B1', '#B3EEE2', '#123F51', '#F37F5B'],
    keywords: ['ocean', 'sea', 'wave', 'water', 'island', 'beach', 'tide', 'deep'],
    kind: 'wave',
    variants: ['ROLLING SWELL', 'TIDAL SURGE', 'CHOPPY CURRENT', 'CALM SHORELINE']
  },
  {
    key: 'space',
    label: 'Deep Space',
    background: '#0B0C1A',
    ink: '#FFFFFF',
    colors: ['#0B0C1A', '#8B5CF6', '#38BDF8', '#F3F4F6'],
    keywords: ['space', 'galaxy', 'planet', 'cosmic', 'orbit', 'asteroid', 'universe', 'alien'],
    kind: 'orbit',
    variants: ['ASTEROID DRIFT', 'ORBITAL PRECESSION', 'WARP VECTOR', 'COSMIC CORONA']
  },
  {
    key: 'sunset',
    label: 'Sunset',
    background: '#FF815A',
    ink: '#1B1014',
    colors: ['#FF815A', '#FFD35B', '#65284F', '#F8E9C9'],
    keywords: ['sunset', 'dusk', 'daylight', 'golden', 'evening', 'sundown'],
    kind: 'sun',
    variants: ['GOLDEN HOUR SLOW', 'HORIZON PULSE', 'SOLAR FLARE', 'DUSK GLOW']
  },
  {
    key: 'neon',
    label: 'Neon City',
    background: '#EB5BC3',
    ink: '#170A20',
    colors: ['#EB5BC3', '#70F1DE', '#211B43', '#F5E650'],
    keywords: ['city', 'neon', 'electric', 'dance', 'nightlife', 'lights', 'cyber', 'disco', 'club'],
    kind: 'city',
    variants: ['CYBER GLITCH', 'METROPOLIS GRID', 'STROBE BEAT', 'SYNTH WAVE DRIFT']
  },
  {
    key: 'blossom',
    label: 'Cherry Blossom',
    background: '#F5A8C7',
    ink: '#24111B',
    colors: ['#F5A8C7', '#FFE9DA', '#772B58', '#F4CC48'],
    keywords: ['cherry', 'blossom', 'flower', 'spring', 'petal', 'rose', 'bloom', 'flora'],
    kind: 'petal',
    variants: ['GENTLE FLUTTER', 'SPRING BREEZE', 'PETAL WHIRLWIND', 'FALLING BLOSSOM']
  }
];

export const byKey = (key: string): Scene | undefined => scenes.find(s => s.key === key);

export function hashTrackId(id: string = ''): number {
  let hash = 0;
  const str = String(id || '');
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function forTrack(scene: Scene, track: Track, dominant?: [string, string, string]): Scene {
  const trackId = track?.id || 'default_track_id';
  const hash = hashTrackId(trackId);
  const variantIndex = hash % 4;
  const palette = buildPalette(dominant, {
    bg: scene.background,
    surface: scene.colors[1],
    accent: scene.colors[2],
    accent2: scene.colors[3]
  }, songPaletteMap[trackId]);

  return {
    ...scene,
    background: palette.bg,
    ink: palette.onBg,
    colors: [palette.bg, palette.surface, palette.accent, palette.accent2],
    palette,
    motionVariant: variantIndex,
    motionName: scene.variants?.[variantIndex] || scene.variants[0],
    revision: trackId
  };
}

export function resolveScene(
  track: Track | null,
  genres: string[] = [],
  dominant?: [string, string, string],
  lyricText?: string
): Scene {
  if (!track) return byKey('stars')!;

  const trackId = track.id || '';

  // 1. Curated map
  if (trackId) {
    const mapped = songMap[trackId];
    if (mapped && byKey(mapped)) {
      return forTrack(byKey(mapped)!, track, dominant);
    }
  }

  // 2. Lyric keywords
  if (lyricText) {
    const lowerLyrics = lyricText.toLowerCase();
    for (const scene of scenes) {
      if (scene.keywords.some(word => lowerLyrics.includes(word))) {
        return forTrack(scene, track, dominant);
      }
    }
  }

  // 3. Title, album, artist keywords (Safe optional chaining)
  const trackName = track.name || '';
  const albumName = track.album?.name || '';
  const artistNames = Array.isArray(track.artists)
    ? track.artists.map(a => a?.name || '').join(' ')
    : '';
  const text = `${trackName} ${albumName} ${artistNames}`.toLowerCase();

  for (const scene of scenes) {
    if (scene.keywords.some(word => text.includes(word))) {
      return forTrack(scene, track, dominant);
    }
  }

  // 4. Artist genre
  const genre = Array.isArray(genres) ? genres.join(' ').toLowerCase() : '';
  if (/metal|rock|punk|hardcore/.test(genre)) return forTrack(byKey('ember')!, track, dominant);
  if (/electronic|dance|edm|techno|synth/.test(genre)) return forTrack(byKey('neon')!, track, dominant);
  if (/ambient|classical|folk|acoustic|chill/.test(genre)) return forTrack(byKey('snow')!, track, dominant);
  if (/reggae|tropical|soul|surf/.test(genre)) return forTrack(byKey('ocean')!, track, dominant);
  if (/hip hop|rap|trap|r&b/.test(genre)) return forTrack(byKey('thunder')!, track, dominant);
  if (/psychedelic|space|prog/.test(genre)) return forTrack(byKey('space')!, track, dominant);
  if (/latin|flamenco|afro/.test(genre)) return forTrack(byKey('desert')!, track, dominant);

  // 5. Album-art dominant colors fallback
  const colors = dominant || [];
  const hash = hashTrackId(trackId);
  const variantIndex = hash % 4;
  const artVariants: [string, string, string, string] = [
    'SPECTRUM DRIFT',
    'GEOMETRIC CASCADE',
    'COLOR RAIN',
    'ABSTRACT PULSE'
  ];

  const palette = buildPalette(colors, {
    bg: '#ED704F', surface: '#F6F0DD', accent: '#253B58', accent2: '#F3C43A'
  }, songPaletteMap[trackId]);

  return {
    key: 'art',
    label: 'Album colors',
    background: palette.bg,
    ink: palette.onBg,
    colors: [palette.bg, palette.surface, palette.accent, palette.accent2],
    palette,
    keywords: [],
    kind: 'art',
    variants: artVariants,
    motionVariant: variantIndex,
    motionName: artVariants[variantIndex],
    revision: trackId
  };
}
