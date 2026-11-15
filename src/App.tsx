import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  AlertTriangle,
  ArrowUpRight,
  AudioLines,
  Headphones,
  ListMusic,
  LogOut,
  RotateCcw,
  Search,
  X
} from 'lucide-react';
import { handleCallback, login, logout, validToken } from './auth/pkce';
import { spotify } from './spotify/api';
import type { Playback, Track } from './spotify/api';
import { usePlayer } from './store/player';
import { resolveScene, scenes } from './scenes/scenes';
import type { Scene } from './scenes/scenes';
import { buildPalette } from './color/palette';
import { extractAlbumColors } from './color/extract';
import { ContrastDebugOverlay } from './components/ContrastDebugOverlay';
import { SceneCanvas } from './components/SceneCanvas';
import { WipeTransition } from './components/WipeTransition';
import { WheelPlayer } from './components/WheelPlayer';
import type { ProgressState } from './components/WheelPlayer';
import { fetchLyrics } from './lyrics/client';
import type { LyricsRecord } from './lyrics/client';
import { HeroLyrics } from './lyrics/HeroLyrics';
import { UpNextQueue } from './components/UpNextQueue';
import { autoplayEngine } from './autoplay/autoplay';
import type { QueuedTrack } from './autoplay/autoplay';

type Playlist = {
  id: string;
  name: string;
  images?: { url: string }[];
  tracks?: { total: number };
};
type SearchResponse = { tracks?: { items: Track[] } };
type SDKTrack = {
  id: string;
  name: string;
  uri: string;
  artists?: { name: string; uri: string }[];
  album?: { name: string; images?: { url: string }[] };
  album_uri?: string;
  duration_ms: number;
};

const emptyProgress = (): ProgressState => ({
  position: 0,
  duration: 0,
  updatedAt: performance.now(),
  playing: false
});

function TrackStamp({ track }: { track: Track | null }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useGSAP(
    () => {
      if (!heading.current) return;
      gsap.fromTo(
        heading.current,
        { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.65, ease: 'power3.out' }
      );
    },
    { dependencies: [track?.id] }
  );
  return (
    <div className="stamp-mask">
      <h1 ref={heading} className="track-stamp">
        {(track?.name || 'SOUND BECOMES SPACE').toUpperCase()}
      </h1>
    </div>
  );
}

export default function App() {
  const { token, set, playlists: cachedPlaylists } = usePlayer();
  const [authError, setAuthError] = useState<string | null>(null);
  const [device, setDevice] = useState('');
  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const activeTrackId = useRef('');
  const progressRef = useRef<ProgressState>(emptyProgress());
  const player = useRef<SpotifyPlayer | null>(null);
  const [volume, setVolume] = useState(68);
  const [shuffle, setShuffle] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [startDismissed, setStartDismissed] = useState(() => {
    try { return sessionStorage.getItem('auraplayer_start_dismissed') === '1'; }
    catch { return false; }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>(cachedPlaylists || []);
  const [queue, setQueue] = useState<QueuedTrack[]>([]);
  const [autoplayEnabled, setAutoplayEnabled] = useState(autoplayEngine.isEnabled());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [dominant, setDominant] = useState<{ trackId: string; colors: [string, string, string] } | null>(null);
  const [lyrics, setLyrics] = useState<LyricsRecord | null>(null);
  const [notice, setNotice] = useState('');
  const [visibleScene, setVisibleScene] = useState<Scene>(scenes[3]); // Night Stars default
  const shellRef = useRef<HTMLElement>(null);
  const initialPalette = useMemo(() => buildPalette(undefined, {
    bg: scenes[3].background,
    surface: scenes[3].colors[1],
    accent: scenes[3].colors[2],
    accent2: scenes[3].colors[3]
  }), []);
  const noticeTimer = useRef<number>();

  activeTrackId.current = track?.id || '';

  // Scene choice resolution with safe fallback
  const lyricsText = lyrics?.plainLyrics || lyrics?.syncedLyrics || '';
  const albumColors = dominant && dominant.trackId === track?.id ? dominant.colors : undefined;
  const targetScene = useMemo(() => {
    try {
      return resolveScene(track, genres, albumColors, lyricsText);
    } catch {
      return scenes[3];
    }
  }, [track, genres, albumColors, lyricsText]);

  const applyScene = useCallback((scene: Scene) => {
    setVisibleScene(scene);
    const palette = scene.palette || buildPalette(undefined, {
      bg: scene.background, surface: scene.colors[1], accent: scene.colors[2], accent2: scene.colors[3]
    });
    const shell = shellRef.current;
    if (!shell) return;
    gsap.to(shell, {
      '--bg': palette.bg,
      '--surface': palette.surface,
      '--accent': palette.accent,
      '--accent-2': palette.accent2,
      '--ink': palette.ink,
      '--paper': palette.paper,
      '--on-bg': palette.onBg,
      '--on-surface': palette.onSurface,
      '--on-accent': palette.onAccent,
      '--on-accent-alt': palette.onAccentAlt,
      duration: 0.8,
      ease: 'power2.inOut',
      overwrite: true
    });
  }, []);

  const announce = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Spotify could not complete that request.';
      set({ error: message, loading: false });
      setNotice(message);
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(''), 5500);
    },
    [set]
  );

  const commitTrack = useCallback((next: Track | null) => {
    if (!next) {
      activeTrackId.current = '';
      setTrack(null);
      return;
    }
    // Ensure all fields have safe defaults
    const safeTrack: Track = {
      id: next.id || '',
      name: next.name || 'Unknown Track',
      uri: next.uri || '',
      duration_ms: next.duration_ms || 0,
      artists: Array.isArray(next.artists) ? next.artists : [],
      album: {
        name: next.album?.name || '',
        images: Array.isArray(next.album?.images) ? next.album.images : []
      }
    };
    activeTrackId.current = safeTrack.id;
    setTrack(safeTrack);
    if (safeTrack.uri) {
      autoplayEngine.markTrackPlayed(safeTrack.uri);
    }
  }, []);

  const updatePlayback = (state: Playback | null) => {
    if (!state) return;
    if (state.item) {
      progressRef.current = {
        position: state.progress_ms || 0,
        duration: state.item.duration_ms || 0,
        updatedAt: performance.now(),
        playing: state.is_playing
      };
      commitTrack(state.item);
    }
    playingRef.current = !!state.is_playing;
    setPlaying(!!state.is_playing);
    setShuffle(!!state.shuffle_state);
    if (state.device?.volume_percent != null) setVolume(state.device.volume_percent);
  };

  const fetchInitialState = useCallback(async () => {
    try {
      const state = await spotify<Playback>('/me/player');
      updatePlayback(state);
      return state;
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('No active'))) {
        announce(error);
      }
      return null;
    }
  }, [announce, commitTrack]);

  const loadQueue = useCallback(async () => {
    try {
      const data = await spotify<{ queue: Track[] }>('/me/player/queue');
      const seen = new Set<string>();
      const upNext: QueuedTrack[] = [];
      for (const item of data?.queue || []) {
        if (!item) continue;
        const key = item.id || item.uri;
        if (!key || key === activeTrackId.current || seen.has(key)) continue;
        seen.add(key);
        upNext.push({
          ...item,
          artists: Array.isArray(item.artists) ? item.artists : [],
          album: {
            name: item.album?.name || '',
            images: Array.isArray(item.album?.images) ? item.album.images : []
          },
          isAutoplay: autoplayEngine.isAutoQueued(item.uri)
        });
      }
      setQueue(upNext);
      return upNext;
    } catch {
      return [];
    }
  }, []);

  const syncSdkState = useCallback(
    (state: any) => {
      if (!state) return;
      const item = state.track_window?.current_track as SDKTrack | undefined;
      const isPlaying = !state.paused;
      progressRef.current = {
        position: state.position || 0,
        duration: state.duration || 0,
        updatedAt: performance.now(),
        playing: isPlaying
      };
      if (playingRef.current !== isPlaying) {
        playingRef.current = isPlaying;
        setPlaying(isPlaying);
      }
      if (item?.id && item.id !== activeTrackId.current) {
        commitTrack({
          id: item.id,
          name: item.name || '',
          uri: item.uri || '',
          duration_ms: item.duration_ms || 0,
          artists: Array.isArray(item.artists)
            ? item.artists.map(artist => ({
                name: artist.name || '',
                id: (artist.uri || '').split(':').pop() || ''
              }))
            : [],
          album: {
            name: item.album?.name || '',
            images: Array.isArray(item.album?.images) ? item.album.images : []
          }
        });
        void (async () => {
          const playback = await fetchInitialState();
          if (playback?.item?.id === item.id && playback.item.album?.images?.length) return;
          try {
            const full = await spotify<Track>(`/tracks/${item.id}`);
            if (full) commitTrack(full);
          } catch {}
        })();
      }
    },
    [commitTrack, fetchInitialState]
  );

  // StrictMode-guarded single-flight auth callback handler
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const callbackResult = await handleCallback();
        if (!mounted) return;
        if (!callbackResult.success && callbackResult.error) {
          setAuthError(callbackResult.error);
          announce(callbackResult.error);
          return;
        }

        const access = await validToken();
        if (!mounted) return;
        if (!access) return;

        set({ token: access });
        setAuthError(null);

        // Fetch playlists non-fatally so playlist issues never crash authentication
        try {
          const data = await spotify<{ items: Playlist[] }>('/me/playlists?limit=20');
          if (mounted && data?.items) {
            const cleanPlaylists = data.items.filter(Boolean);
            setPlaylists(cleanPlaylists);
            set({ playlists: cleanPlaylists });
          }
        } catch (playlistErr) {
          console.warn('Could not load playlists (non-fatal):', playlistErr);
        }
      } catch (error) {
        if (!mounted) return;
        const msg = error instanceof Error ? error.message : 'Spotify authentication error.';
        setAuthError(msg);
        announce(error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [announce, set]);

  // Safe genres lookup
  useEffect(() => {
    const artistId = track?.artists?.[0]?.id;
    if (!artistId) {
      setGenres([]);
      return;
    }
    let stale = false;
    setGenres([]);
    void spotify<{ genres: string[] }>(`/artists/${artistId}`)
      .then(data => {
        if (!stale) setGenres(data?.genres || []);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [track?.id, track?.artists?.[0]?.id]);

  // Safe dominant color sampling
  useEffect(() => {
    setDominant(null);
    const url = track?.album?.images?.[0]?.url;
    if (!url) return;
    let stale = false;
    void extractAlbumColors(track?.id || url, url).then(colors => {
      if (!stale && colors.length) setDominant({
        trackId: track?.id || url,
        colors: [colors[0] || '', colors[1] || '', colors[2] || '']
      });
    });
    return () => {
      stale = true;
    };
  }, [track?.id, track?.album?.images?.[0]?.url]);

  // LRCLib Lyrics Fetching
  useEffect(() => {
    setLyrics(null);
    if (!track?.name) return;
    const controller = new AbortController();
    void fetchLyrics(track, controller.signal).then(result => {
      if (!controller.signal.aborted) setLyrics(result);
    }).catch(() => {});
    return () => controller.abort();
  }, [track?.id]);

  // Autoplay Trigger on Track Change
  useEffect(() => {
    if (!track?.id || !device) return;
    void (async () => {
      const currentQ = await loadQueue();
      const added = await autoplayEngine.ensureAutoplay(track, device, currentQ);
      if (added.length > 0) {
        await loadQueue();
      }
    })();
  }, [track?.id, device, loadQueue]);

  // Spotify Web Playback SDK setup
  useEffect(() => {
    if (!token) return;
    let instance: SpotifyPlayer | null = null;
    let alive = true;

    const ready = () => {
      if (!alive || !window.Spotify) return;
      instance = new window.Spotify.Player({
        name: 'AURA//PLAYER',
        getOAuthToken: async callback => {
          try {
            const t = await validToken();
            if (t) {
              callback(t);
            } else {
              set({ token: null });
              announce(new Error('Spotify session expired. Connect again.'));
            }
          } catch (err) {
            console.error('getOAuthToken error:', err);
            set({ token: null });
            announce(err instanceof Error ? err : new Error('Spotify token retrieval failed.'));
          }
        },
        volume: volume / 100
      });
      player.current = instance;

      instance.addListener('ready', async ({ device_id }: any) => {
        if (!alive) return;
        setDevice(device_id);
        try {
          await spotify('/me/player', {
            method: 'PUT',
            body: JSON.stringify({ device_ids: [device_id] })
          });
          await instance?.activateElement().catch(() => {});
          await fetchInitialState();
          await loadQueue();
        } catch (error) {
          announce(error);
        }
      });

      instance.addListener('not_ready', () => setDevice(''));
      instance.addListener('initialization_error', ({ message }: any) =>
        announce(new Error(message))
      );
      instance.addListener('authentication_error', ({ message }: any) =>
        announce(new Error(message))
      );
      instance.addListener('account_error', ({ message }: any) =>
        announce(new Error(message || 'Spotify Premium is required for browser playback.'))
      );
      instance.addListener('player_state_changed', (state: any) => syncSdkState(state));

      void instance.connect().then(ok => {
        if (!ok && alive) {
          announce(
            new Error('AuraPlayer could not connect. Check Spotify Premium and browser support.')
          );
        }
      });
    };

    if (window.Spotify) {
      ready();
    } else {
      window.onSpotifyWebPlaybackSDKReady = ready;
      if (!document.getElementById('spotify-player-sdk-script')) {
        const script = document.createElement('script');
        script.id = 'spotify-player-sdk-script';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      alive = false;
      instance?.disconnect();
      player.current = null;
    };
  }, [token, announce, fetchInitialState, syncSdkState, loadQueue]);

  // Search query debounce
  useEffect(() => {
    let timeout: number | undefined;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timeout = window.setTimeout(async () => {
      try {
        const data = await spotify<SearchResponse>(
          `/search?type=track&limit=8&q=${encodeURIComponent(query.trim())}`
        );
        const items = data?.tracks?.items || [];
        setResults(items.filter(Boolean));
      } catch (error) {
        announce(error);
      }
    }, 240);
    return () => window.clearTimeout(timeout);
  }, [query, announce]);

  const toggle = async () => {
    try {
      if (!player.current) throw new Error('Connect Spotify to start the player.');
      await player.current.activateElement();
      await player.current.togglePlay();
    } catch (error) {
      announce(error);
    }
  };

  const command = async (path: 'next' | 'previous') => {
    try {
      if (player.current) {
        if (path === 'next') await player.current.nextTrack();
        else await player.current.previousTrack();
        return;
      }
      if (!device) throw new Error('Start AuraPlayer to make it an active Spotify device.');
      await spotify(`/me/player/${path}?device_id=${device}`, { method: 'POST' });
    } catch (error) {
      announce(error);
    }
  };

  const seek = async (fraction: number) => {
    const p = progressRef.current;
    const duration = p.duration || 0;
    const position = Math.max(0, Math.min(duration, fraction * duration));
    progressRef.current = { ...p, position, updatedAt: performance.now() };
    try {
      await player.current?.seek(position);
    } catch (error) {
      announce(error);
    }
  };

  const setVolumeValue = async (value: number) => {
    setVolume(value);
    try {
      if (player.current) await player.current.setVolume(value / 100);
      else await spotify(`/me/player/volume?volume_percent=${value}`, { method: 'PUT' });
    } catch (error) {
      announce(error);
    }
  };

  const playTrack = async (selected: Track) => {
    try {
      if (!device) throw new Error('Connect AuraPlayer first, then select a track.');
      autoplayEngine.setContextPlay(false);
      await player.current?.activateElement();
      await spotify(`/me/player/play?device_id=${device}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [selected.uri] })
      });
      commitTrack(selected);
      progressRef.current = {
        position: 0,
        duration: selected.duration_ms || 0,
        updatedAt: performance.now(),
        playing: true
      };
      playingRef.current = true;
      setPlaying(true);
      setSearchOpen(false);
      setPlaylistOpen(false);
      await loadQueue();
    } catch (error) {
      announce(error);
    }
  };

  const playPlaylist = async (id: string) => {
    try {
      if (!device) throw new Error('Connect AuraPlayer first, then select a playlist.');
      autoplayEngine.setContextPlay(true);
      await spotify(`/me/player/play?device_id=${device}`, {
        method: 'PUT',
        body: JSON.stringify({ context_uri: `spotify:playlist:${id}` })
      });
      setPlaylistOpen(false);
      await loadQueue();
    } catch (error) {
      announce(error);
    }
  };

  const shuffleToggle = async () => {
    const next = !shuffle;
    setShuffle(next);
    try {
      await spotify(`/me/player/shuffle?state=${next}`, { method: 'PUT' });
    } catch (error) {
      announce(error);
    }
  };

  const toggleAutoplay = () => {
    const next = !autoplayEngine.isEnabled();
    autoplayEngine.setEnabled(next);
    setAutoplayEnabled(next);
    setNotice(`Spotify Autoplay ${next ? 'ENABLED' : 'PAUSED'}.`);
  };

  const clearQueue = () => {
    autoplayEngine.clearQueueTracking();
    setQueue([]);
    setNotice('Upcoming queue cleared.');
  };

  const connect = async () => {
    try {
      await login();
    } catch (error) {
      announce(error);
    }
  };

  const closeLibrary = () => {
    setSearchOpen(false);
    setPlaylistOpen(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches('input,textarea,button')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        void toggle();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (event.shiftKey) void command('next');
        else {
          void seek(
            (progressRef.current.position + 5000) / Math.max(progressRef.current.duration, 1)
          );
        }
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (event.shiftKey) void command('previous');
        else {
          void seek(
            (progressRef.current.position - 5000) / Math.max(progressRef.current.duration, 1)
          );
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [device]);

  // Requirement 2: Clear Error Screen with "TRY AGAIN" button on failed auth
  if (authError) {
    return (
      <main className="app-shell error-boundary-screen">
        <div className="error-boundary-card">
          <div className="error-card-badge">
            <AlertTriangle size={16} />
            <span>SPOTIFY AUTHENTICATION FAILED</span>
          </div>
          <h1 className="error-card-title">CONNECTION ERROR</h1>
          <p className="error-card-lead">{authError}</p>
          <div className="error-actions-row">
            <button
              className="error-reset-btn"
              onClick={() => {
                logout();
                setAuthError(null);
                set({ token: null });
                void connect();
              }}
            >
              <RotateCcw size={16} />
              <span>TRY AGAIN</span>
            </button>
            <button className="error-reload-btn" onClick={connect}>
              <RotateCcw size={16} />
              <span>RECONNECT SPOTIFY ↗</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={shellRef}
      className={`app-shell ${expanded ? 'is-player-expanded' : ''}`}
      style={
        {
          '--bg': initialPalette.bg,
          '--surface': initialPalette.surface,
          '--accent': initialPalette.accent,
          '--accent-2': initialPalette.accent2,
          '--ink': initialPalette.ink,
          '--paper': initialPalette.paper,
          '--on-bg': initialPalette.onBg,
          '--on-surface': initialPalette.onSurface,
          '--on-accent': initialPalette.onAccent,
          '--on-accent-alt': initialPalette.onAccentAlt
        } as React.CSSProperties
      }
    >
      {/* Background persistent canvas scene */}
      <SceneCanvas scene={visibleScene} playing={playing} />
      <WipeTransition scene={targetScene} onSwap={applyScene} />
      <div className="grid-veil" aria-hidden="true" />

      {/* Top Masthead */}
      <header className="masthead">
        <a className="wordmark" href="#home" aria-label="Aura Player">
          AURA<span>//</span>PLAYER
        </a>
        <span className="mast-sticker">SCENE ENGINE / LIVE</span>
        <div className="mast-actions">
          <button
            className={`mast-queue-btn ${queueOpen ? 'is-active' : ''}`}
            onClick={() => setQueueOpen(!queueOpen)}
            title="Toggle Up Next Queue Panel"
          >
            <ListMusic size={14} /> UP NEXT ({queue.length})
          </button>
          <span className="device-state">
            <i className={device ? 'online' : ''} />
            {device ? 'PLAYER READY' : 'SPOTIFY OFFLINE'}
          </span>
          {token ? (
            <button
              className="sign-button"
              onClick={() => {
                logout();
                player.current?.disconnect();
                set({ token: null });
                setDevice('');
              }}
            >
              <LogOut size={15} /> DISCONNECT
            </button>
          ) : (
            <button className="sign-button" onClick={connect}>
              <span className="spotify-glyph">●</span> CONNECT SPOTIFY <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      </header>

      {/* Main Center Stage with Hero Lyrics */}
      <section id="home" className="hero-layout">
        <div className="hero-meta">
          <span>ISSUE 002 / SOUND AS SPACE</span>
          <span>
            SCENE 0{Math.max(1, scenes.findIndex(s => s.key === visibleScene.key) + 1)} —{' '}
            {visibleScene.label.toUpperCase()}
          </span>
        </div>

        <TrackStamp track={track} />

        <HeroLyrics
          trackId={track?.id}
          lyrics={lyrics}
          progressRef={progressRef}
          onSeek={fraction => void seek(fraction)}
        />

        <div className="hero-lower">
          <div className="hero-credit">
            <span className="credit-tag">NOW PLAYING</span>
            <p>
              {Array.isArray(track?.artists) && track.artists.length > 0
                ? track.artists.map(a => a?.name || '').filter(Boolean).join(' / ') ||
                  'YOUR NEXT FAVORITE TRACK'
                : 'YOUR NEXT FAVORITE TRACK'}
            </p>
            <small>{track?.album?.name || 'CONNECT YOUR SPOTIFY TO BEGIN'}</small>
          </div>
          <div className="hero-artwork">
            {track?.album?.images?.[0]?.url ? (
              <img src={track.album.images[0].url} alt={`${track.name || 'Album'} cover art`} />
            ) : (
              <div className="art-placeholder">
                <AudioLines size={42} />
              </div>
            )}
            <b>ART / 01</b>
          </div>
          <div className="hero-facts">
            <span>ATMOSPHERE</span>
            <strong>{visibleScene.label.toUpperCase()}</strong>
            <span>MOTION</span>
            <strong>{visibleScene.motionName || 'DYNAMIC'}</strong>
            <span>RUNTIME</span>
            <strong>{track?.duration_ms ? fmt(track.duration_ms) : '0:00'}</strong>
          </div>
        </div>
      </section>

      {/* Ticker marquee */}
      <div className="ticker" aria-label="Aura Player scene ticker">
        <div className="ticker-track">
          <span>PLAY IT LOUD</span>
          <b>✳</b>
          <span>SEE WHAT YOU HEAR</span>
          <b>✳</b>
          <span>EVERY TRACK MAKES A PLACE</span>
          <b>✳</b>
          <span>PLAY IT LOUD</span>
          <b>✳</b>
          <span>SEE WHAT YOU HEAR</span>
          <b>✳</b>
        </div>
      </div>
      <div className="corner-note">
        <span>DESIGNED FOR THE FEELING</span>
        <strong>✳</strong>
        <span>VOL. 02 / 2026</span>
      </div>

      {/* Circular Wheel Player */}
      <WheelPlayer
        track={track}
        scene={visibleScene}
        playing={playing}
        progressRef={progressRef}
        volume={volume}
        shuffle={shuffle}
        expanded={expanded}
        lyrics={lyrics}
        onToggle={() => void toggle()}
        onNext={() => void command('next')}
        onPrev={() => void command('previous')}
        onSeek={fraction => void seek(fraction)}
        onVolume={value => void setVolumeValue(value)}
        onShuffle={() => void shuffleToggle()}
        onSearch={() => {
          setExpanded(false);
          setSearchOpen(true);
        }}
        onQueue={() => {
          setExpanded(false);
          setQueueOpen(true);
        }}
        onExpand={() => setExpanded(true)}
        onClose={() => setExpanded(false)}
        onNotice={msg => setNotice(msg)}
      />
      <ContrastDebugOverlay />

      {/* Dedicated UP NEXT Queue Dock */}
      <UpNextQueue
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        queue={queue}
        autoplayEnabled={autoplayEnabled}
        onToggleAutoplay={toggleAutoplay}
        onClearQueue={clearQueue}
        onPlayTrack={item => void playTrack(item)}
      />

      {!token && (
        <div className="connect-note">
          <span>FIRST, THE GOOD STUFF.</span>
          <button onClick={connect}>
            CONNECT SPOTIFY <ArrowUpRight size={15} />
          </button>
        </div>
      )}

      {token && device && !playing && !startDismissed && (
        <div className="start-overlay-backdrop" role="dialog" aria-modal="true" aria-label="Start Spotify playback">
          <button className="start-overlay" onClick={() => {
            setStartDismissed(true);
            try { sessionStorage.setItem('auraplayer_start_dismissed', '1'); } catch { /* storage may be unavailable */ }
            void toggle();
          }}>
            <span>▶</span> CLICK TO START
          </button>
        </div>
      )}

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search & Playlist Drawers */}
      <section
        className={`library ${searchOpen || playlistOpen ? 'library-open' : ''}`}
        aria-hidden={!searchOpen && !playlistOpen}
      >
        <header>
          <div>
            <small>YOUR SOUND ARCHIVE / 001</small>
            <h2>{searchOpen ? 'FIND A TRACK' : 'YOUR PLAYLISTS'}</h2>
          </div>
          <button className="close-library" onClick={closeLibrary} aria-label="Close library">
            ×
          </button>
        </header>

        {searchOpen ? (
          <label className="search-box">
            <Search size={18} />
            <input
              autoFocus
              placeholder="Search track, artist, album"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </label>
        ) : null}

        <div className="library-list">
          {searchOpen
            ? results.map(item => (
                <button
                  className="library-row"
                  key={item?.id || Math.random()}
                  onClick={() => item && void playTrack(item)}
                >
                  {item?.album?.images?.[0]?.url ? (
                    <img src={item.album.images[0].url} alt="" />
                  ) : (
                    <span className="library-art">
                      <Headphones />
                    </span>
                  )}
                  <span>
                    <strong>{item?.name || 'Unknown Track'}</strong>
                    <small>
                      {Array.isArray(item?.artists)
                        ? item.artists.map(a => a?.name || '').join(', ')
                        : ''}{' '}
                      / {item?.album?.name || ''}
                    </small>
                  </span>
                  <b>PLAY ↗</b>
                </button>
              ))
            : playlists.map(list => (
                <button
                  className="library-row"
                  key={list?.id || Math.random()}
                  onClick={() => list?.id && void playPlaylist(list.id)}
                >
                  {list?.images?.[0]?.url ? (
                    <img src={list.images[0].url} alt="" />
                  ) : (
                    <span className="library-art">
                      <Headphones />
                    </span>
                  )}
                  <span>
                    <strong>{list?.name || 'Untitled Playlist'}</strong>
                    <small>{list?.tracks?.total ?? 0} TRACKS</small>
                  </span>
                  <b>OPEN ↗</b>
                </button>
              ))}
          {searchOpen && !results.length ? (
            <p className="empty-library">TYPE TWO LETTERS TO SEARCH SPOTIFY.</p>
          ) : null}
          {playlistOpen && !playlists.length ? (
            <p className="empty-library">NO PLAYLISTS FOUND.</p>
          ) : null}
        </div>

        <footer>
          <button
            onClick={() => {
              closeLibrary();
              setSearchOpen(true);
            }}
          >
            <Search size={15} /> SEARCH
          </button>
          <button
            onClick={async () => {
              try {
                const data = await spotify<{ items: Playlist[] }>('/me/playlists?limit=30');
                setPlaylists((data?.items || []).filter(Boolean));
                closeLibrary();
                setPlaylistOpen(true);
              } catch (error) {
                announce(error);
              }
            }}
          >
            PLAYLISTS
          </button>
        </footer>
      </section>
    </main>
  );
}

const fmt = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
