import { spotifyProvider } from './spotify';
import type { ProviderCatalogEntry, ProviderId, MusicProvider } from './types';

export const providers: Partial<Record<ProviderId, MusicProvider>> = {
  spotify: spotifyProvider
};

export const providerCatalog: ProviderCatalogEntry[] = [
  {
    id: 'spotify', name: 'Spotify', integration: 'full',
    summary: 'The current complete provider integration.',
    capabilities: ['Search', 'Playlists', 'Playback controls', 'Seek', 'Volume', 'Shuffle', 'Repeat'],
    requirement: 'A Spotify Premium account is required for in-browser playback.'
  },
  {
    id: 'apple-music', name: 'Apple Music', integration: 'not-implemented',
    summary: 'Official MusicKit supports catalog/library access and web playback, but AuraPlayer does not yet implement it.',
    capabilities: ['Official web playback SDK exists', 'Catalog and library APIs'],
    requirement: 'Needs an Apple developer team, a server-signed MusicKit developer token, and the user’s Apple Music authorization/subscription.'
  },
  {
    id: 'soundcloud', name: 'SoundCloud', integration: 'not-implemented',
    summary: 'An official API and OAuth 2.1 PKCE flow exist; AuraPlayer has not integrated them.',
    capabilities: ['Search and metadata API', 'Track streaming where permitted'],
    requirement: 'Needs an approved SoundCloud app/API credentials. Streams can be blocked, preview-only, paywalled, or region-limited; refresh tokens are single-use.'
  },
  {
    id: 'youtube-music', name: 'YouTube Music', integration: 'not-available',
    summary: 'No official YouTube Music consumer playback/library integration is available in AuraPlayer.',
    capabilities: ['YouTube video embeds are a separate product/API'],
    requirement: 'Google’s official IFrame API controls embedded YouTube videos; it does not connect a YouTube Music account or its library.'
  },
  {
    id: 'youtube-videos', name: 'YouTube videos', integration: 'full',
    summary: 'Public YouTube music videos use the official Data API and visible IFrame Player. No account login is used.',
    capabilities: ['Search music-category videos', 'Embedded video playback', 'Local queue', 'Seek and volume'],
    requirement: 'Needs a Google Cloud YouTube Data API v3 key restricted to the deployed website; quota applies.'
  }
];
