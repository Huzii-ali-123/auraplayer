import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  AlertTriangle,
  ArrowUpRight,
  AudioLines,
  Download,
  Headphones,
  LibraryBig,
  ListMusic,
  Music2,
  RotateCcw,
  Search,
  X
} from 'lucide-react';
import { handleCallback, validToken } from './auth/pkce';
import { spotify, SpotifyAccessLimitedError } from './spotify/api';
import type { Playback, SpotifyTrack } from './spotify/api';
import { fromSpotifyTrack, toSpotifyTrack, type Track, type QueueTrack, type SourceId } from './player/types';
import { SpotifySource } from './player/source';
import { searchYouTube, getYouTubeQuota } from './youtube/api';
import { fillYouTubeQueue } from './youtube/autoplay';
import { YouTubeSource } from './youtube/source';
import { usePlayer } from './store/player';
import { resolveScene, scenes } from './scenes/scenes';
import type { Scene } from './scenes/scenes';
import { buildPalette } from './color/palette';
import { extractAlbumColors } from './color/extract';
import { cleanVideoMetadata } from './youtube/cleanTitle';
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
import { YouTubeSourceCard } from './components/YouTubeSourceCard';
import { spotifyProvider } from './providers/spotify';
import { ConnectedServices } from './components/ConnectedServices';

type Playlist = {
  id: string;
  name: string;
  images?: { url: string }[];
  tracks?: { total: number };
};
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
  const title = (track?.title || 'SOUND BECOMES SPACE').toUpperCase();
  const titleLength = title.length;
  const fontSize = titleLength <= 8
    ? 'clamp(3.8rem, 8vw, 9.5rem)'
    : titleLength <= 20
      ? 'clamp(3rem, 6vw, 6rem)'
      : titleLength <= 36
        ? 'clamp(2.25rem, 4.5vw, 4.5rem)'
        : 'clamp(1.65rem, 3.1vw, 3.1rem)';
  useGSAP(
    () => {
      if (!heading.current) return;
      gsap.fromTo(
        heading.current,
        { yPercent: 16, opacity: 0.35 },
        { yPercent: 0, opacity: 1, duration: 0.48, ease: 'power3.out' }
      );
    },
    { dependencies: [track?.source, track?.id] }
  );
  return (
    <div className="stamp-mask">
      <h1 ref={heading} className="track-stamp" style={{ fontSize }}>
        {title}
      </h1>
    </div>
  );
}

function HeroArtwork({ track }: { track: Track | null }) {
  const frame = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (!frame.current) return;
    gsap.fromTo(frame.current, { opacity: 0.65, y: 12, scale: 0.985 }, {
      opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', overwrite: true
    });
  }, { dependencies: [track?.source, track?.id] });

  return (
    <div className="hero-artwork" ref={frame}>
      <div className="hero-art-mat">
        {track?.artworkUrl ? (
          <img src={track.artworkUrl} alt={`${track.title || 'Album'} cover art`} />
        ) : (
          <div className="art-placeholder"><AudioLines size={42} /></div>
        )}
      </div>
      <b>ART / 01</b>
    </div>
  );
}

export default function App() {
  const { token, set, playlists: cachedPlaylists, activeSource, connections, currentTrack: track } = usePlayer();
  const source: SourceId = activeSource || 'spotify';
  const sourceRef = useRef<SourceId | null>(activeSource);
  const [authError, setAuthError] = useState<string | null>(null);
  const [spotifyAccessLimited, setSpotifyAccessLimited] = useState(false);
  const [device, setDevice] = useState('');
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const activeTrackId = useRef('');
  const skipInFlight = useRef(false);
  const skipReleaseTimer = useRef<number | undefined>(undefined);
  const currentTrackRef = useRef<Track | null>(null);
  const progressRef = useRef<ProgressState>(emptyProgress());
  const player = useRef<SpotifyPlayer | null>(null);
  const deviceRef = useRef('');
  const spotifySource = useRef<SpotifySource | null>(null);
  if (!spotifySource.current) {
    spotifySource.current = new SpotifySource(() => player.current, () => deviceRef.current, () => progressRef.current);
  }
  const [youtubeError, setYoutubeError] = useState('');
  const [youtubeQuota, setYoutubeQuota] = useState(getYouTubeQuota);
  const youtubeSourceRef = useRef<YouTubeSource | null>(null);
  if (!youtubeSourceRef.current) youtubeSourceRef.current = new YouTubeSource();
  const youtubeSource = youtubeSourceRef.current;
  const commandRef = useRef<(path: 'next' | 'previous') => Promise<void>>(async () => {});
  const youtubeAutoplayFor = useRef('');
  const [volume, setVolume] = useState(68);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'context' | 'track'>('off');
  const [expanded, setExpanded] = useState(false);
  const [startDismissed, setStartDismissed] = useState(() => {
    try { return sessionStorage.getItem('auraplayer_start_dismissed') === '1'; }
    catch { return false; }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>(cachedPlaylists || []);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [autoplayEnabled, setAutoplayEnabled] = useState(autoplayEngine.isEnabled());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [youtubeSearchRequest, setYoutubeSearchRequest] = useState(0);
  const [genres, setGenres] = useState<string[]>([]);
  const [dominant, setDominant] = useState<{ trackId: string; colors: [string, string, string] } | null>(null);
  const [lyrics, setLyrics] = useState<LyricsRecord | null>(null);
  const [notice, setNotice] = useState('');
  const [installPrompt, setInstallPrompt] = useState<(Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  }) | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [visibleScene, setVisibleScene] = useState<Scene>(scenes[3]); // Night Stars default
  const shellRef = useRef<HTMLElement>(null);
  const initialPalette = useMemo(() => buildPalette(undefined, {
    bg: scenes[3].background,
    surface: scenes[3].colors[1],
    accent: scenes[3].colors[2],
    accent2: scenes[3].colors[3]
  }), []);
  const noticeTimer = useRef<number>();
  const disconnectSourceRef = useRef<(target: SourceId) => Promise<void>>(async () => {});
  const sourceTransitionRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const promptInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
      });
    };
    const installed = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setNotice('AURA//PLAYER ADDED TO YOUR HOME SCREEN.');
    };
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setIsInstalled(standalone);
    window.addEventListener('beforeinstallprompt', promptInstall);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', promptInstall);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js').catch(error => {
      if (import.meta.env.DEV) console.warn('AuraPlayer offline shell registration failed:', error);
    });
  }, []);

  sourceRef.current = activeSource;
  deviceRef.current = device;
  activeTrackId.current = track?.id || '';

  // Scene choice resolution with safe fallback
  const lyricsText = lyrics?.plainLyrics || lyrics?.syncedLyrics || '';
  const trackColorKey = track ? `${track.source}:${track.id}` : '';
  const albumColors = dominant && dominant.trackId === trackColorKey ? dominant.colors : undefined;
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
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : undefined;
      if (error instanceof SpotifyAccessLimitedError || statusCode === 403) {
        setSpotifyAccessLimited(true);
        setAuthError(null);
        set({ error: error instanceof Error ? error.message : 'Spotify access is limited to allowlisted accounts.', loading: false });
        if (usePlayer.getState().activeSource === 'spotify') void disconnectSourceRef.current('spotify');
        return;
      }
      const message = error instanceof Error ? error.message : 'AuraPlayer could not complete that request.';
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
      currentTrackRef.current = null;
      set({ currentTrack: null });
      return;
    }
    // Ensure all fields have safe defaults
    const youtubeMetadata = next.source === 'youtube' ? cleanVideoMetadata(next.title || '', next.artist || '') : null;
    const safeTrack: Track = {
      id: next.id || '', source: next.source, title: next.title || 'Unknown Track',
      artist: next.artist || 'Unknown Artist', album: next.album || '',
      durationMs: next.durationMs || 0, artworkUrl: next.artworkUrl || '',
      uri: next.uri || '', artistId: next.artistId, videoId: next.videoId,
      ...(youtubeMetadata ? { title: youtubeMetadata.title, artist: youtubeMetadata.artist } : {})
    };
    if (skipInFlight.current && safeTrack.id !== activeTrackId.current) {
      window.clearTimeout(skipReleaseTimer.current);
      // Keep a short post-transition guard so queued double-clicks cannot skip
      // the next song as soon as Spotify emits its first state update.
      skipReleaseTimer.current = window.setTimeout(() => {
        skipInFlight.current = false;
      }, 420);
    }
    activeTrackId.current = safeTrack.id;
    currentTrackRef.current = safeTrack;
    set({ currentTrack: safeTrack });
    try { localStorage.setItem(`auraplayer_track_${safeTrack.source}`, JSON.stringify(safeTrack)); } catch { /* local storage may be disabled */ }
    if (safeTrack.uri && safeTrack.source === 'spotify') {
      autoplayEngine.markTrackPlayed(safeTrack.uri);
    }
  }, []);

  useEffect(() => {
    const applySourceState = (id: SourceId) => (state: { playing: boolean; positionMs: number; durationMs: number; error?: string }) => {
      if (sourceRef.current !== id) return;
      progressRef.current = {
        position: state.positionMs, duration: state.durationMs,
        updatedAt: performance.now(), playing: state.playing
      };
      if (playingRef.current !== state.playing) {
        playingRef.current = state.playing;
        setPlaying(state.playing);
      }
      if (id === 'youtube') {
        if (state.error) setYoutubeError(state.error);
        else if (state.playing) setYoutubeError('');
      }
    };
    const offSpotify = spotifySource.current?.onStateChange(applySourceState('spotify'));
    const offYouTube = youtubeSource.onStateChange(applySourceState('youtube'));
    youtubeSource.setCallbacks({
      onReady: () => {
        const current = usePlayer.getState();
        if (current.activeSource === 'youtube') {
          set({ connections: { ...current.connections, youtube: 'connected' } });
        }
      },
      onEnded: () => { void commandRef.current('next'); },
      onError: () => { void commandRef.current('next'); },
      onNext: () => { void commandRef.current('next'); },
      onPrevious: () => { void commandRef.current('previous'); }
    });
    return () => { offSpotify?.(); offYouTube(); };
  }, [youtubeSource, set]);

  useEffect(() => {
    if (!activeSource || connections[activeSource] !== 'connected') return;
    try {
      const savedTrack = localStorage.getItem(`auraplayer_track_${source}`);
      if (savedTrack) {
        const parsed = JSON.parse(savedTrack) as Track;
        if (parsed?.source === source && parsed.id) {
          commitTrack(parsed);
          if (source === 'youtube') {
            progressRef.current = { position: 0, duration: parsed.durationMs, updatedAt: performance.now(), playing: false };
            void youtubeSource.cue(parsed).catch(announce);
          }
        }
      }
      const savedQueue = localStorage.getItem(`auraplayer_queue_${source}`);
      if (savedQueue) {
        const parsed = JSON.parse(savedQueue) as QueueTrack[];
        if (Array.isArray(parsed)) setQueue(parsed.filter(item => item?.source === source));
      }
    } catch { /* ignore invalid saved player state */ }
  }, [activeSource, connections, source, commitTrack, youtubeSource, announce]);

  useEffect(() => {
    if (!activeSource) return;
    try { localStorage.setItem(`auraplayer_queue_${activeSource}`, JSON.stringify(queue)); } catch { /* storage may be disabled */ }
  }, [queue, activeSource]);

  const updatePlayback = (state: Playback | null) => {
    if (sourceRef.current !== 'spotify') return;
    if (!state) return;
    if (state.item) {
      progressRef.current = {
        position: state.progress_ms || 0,
        duration: state.item.duration_ms || 0,
        updatedAt: performance.now(),
        playing: state.is_playing
      };
      commitTrack(fromSpotifyTrack(state.item));
    }
    playingRef.current = !!state.is_playing;
    setPlaying(!!state.is_playing);
    playingRef.current = !!state.is_playing;
    spotifySource.current?.emit({ playing: !!state.is_playing, positionMs: progressRef.current.position, durationMs: progressRef.current.duration });
    setShuffle(!!state.shuffle_state);
    setRepeatMode(state.repeat_state || 'off');
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
    if (sourceRef.current !== 'spotify') return [] as SpotifyTrack[];
    try {
      const data = await spotify<{ queue: SpotifyTrack[] }>('/me/player/queue');
      const spotifyQueue = data?.queue || [];
      const seen = new Set<string>();
      const upNext: QueueTrack[] = [];
      for (const item of spotifyQueue) {
        if (!item) continue;
        const key = item.id || item.uri;
        if (!key || key === activeTrackId.current || seen.has(key)) continue;
        seen.add(key);
        upNext.push({
          ...fromSpotifyTrack(item),
          isAutoplay: autoplayEngine.isAutoQueued(item.uri)
        });
      }
      setQueue(previous => {
        const stable = previous.slice();
        const known = new Set(stable.map(item => item.id || item.uri));
        // Refresh suggestion badges as the Spotify queue learns about tracks
        // that the async recommendation pass just inserted; keep their rows
        // in the same position while updating that metadata in place.
        const incoming = new Map(upNext.map(item => [item.id || item.uri, item]));
        for (let index = 0; index < stable.length; index++) {
          const key = stable[index].id || stable[index].uri;
          const latest = incoming.get(key);
          if (!latest) continue;
          stable[index] = {
            ...stable[index],
            isAutoplay: stable[index].isAutoplay || latest.isAutoplay
          };
          incoming.delete(key);
        }
        const addOnce = (item: Track) => {
          if (item.source !== 'spotify') return;
          const key = item.id || item.uri;
          if (!key || known.has(key)) return;
          known.add(key);
          stable.push({ ...item, isAutoplay: autoplayEngine.isAutoQueued(item.uri) });
        };
        if (currentTrackRef.current) addOnce(currentTrackRef.current);
        upNext.forEach(addOnce);
        return stable;
      });
      return spotifyQueue;
    } catch {
      return [] as SpotifyTrack[];
    }
  }, []);

  const syncSdkState = useCallback(
    (state: any) => {
      if (!state || sourceRef.current !== 'spotify') return;
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
      spotifySource.current?.emit({ playing: isPlaying, positionMs: progressRef.current.position, durationMs: progressRef.current.duration });
      if (item?.id && item.id !== activeTrackId.current) {
        commitTrack({
          id: item.id,
          source: 'spotify',
          title: item.name || '',
          artist: item.artists?.map(artist => artist.name).filter(Boolean).join(', ') || '',
          album: item.album?.name || '',
          durationMs: item.duration_ms || 0,
          artworkUrl: item.album?.images?.[0]?.url || '',
          uri: item.uri || '',
          artistId: (item.artists?.[0]?.uri || '').split(':').pop() || ''
        });
        void (async () => {
          const playback = await fetchInitialState();
          if (playback?.item?.id === item.id && playback.item.album?.images?.length) return;
          try {
            const full = await spotify<SpotifyTrack>(`/tracks/${item.id}`);
            if (full) commitTrack(fromSpotifyTrack(full));
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
          if (callbackResult.statusCode === 403) {
            setSpotifyAccessLimited(true);
            const current = usePlayer.getState();
            set({ activeSource: null, connections: { ...current.connections, spotify: 'disconnected' } });
            try { localStorage.removeItem('auraplayer_active_source'); } catch { /* storage may be disabled */ }
            return;
          }
          const current = usePlayer.getState();
          set({ activeSource: null, connections: { ...current.connections, spotify: 'disconnected' } });
          try { localStorage.removeItem('auraplayer_active_source'); } catch { /* storage may be disabled */ }
          setAuthError(callbackResult.error);
          announce(callbackResult.error);
          return;
        }

        const access = await validToken();
        if (!mounted) return;
        if (!access) return;
        let savedSource = '';
        try { savedSource = localStorage.getItem('auraplayer_active_source') || ''; } catch { /* storage may be disabled */ }
        // A valid saved token alone is not consent to auto-connect. Only restore
        // Spotify after a completed callback or an explicit prior Spotify session.
        if (!callbackResult.authenticated && savedSource !== 'spotify') return;
        set({
          token: access,
          activeSource: 'spotify',
          connections: { ...usePlayer.getState().connections, spotify: 'connecting', youtube: 'disconnected' }
        });
        try { localStorage.setItem('auraplayer_active_source', 'spotify'); } catch { /* storage may be disabled */ }
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
          if (playlistErr instanceof SpotifyAccessLimitedError) announce(playlistErr);
          else console.warn('Could not load playlists (non-fatal):', playlistErr);
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

  // Restore YouTube only when it was the user's last explicitly active source.
  useEffect(() => {
    try {
      if (localStorage.getItem('auraplayer_active_source') !== 'youtube') return;
      set({ activeSource: 'youtube', connections: { ...usePlayer.getState().connections, youtube: 'connecting' } });
    } catch { /* storage may be disabled */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safe genres lookup
  useEffect(() => {
    const artistId = track?.source === 'spotify' ? track.artistId : undefined;
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
  }, [track?.id, track?.source, track?.artistId]);

  // Safe dominant color sampling
  useEffect(() => {
    setDominant(null);
    if (!track) return;
    const key = `${track.source}:${track.id}`;
    if (!track.id && import.meta.env.DEV) console.warn('[AuraPlayer] Missing normalized source:id key; using a safe palette fallback.', track);
    const url = track?.artworkUrl;
    let stale = false;
    void extractAlbumColors(key, url || '').then(colors => {
      if (!stale && colors.length) setDominant({
        trackId: key,
        colors: [colors[0] || '', colors[1] || '', colors[2] || '']
      });
    });
    return () => {
      stale = true;
    };
  }, [track?.id, track?.source, track?.artworkUrl]);

  // LRCLib Lyrics Fetching
  useEffect(() => {
    setLyrics(null);
    if (!track?.title) return;
    const controller = new AbortController();
    void fetchLyrics(track, controller.signal).then(result => {
      if (!controller.signal.aborted) setLyrics(result);
    }).catch(() => {});
    return () => controller.abort();
  }, [track?.id, track?.source, track?.title, track?.artist, track?.durationMs]);

  // Autoplay Trigger on Track Change
  useEffect(() => {
    if (!track?.id || !device || source !== 'spotify') return;
    void (async () => {
      const currentQ = await loadQueue();
      const added = await autoplayEngine.ensureAutoplay(toSpotifyTrack(track), device, currentQ);
      if (added.length > 0) {
        await loadQueue();
      }
    })();
  }, [track?.id, device, loadQueue, source]);

  useEffect(() => {
    if (source !== 'youtube' || !track || track.source !== 'youtube' || !autoplayEnabled) return;
    const currentIndex = queue.findIndex(item => item.source === 'youtube' && item.id === track.id);
    const remaining = currentIndex < 0 ? queue.length : queue.length - currentIndex - 1;
    if (remaining >= 5 || youtubeAutoplayFor.current === track.id) return;
    youtubeAutoplayFor.current = track.id;
    void fillYouTubeQueue(track).then(suggestions => {
      if (sourceRef.current !== 'youtube' || currentTrackRef.current?.id !== track.id) return;
      setQueue(previous => {
        const seen = new Set(previous.filter(item => item.source === 'youtube').map(item => item.id));
        const additions = suggestions.filter(item => !seen.has(item.id)).map(item => ({ ...item, isAutoplay: true }));
        return [...previous, ...additions];
      });
    });
  }, [track?.id, source, autoplayEnabled, queue.length]);

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
        const current = usePlayer.getState();
        if (current.activeSource === 'spotify') {
          set({ connections: { ...current.connections, spotify: 'connected' } });
        }
        try {
          if (sourceRef.current === 'spotify') {
            await spotify('/me/player', {
              method: 'PUT',
              body: JSON.stringify({ device_ids: [device_id] })
            });
            await instance?.activateElement().catch(() => {});
            await fetchInitialState();
            await loadQueue();
          }
        } catch (error) {
          announce(error);
        }
      });

      instance.addListener('not_ready', () => {
        setDevice('');
        const current = usePlayer.getState();
        if (current.activeSource === 'spotify') {
          set({ activeSource: null, connections: { ...current.connections, spotify: 'disconnected' } });
          try { localStorage.removeItem('auraplayer_active_source'); } catch { /* storage may be disabled */ }
        }
      });
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
    const term = source === 'youtube' ? submittedQuery.trim() : query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    timeout = window.setTimeout(async () => {
      try {
        const items = source === 'youtube'
          ? await searchYouTube(term)
          : await spotifyProvider.searchTracks?.(term) || [];
        setResults(items.filter(Boolean));
        if (source === 'youtube') {
          setYoutubeError('');
          setYoutubeQuota(getYouTubeQuota());
        }
      } catch (error) {
        if (source === 'youtube') {
          const message = error instanceof Error ? error.message : 'YouTube search failed.';
          setYoutubeError(message);
          setNotice(message);
          setYoutubeQuota(getYouTubeQuota());
        } else announce(error);
      }
    }, source === 'youtube' ? 0 : 240);
    return () => window.clearTimeout(timeout);
  }, [query, submittedQuery, source, youtubeSearchRequest, announce]);

  const toggle = async () => {
    try {
      if (sourceRef.current === 'youtube') {
        if (!track || track.source !== 'youtube') throw new Error('Search YouTube and select a video first.');
        if (playingRef.current) await youtubeSource.pause();
        else await youtubeSource.resume();
        return;
      }
      if (!token) throw new Error('Connect Spotify to start the player.');
      if (playingRef.current) await spotifySource.current?.pause();
      else await spotifySource.current?.resume();
    } catch (error) {
      announce(error);
    }
  };

  const command = async (path: 'next' | 'previous') => {
    if (path === 'next' && skipInFlight.current) return;
    if (path === 'next') {
      skipInFlight.current = true;
      window.clearTimeout(skipReleaseTimer.current);
      skipReleaseTimer.current = window.setTimeout(() => {
        skipInFlight.current = false;
      }, 1500);
    }
    try {
      if (sourceRef.current === 'youtube') {
        const index = queue.findIndex(item => item.source === 'youtube' && item.id === currentTrackRef.current?.id);
        const target = queue[index + (path === 'next' ? 1 : -1)];
        if (path === 'previous' && (index <= 0 || !target)) {
          await youtubeSource.seek(0);
          return;
        }
        if (!target || target.source !== 'youtube') throw new Error('No more videos in this queue. Search for more music or enable RELATED PICKS.');
        await youtubeSource.play(target);
        commitTrack(target);
        progressRef.current = { position: 0, duration: target.durationMs, updatedAt: performance.now(), playing: true };
        playingRef.current = true;
        setPlaying(true);
        return;
      }
      if (!device) throw new Error('Start AuraPlayer to make it an active Spotify device.');
      await spotifySource.current?.[path]();
    } catch (error) {
      if (path === 'next') {
        skipInFlight.current = false;
        window.clearTimeout(skipReleaseTimer.current);
      }
      announce(error);
    }
  };

  const seek = async (fraction: number) => {
    const p = progressRef.current;
    const duration = p.duration || 0;
    const position = Math.max(0, Math.min(duration, fraction * duration));
    progressRef.current = { ...p, position, updatedAt: performance.now() };
    try {
      if (sourceRef.current === 'youtube') await youtubeSource.seek(position);
      else await spotifySource.current?.seek(position);
    } catch (error) {
      announce(error);
    }
  };

  const setVolumeValue = async (value: number) => {
    setVolume(value);
    try {
      if (sourceRef.current === 'youtube') await youtubeSource.setVolume(value / 100);
      else await spotifySource.current?.setVolume(value / 100);
    } catch (error) {
      announce(error);
    }
  };

  const playTrack = async (selected: Track) => {
    try {
      if (selected.source === 'youtube') {
        await youtubeSource.play(selected);
        commitTrack(selected);
        progressRef.current = { position: 0, duration: selected.durationMs, updatedAt: performance.now(), playing: true };
        playingRef.current = true;
        setPlaying(true);
        setQueue(previous => {
          const remaining = [...results, ...previous].filter(item => item.source === 'youtube' && item.id !== selected.id);
          const unique = new Map(remaining.map(item => [item.id, item]));
          return [{ ...selected, isAutoplay: false }, ...unique.values()];
        });
        setSearchOpen(false);
        setPlaylistOpen(false);
        return;
      }
      if (!device) throw new Error('Connect AuraPlayer first, then select a Spotify track.');
      autoplayEngine.setContextPlay(false);
      await player.current?.activateElement();
      await spotifyProvider.play?.(selected, device);
      commitTrack(selected);
      progressRef.current = {
        position: 0,
        duration: selected.durationMs || 0,
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
    if (sourceRef.current !== 'spotify') {
      setNotice('Shuffle is not available for YouTube embedded videos.');
      return;
    }
    const next = !shuffle;
    setShuffle(next);
    try {
      await spotifyProvider.setShuffle?.(next, device || undefined);
      setQueue([]);
      await loadQueue();
    } catch (error) {
      announce(error);
    }
  };

  const repeatToggle = async () => {
    if (sourceRef.current !== 'spotify') {
      setNotice('Repeat is not available for YouTube embedded videos.');
      return;
    }
    const next = repeatMode === 'off' ? 'context' : repeatMode === 'context' ? 'track' : 'off';
    try {
      await spotifyProvider.setRepeat?.(next, device || undefined);
      setRepeatMode(next);
    } catch (error) {
      announce(error);
    }
  };

  const installApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstallPrompt(null);
      return;
    }
    const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setNotice(isAppleMobile
      ? 'TO INSTALL: TAP SHARE, THEN “ADD TO HOME SCREEN”.'
      : 'TO INSTALL: OPEN YOUR BROWSER MENU AND CHOOSE “INSTALL APP” OR “ADD TO HOME SCREEN”.');
  };

  const toggleAutoplay = () => {
    const next = !autoplayEngine.isEnabled();
    autoplayEngine.setEnabled(next);
    setAutoplayEnabled(next);
    setNotice(`${sourceRef.current === 'spotify' ? 'Spotify' : 'YouTube'} RELATED PICKS ${next ? 'ENABLED' : 'PAUSED'}.`);
  };

  const clearQueue = () => {
    autoplayEngine.clearQueueTracking();
    setQueue([]);
    setNotice('Upcoming queue cleared.');
  };

  const closeLibrary = () => {
    setSearchOpen(false);
    setPlaylistOpen(false);
  };

  const openSearch = () => {
    setExpanded(false);
    setPlaylistOpen(false);
    setSearchOpen(true);
  };

  const openPlaylists = async () => {
    if (sourceRef.current !== 'spotify') {
      setNotice('Playlists are not available for YouTube’s public video source.');
      return;
    }
    setExpanded(false);
    setSearchOpen(false);
    try {
      const items = await spotifyProvider.getPlaylists?.() as Playlist[] | undefined;
      setPlaylists((items || []).filter(Boolean));
      setPlaylistOpen(true);
    } catch (error) {
      announce(error);
    }
  };

  const performDisconnectSource = async (target: SourceId) => {
    const current = usePlayer.getState();
    const clearTargetState = current.activeSource === target || track?.source === target || current.connections[target] !== 'disconnected';
    if (target === 'spotify') {
      if (current.activeSource === 'spotify' && (token || player.current)) {
        try { await spotifySource.current?.pause(); } catch { /* still disconnect the local device */ }
      }
      player.current?.disconnect();
      player.current = null;
      setDevice('');
      // Keep a still-valid persisted token so an explicit reconnect can skip OAuth.
      await validToken().catch(() => null);
    } else {
      if (current.activeSource === 'youtube' && youtubeSource.hasMedia()) {
        try { await youtubeSource.pause(); } catch { /* still stop and destroy the iframe */ }
      }
      await youtubeSource.stopAndDestroy();
    }

    if (clearTargetState) {
      playingRef.current = false;
      setPlaying(false);
      progressRef.current = emptyProgress();
      commitTrack(null);
      setLyrics(null);
      setGenres([]);
      setDominant(null);
      setQueue([]);
      autoplayEngine.clearQueueTracking();
    }
    if (clearTargetState) {
      try {
        localStorage.removeItem(`auraplayer_track_${target}`);
        localStorage.removeItem(`auraplayer_queue_${target}`);
      } catch { /* storage may be disabled */ }
    }
    const latest = usePlayer.getState();
    set({
      token: target === 'spotify' ? null : latest.token,
      playback: target === 'spotify' ? null : latest.playback,
      activeSource: latest.activeSource === target ? null : latest.activeSource,
      connections: { ...latest.connections, [target]: 'disconnected' }
    });
    try {
      if (usePlayer.getState().activeSource === null) localStorage.removeItem('auraplayer_active_source');
    } catch { /* storage may be disabled */ }
    setYoutubeError('');
  };

  const enqueueSourceTransition = (operation: () => Promise<void>) => {
    const next = sourceTransitionRef.current.then(operation, operation);
    sourceTransitionRef.current = next.then(() => undefined, () => undefined);
    return next;
  };
  const disconnectSource = (target: SourceId) => enqueueSourceTransition(() => performDisconnectSource(target));
  disconnectSourceRef.current = disconnectSource;

  const connectSource = (requested: SourceId) => enqueueSourceTransition(async () => {
    const current = usePlayer.getState();
    if (current.activeSource === requested && current.connections[requested] !== 'disconnected') {
      await performDisconnectSource(requested);
      return;
    }
    await performDisconnectSource(requested === 'spotify' ? 'youtube' : 'spotify');
    const latest = usePlayer.getState();
    sourceRef.current = requested;
    setQuery('');
    setSubmittedQuery('');
    setResults([]);
    setPlaylistOpen(false);
    setYoutubeError('');
    setQueue([]);
    playingRef.current = false;
    setPlaying(false);
    progressRef.current = emptyProgress();
    set({
      activeSource: requested,
      connections: { ...latest.connections, [requested]: 'connecting' }
    });
    try { localStorage.setItem('auraplayer_active_source', requested); } catch { /* storage may be disabled */ }

    if (requested === 'youtube') {
      return;
    }
    try {
      const access = await validToken();
      if (access) {
        set({ token: access });
        return;
      }
      await spotifyProvider.connect();
    } catch (error) {
      const failed = usePlayer.getState();
      set({ activeSource: null, connections: { ...failed.connections, spotify: 'disconnected' } });
      try { localStorage.removeItem('auraplayer_active_source'); } catch { /* storage may be disabled */ }
      announce(error);
    }
  });

  const connect = () => connectSource('spotify');

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
              onClick={() => void (async () => {
                spotifyProvider.disconnect();
                setAuthError(null);
                await disconnectSource('spotify');
                await connect();
              })()}
            >
              <RotateCcw size={16} />
              <span>TRY AGAIN</span>
            </button>
            <button className="error-reload-btn" onClick={() => void connect()}>
              <RotateCcw size={16} />
              <span>RECONNECT SPOTIFY ↗</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (spotifyAccessLimited) {
    return (
      <main className="app-shell error-boundary-screen" role="alert">
        <section className="error-boundary-card spotify-access-card">
          <div className="error-card-badge"><AlertTriangle size={16} /><span>HTTP 403 / DEVELOPER MODE</span></div>
          <h1 className="error-card-title">SPOTIFY ACCESS LIMITED</h1>
          <p className="error-card-lead">this app is in Spotify's developer mode and only allowlisted accounts can log in. Use YouTube mode instead, or ask the owner to add your Spotify email.</p>
          <div className="error-actions-row">
            <button className="error-reload-btn" onClick={() => {
              setSpotifyAccessLimited(false);
              setAuthError(null);
              void connectSource('youtube');
            }}>SWITCH TO YOUTUBE</button>
            <button className="error-reset-btn" onClick={() => void (async () => {
              spotifyProvider.disconnect();
              setSpotifyAccessLimited(false);
              setAuthError(null);
              await disconnectSource('spotify');
              await connect();
            })()}>TRY AGAIN</button>
          </div>
        </section>
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
          <div className="source-switcher" role="tablist" aria-label="Music source">
            <button role="tab" aria-selected={activeSource === 'spotify'} className={activeSource === 'spotify' ? 'is-active' : ''} onClick={() => void connectSource('spotify')}>
              {activeSource === 'spotify' ? 'SPOTIFY / DISCONNECT' : connections.spotify === 'connecting' ? 'SPOTIFY / CONNECTING' : 'CONNECT SPOTIFY'}
            </button>
            <button role="tab" aria-selected={activeSource === 'youtube'} className={activeSource === 'youtube' ? 'is-active' : ''} onClick={() => void connectSource('youtube')}>
              {activeSource === 'youtube' ? 'YOUTUBE / DISCONNECT' : connections.youtube === 'connecting' ? 'YOUTUBE / CONNECTING' : 'CONNECT YOUTUBE'}
            </button>
          </div>
          <button className="quick-library-btn" onClick={openSearch} aria-label={`Search ${source === 'youtube' ? 'YouTube' : 'Spotify'}`} title={`Search ${source === 'youtube' ? 'YouTube videos' : 'Spotify tracks'}`}>
            <Search size={14} /><span>SEARCH</span>
          </button>
          <button className="quick-library-btn" onClick={() => void openPlaylists()} disabled={source === 'youtube'} aria-label="Open Spotify playlists" title={source === 'youtube' ? 'Playlists are only available from Spotify' : 'Your Spotify playlists'}>
            <LibraryBig size={14} /><span>PLAYLISTS</span>
          </button>
          <button className="quick-library-btn services-trigger" onClick={() => setServicesOpen(true)} aria-label="Connected music services" title="Connected music services">
            <Music2 size={14} /><span>SERVICES</span>
          </button>
          {!isInstalled && (
            <button className="install-app-btn" onClick={() => void installApp()} aria-label="Install AuraPlayer app">
              <Download size={14} /> INSTALL APP
            </button>
          )}
          <button
            className={`mast-queue-btn ${queueOpen ? 'is-active' : ''}`}
            onClick={() => setQueueOpen(!queueOpen)}
            title="Toggle Up Next Queue Panel"
          >
            <ListMusic size={14} /> PLAY ORDER ({queue.length})
          </button>
          <span className="device-state">
            <i className={connections[source] === 'connected' ? 'online' : ''} />
            {activeSource ? `${source.toUpperCase()} ${connections[source].toUpperCase()}` : 'NO SOURCE CONNECTED'}
          </span>
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

        <div className={`hero-editorial-grid ${activeSource === 'youtube' && connections.youtube !== 'disconnected' ? 'has-youtube-source' : ''}`}>
          <div className="hero-art-column">
            <HeroArtwork track={track} />
            <div className="hero-facts">
              <span>ATMOSPHERE</span><strong>{visibleScene.label.toUpperCase()}</strong>
              <span>ALBUM</span><strong>{track?.album || 'AURA ARCHIVE'}</strong>
              <span>RUNTIME</span><strong>{track?.durationMs ? fmt(track.durationMs) : '0:00'}</strong>
            </div>
          </div>
          <YouTubeSourceCard
            source={youtubeSource}
            active={activeSource === 'youtube' && connections.youtube !== 'disconnected'}
            error={youtubeError}
          />
          <div className="hero-copy-column">
            <TrackStamp track={track} />
            <div className="hero-song-meta">
              <span>SOURCE / {source.toUpperCase()}</span>
              <p>{track?.artist || (source === 'spotify' ? 'CONNECT SPOTIFY TO BEGIN' : 'SEARCH YOUTUBE TO BEGIN')}</p>
              <small>{track?.album || 'YOUR NEXT FAVORITE TRACK'}</small>
            </div>
            <HeroLyrics
              trackId={track?.id}
              lyrics={lyrics}
              progressRef={progressRef}
              onSeek={fraction => void seek(fraction)}
            />
          </div>
        </div>
        <a className="portfolio-credit" href="https://Huzzz.tech" target="_blank" rel="noreferrer">
          DESIGNED &amp; DEVELOPED BY HUZAIFA <ArrowUpRight size={13} />
        </a>
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
        source={source}
        scene={visibleScene}
        playing={playing}
        progressRef={progressRef}
        volume={volume}
        shuffle={shuffle}
        repeatMode={repeatMode}
        expanded={expanded}
        onToggle={() => void toggle()}
        onNext={() => void command('next')}
        onPrev={() => void command('previous')}
        onSeek={fraction => void seek(fraction)}
        onVolume={value => void setVolumeValue(value)}
        onShuffle={() => void shuffleToggle()}
        onRepeat={() => void repeatToggle()}
        onSearch={() => {
          openSearch();
        }}
        onQueue={() => {
          setExpanded(false);
          setQueueOpen(true);
        }}
        onExpand={() => setExpanded(true)}
        onClose={() => setExpanded(false)}
      />
      <ConnectedServices
        open={servicesOpen}
        spotifyConnected={connections.spotify === 'connected'}
        youtubeConnected={connections.youtube === 'connected'}
        youtubeApiConfigured={Boolean(import.meta.env.VITE_YOUTUBE_API_KEY)}
        onClose={() => setServicesOpen(false)}
        onSpotifyConnect={() => { setServicesOpen(false); void connectSource('spotify'); }}
        onSpotifyDisconnect={() => { void disconnectSource('spotify'); setServicesOpen(false); }}
        onYouTubeConnect={() => { setServicesOpen(false); void connectSource('youtube'); }}
        onYouTubeDisconnect={() => { void disconnectSource('youtube'); setServicesOpen(false); }}
      />
      <ContrastDebugOverlay sceneInfo={{
        trackKey: track ? `${track.source}:${track.id}` : '',
        scene: targetScene.label,
        step: targetScene.resolutionStep || 'idle',
        palette: targetScene.palette
          ? [targetScene.palette.bg, targetScene.palette.surface, targetScene.palette.accent, targetScene.palette.accent2, targetScene.palette.ink, targetScene.palette.paper]
          : [targetScene.background, ...targetScene.colors]
      }} />

      {/* Dedicated UP NEXT Queue Dock */}
      <UpNextQueue
        open={queueOpen}
        source={source}
        autoplayAvailable={source === 'spotify' || Boolean(import.meta.env.VITE_LASTFM_API_KEY)}
        onClose={() => setQueueOpen(false)}
        queue={queue}
        currentTrackId={track?.id}
        autoplayEnabled={autoplayEnabled}
        onToggleAutoplay={toggleAutoplay}
        onClearQueue={clearQueue}
        onPlayTrack={item => void playTrack(item)}
      />

      {source === 'spotify' && !token && (
        <div className="connect-note">
          <span>FIRST, THE GOOD STUFF.</span>
          <button onClick={connect}>
            CONNECT SPOTIFY <ArrowUpRight size={15} />
          </button>
        </div>
      )}

      {source === 'spotify' && token && device && !playing && !startDismissed && (
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
          <form className="search-box" onSubmit={event => {
            event.preventDefault();
            if (source === 'youtube') {
              setSubmittedQuery(query.trim());
              setYoutubeSearchRequest(value => value + 1);
            }
          }}>
            <Search size={18} aria-hidden="true" />
            <input
              autoFocus
              placeholder={source === 'youtube' ? 'Search YouTube videos' : 'Search track, artist, album'}
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            <button type="submit" aria-label={`Search ${source}`}>SEARCH</button>
          </form>
        ) : null}
        {searchOpen && source === 'youtube' && (
          <span className={`youtube-quota-sticker ${youtubeQuota.low ? 'is-low' : ''}`}>
            {youtubeQuota.low ? 'QUOTA LOW · ' : 'YOUTUBE SEARCHES · '}{youtubeQuota.searches}/{youtubeQuota.limit} TODAY
          </span>
        )}

        <div className="library-list">
          {searchOpen
            ? results.map(item => (
                <button
                  className="library-row"
                  key={item?.id || Math.random()}
                  onClick={() => item && void playTrack(item)}
                >
                  {item?.artworkUrl ? (
                    <img src={item.artworkUrl} alt="" />
                  ) : (
                    <span className="library-art">
                      <Headphones />
                    </span>
                  )}
                  <span>
                    <strong>{item?.title || 'Unknown Track'}</strong>
                    <small>{item?.artist || 'Unknown Artist'} / {item?.album || ''} · {item?.source.toUpperCase()}</small>
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
            <p className="empty-library">{source === 'youtube' ? 'TYPE A SEARCH AND PRESS ENTER. RESULTS ARE CACHED TO PROTECT API QUOTA.' : 'TYPE TWO LETTERS TO SEARCH SPOTIFY.'}</p>
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
            disabled={source !== 'spotify'}
            onClick={async () => {
              try {
                const items = await spotifyProvider.getPlaylists?.() as Playlist[] | undefined;
                setPlaylists((items || []).filter(Boolean));
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
