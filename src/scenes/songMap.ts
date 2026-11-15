import type { PaletteSeeds } from '../color/palette';

// Add a scene exception as: 'spotify_track_id': 'scene-key',
export const songMap: Record<string,string> = {
  '7uoFMmxln0GPXQ0AcCBXRq': 'snow', // Snowman — Sia
};

// Optional one-line art-direction overrides. Values still pass through contrast validation.
export const songPaletteMap: Record<string, PaletteSeeds> = {
  '7uoFMmxln0GPXQ0AcCBXRq': { bg: '#5eb6cf', surface: '#e9f8fa', accent: '#ff758c', accent2: '#f4cf67' }
};
