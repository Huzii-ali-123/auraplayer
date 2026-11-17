import { spotify } from '../spotify/api';
import type { SpotifyTrack } from '../spotify/api';

class AutoplayEngine {
  private playedUris = new Set<string>();
  private autoQueuedUris = new Set<string>();
  private enabled = true;
  private isProcessing = false;
  private isContextPlay = false; // Set to true if playback is tied to an album or playlist context
  private pending: Promise<SpotifyTrack[]> | null = null;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  public setContextPlay(val: boolean) {
    this.isContextPlay = val;
  }

  public hasContextPlay(): boolean {
    return this.isContextPlay;
  }

  public markTrackPlayed(uri: string) {
    if (uri) this.playedUris.add(uri);
  }

  public isAutoQueued(uri: string): boolean {
    return this.autoQueuedUris.has(uri);
  }

  public clearQueueTracking() {
    this.autoQueuedUris.clear();
  }

  /**
   * Checks current queue length and tops up with Last.fm recommendations if < 5 tracks
   */
  public ensureAutoplay(
    currentTrack: SpotifyTrack,
    deviceId: string,
    existingQueue: SpotifyTrack[]
  ): Promise<SpotifyTrack[]> {
    if (!this.enabled || this.isContextPlay || !deviceId || !currentTrack) {
      return Promise.resolve([]);
    }

    // Share ongoing work so a fast Skip click waits for recommendations rather
    // than racing the queue fill started when the track first began playing.
    if (this.pending) return this.pending;
    this.pending = this.fillQueue(currentTrack, deviceId, existingQueue);
    return this.pending.finally(() => { this.pending = null; });
  }

  private async fillQueue(
    currentTrack: SpotifyTrack,
    deviceId: string,
    existingQueue: SpotifyTrack[]
  ): Promise<SpotifyTrack[]> {
    if (!this.enabled || this.isContextPlay || !deviceId || !currentTrack) return [];

    // Filter upcoming tracks that are not already the current track
    const upcoming = existingQueue.filter(
      t => t.id !== currentTrack.id && t.uri !== currentTrack.uri
    );

    if (upcoming.length >= 5) {
      return [];
    }

    if (this.isProcessing) return [];
    this.isProcessing = true;

    try {
      this.markTrackPlayed(currentTrack.uri);

      const apiKey = import.meta.env.VITE_LASTFM_API_KEY as string | undefined;
      const primaryArtist = currentTrack.artists[0]?.name || '';
      const trackTitle = currentTrack.name;

      type Candidate = { title: string; artist: string };
      let candidates: Candidate[] = [];

      if (apiKey && primaryArtist) {
        // 1. Try track.getSimilar
        try {
          const res = await fetch(
            `https://ws.audioscrobbler.com/2.0/?method=track.getSimilar&artist=${encodeURIComponent(
              primaryArtist
            )}&track=${encodeURIComponent(trackTitle)}&api_key=${apiKey}&format=json&limit=10`
          );
          if (res.ok) {
            const data = await res.json();
            const tracks = data?.similartracks?.track;
            if (Array.isArray(tracks)) {
              for (const item of tracks) {
                const title = item.name;
                const artist = typeof item.artist === 'string' ? item.artist : item.artist?.name;
                if (title && artist) candidates.push({ title, artist });
              }
            }
          }
        } catch {
          // Quietly handle Last.fm failure
        }

        // 2. Fall back to artist.getSimilar + artist.getTopTracks if needed
        if (candidates.length < 3) {
          try {
            const res = await fetch(
              `https://ws.audioscrobbler.com/2.0/?method=artist.getSimilar&artist=${encodeURIComponent(
                primaryArtist
              )}&api_key=${apiKey}&format=json&limit=4`
            );
            if (res.ok) {
              const data = await res.json();
              const similarArtists = data?.similarartists?.artist;
              if (Array.isArray(similarArtists)) {
                for (const sim of similarArtists.slice(0, 3)) {
                  const simName = sim.name;
                  if (!simName) continue;
                  const topRes = await fetch(
                    `https://ws.audioscrobbler.com/2.0/?method=artist.getTopTracks&artist=${encodeURIComponent(
                      simName
                    )}&api_key=${apiKey}&format=json&limit=3`
                  );
                  if (topRes.ok) {
                    const topData = await topRes.json();
                    const topTracks = topData?.toptracks?.track;
                    if (Array.isArray(topTracks)) {
                      for (const t of topTracks) {
                        if (t.name) candidates.push({ title: t.name, artist: simName });
                      }
                    }
                  }
                }
              }
            }
          } catch {
            // Quietly ignore
          }
        }
      }

      // If Last.fm was unavailable or returned nothing, fall back to searching tracks with Spotify genre/artist
      if (candidates.length === 0 && primaryArtist) {
        candidates.push({ title: '', artist: primaryArtist });
      }

      const neededCount = Math.min(8 - upcoming.length, 8);
      const resolvedTracks: SpotifyTrack[] = [];

      for (const cand of candidates) {
        if (resolvedTracks.length >= neededCount) break;

        const query = cand.title
          ? `track:${cand.title} artist:${cand.artist}`
          : `artist:${cand.artist}`;

        try {
          const searchRes = await spotify<{ tracks: { items: SpotifyTrack[] } }>(
            `/search?type=track&limit=3&q=${encodeURIComponent(query)}`
          );
          const foundItems = searchRes?.tracks?.items || [];
          for (const item of foundItems) {
            if (
              item.id === currentTrack.id ||
              item.uri === currentTrack.uri ||
              this.playedUris.has(item.uri) ||
              this.autoQueuedUris.has(item.uri) ||
              upcoming.some(u => u.uri === item.uri) ||
              resolvedTracks.some(r => r.uri === item.uri)
            ) {
              continue;
            }
            resolvedTracks.push(item);
            this.autoQueuedUris.add(item.uri);
            break;
          }
        } catch {
          // Search failure - continue quietly
        }
      }

      // Enqueue to Spotify queue with 300ms intervals
      for (const track of resolvedTracks) {
        try {
          await spotify(`/me/player/queue?uri=${encodeURIComponent(track.uri)}&device_id=${deviceId}`, {
            method: 'POST'
          });
          await new Promise(resolve => setTimeout(resolve, 320));
        } catch {
          // Failure enqueuing individual track
        }
      }

      return resolvedTracks;
    } finally {
      this.isProcessing = false;
    }
  }
}

export const autoplayEngine = new AutoplayEngine();
