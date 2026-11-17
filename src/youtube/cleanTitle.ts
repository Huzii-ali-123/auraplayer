export type CleanVideoMetadata = { title: string; artist: string };

export function cleanVideoMetadata(rawTitle: string, rawChannel: string): CleanVideoMetadata {
  const channel = (rawChannel || '').replace(/\s+-\s+Topic\s*$/i, '').trim();
  let title = (rawTitle || '')
    .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, ' ')
    .replace(/\s*\|\s*(?:HD|4K|8K|OFFICIAL.*)$/i, ' ')
    .replace(/\s+(?:ft\.?|feat\.?)\s+.*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let artist = channel;
  const split = title.match(/^(.{1,80}?)\s+-\s+(.{1,180})$/);
  if (split) {
    artist = split[1].trim();
    title = split[2].trim();
  }
  return { title: title || rawTitle.trim() || 'Unknown video', artist: artist || 'Unknown artist' };
}

export function parseIsoDuration(value: string): number {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return ((Number(match[1]) || 0) * 3600 + (Number(match[2]) || 0) * 60 + (Number(match[3]) || 0)) * 1000;
}
