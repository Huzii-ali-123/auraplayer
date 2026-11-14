# AURA//PLAYER — Codebase Audit & Project State

**Updated:** 2026-11-14
**Author:** Antigravity
**Status:** Hero Lyrics Migration, Readable UP NEXT Dock, Music-Reactive Procedural Visualizer, and Explicit Live Sync Complete.

> **Local development URL:** Always open `http://127.0.0.1:5173/`, never `localhost`. Vite binds this exact IPv4 host and port; the entry page redirects `localhost:5173` to the canonical origin before auth starts.

---

## 1. Executive Overview: Completed vs. Remaining Work

### Core Vision
**AURA//PLAYER** is a neo-brutalist web Spotify player where the entire viewport's atmosphere dynamically matches the playing track. It features:
- A prominent hero layout where synced kinetic lyrics flow directly underneath the chunky track title and artist name.
- A dedicated right-docked "UP NEXT" queue panel with a spotlight "NEXT" card, minimum 66px track rows, and clear `AUTOPLAY` badges.
- A vector circular wheel player fixed at the bottom-left surrounded by a procedural sound visualizer with 5 deterministic styles modulated by lyrics WPS, chorus detection, track intro/outro envelopes, and scene accent colors.

### Status Matrix

| Subsystem | Status | Details |
| :--- | :--- | :--- |
| **Hero Synced Lyrics** | **Completed** | Lyrics moved out of the wheel player into the main page hero directly under the song title. Features 4-line kinetic view (1 previous, 1 large active line in scene accent color, 2 upcoming lines), GSAP slide-up transition without layout thrashing, tap-to-seek, SHOW/HIDE toggle with `localStorage` persistence and `L` keyboard shortcut, and "NO LYRICS FOUND" sticker badge fallback. Never overlaps album cover art, wheel, or queue. |
| **Readable UP NEXT Queue** | **Completed** | Dedicated right-docked panel (desktop) / bottom sheet (mobile). Features a prominent spotlight "NEXT" card on top, followed by a scrollable list of rows (min 66px high) with album thumbnails, titles, artists, durations, position numbers, clear `AUTOPLAY` badges, click-to-play, and a `CLEAR` queue button. |
| **Music-Reactive Visualizer** | **Completed** | 5 deterministic visualizer styles chosen from track ID hash (`radial bars`, `spike ring`, `pulsing concentric rings`, `dotted orbit`, `zigzag wave`). Energy modulated by lyric line start pulses, words-per-second intensity, chorus repetition detection boost ($1.45\times$), instrumental gap calming ($0.45\times$), and position intro/outro envelopes. Seamless fallback to multi-layer noise if lyrics are absent. |
| **Live Sync Explanations** | **Completed** | Pre-prompt modal instruction card outlining the 3 Chrome dialog steps. Distinct classification and user alerts for no-audio-track (checkbox unchecked), DRM silence, user cancellation, or unsupported browser, cleanly falling back to procedural WAVE. |
| **Persistent 60fps Particles** | **Completed** | Single-pass canvas loop, particle pool in a ref, GSAP `timeScale` tweening (0 on pause, 1 on play), zero resets or respawns on pause/resume, 12 scene themes with 4 motion variants each. |
| **Auth & Crash Resilience** | **Completed** | PKCE StrictMode duplicate-exchange guard, immediate URL code stripping, 401 refresh loop prevention, 403 user-whitelisting alert, 429 Retry-After backoff, top-level brutalist Error Boundary, and safe-access guards across all track/album/artist/playlist metadata. |

---

## 2. Folder Structure & Key Files

```
music-player/
├── .env                         # Local environment variables (Spotify & Last.fm)
├── .env.example                 # Template with VITE_LASTFM_API_KEY
├── index.html                   # HTML entry with Space Grotesk & Space Mono fonts
├── package.json                 # Dependencies
├── vite.config.ts               # Bundler config
├── PROJECT_STATE.md             # This document
└── src/
    ├── main.tsx                 # App mount, ErrorBoundary wrapper & GSAP 60fps cap
    ├── App.tsx                  # Main layout orchestrator & hero integration
    ├── styles.css               # Neo-brutalist stylesheets & mobile bottom sheets
    ├── vite-env.d.ts            # Type definitions
    ├── auth/
    │   └── pkce.ts              # Single-exchange PKCE auth, token refresher & error recovery
    ├── autoplay/
    │   └── autoplay.ts          # Last.fm recommendation engine & Spotify queue injector
    ├── lyrics/
    │   ├── client.ts            # LRCLIB client, LRC parser, chorus detection & energy sampler
    │   └── HeroLyrics.tsx       # Main page hero kinetic lyrics component (shortcut: L)
    ├── performance/
    │   └── frameStats.ts        # Diagnostic frame work tracking
    ├── scenes/
    │   ├── scenes.ts            # 12 scene definitions, 4 motion variants, resolution waterfall
    │   └── songMap.ts           # Curated track ID overrides
    ├── spotify/
    │   └── api.ts               # Typed fetch client with 401 auto-refresh, 403 guidance & 429 backoff
    ├── store/
    │   └── player.ts            # Zustand store
    └── components/
        ├── ErrorBoundary.tsx    # Neo-brutalist top-level crash screen with reset & retry
        ├── SceneCanvas.tsx      # Persistent 60fps canvas renderer (freeze/resume without reset)
        ├── UpNextQueue.tsx      # Dedicated right-docked UP NEXT queue panel
        ├── WheelPlayer.tsx      # SVG wheel, 5-style visualizer, Live Sync pre-prompt
        └── WipeTransition.tsx   # GSAP horizontal scene wipe transition
```

---

## 3. How Chorus Detection & Lyric-Driven Energy Work

1. **Chorus & Hook Detection:**
   During LRC parsing (`parseLrc` in `client.ts`), each line text is normalized (`toLowerCase().replace(/[^\w\s]/g, '').trim()`). A frequency map calculates how many times each phrase repeats across the track. Lines repeating $\ge 2$ times (with length $> 5$ chars) are identified as **CHORUS / HOOK** lines (`isChorus = true`).
2. **Words-Per-Second (WPS) Delivery:**
   Line duration is derived from the delta to the next timestamp (`lines[i+1].at - lines[i].at`). The word count divided by duration yields delivery speed (`wordsPerSec`), producing an `intensity` scalar between `0.7` and `2.2`. Chorus lines receive an additional $1.45\times$ energy boost.
3. **Real-Time Energy Sampling:**
   During visualizer animation ticks, `sampleLyricEnergy(syncedEntries, currentPositionMs)` computes:
   - `isLineStart`: True if position is within 260ms of line onset &rarr; triggers a rhythmic radial burst.
   - `isInstrumentalGap`: True if position has exceeded line duration and $> 3.8s$ remain before the next line &rarr; scales amplitude down to $0.45\times$ for calm musical interludes.
   - `envelope`: A gentle intro ramp-up during the first 5% of track runtime, and an outro fade during the last 6%.
4. **Deterministic Visualizer Styling:**
   `hashTrackId(track.id) % 5` maps the track to one of 5 distinct styles:
   - `RADIAL BARS` (64 radial bars)
   - `SPIKE RING` (44 sharp triangular spikes)
   - `CONCENTRIC RINGS` (3 pulsed stepped rings)
   - `DOTTED ORBIT` (36 orbiting square studs)
   - `ZIGZAG WAVE` (continuous polygonal jagged zigzag circuit)

---

## 4. Spotify Auth & Crash Resilience Architecture

1. **Strict-Mode Safe PKCE Code Exchange (`src/auth/pkce.ts`):**
   - Implements a single-flight promise singleton (`exchangePromise`) so that all concurrent caller instances (such as React 18 `StrictMode` unmount/remount cycles) await the exact same in-flight token exchange promise rather than failing prematurely with empty tokens.
   - Saves the PKCE verifier, an independent CSRF `state`, and the exact redirect URI in same-origin session/local storage before redirecting to Spotify.
   - Exchanges the returned code once through a module-level single-flight promise, verifies the OAuth state, and uses the same configured redirect URI in authorization and token requests.
   - Removes `?code` from the URL immediately. Auth failures show a brutalist error screen with a **TRY AGAIN** action. Never start auth on `localhost`; use `http://127.0.0.1:5173/`.
2. **Decoupled Post-Auth Hydration (`src/App.tsx`):**
   - Hydrates `/me/playlists` inside a separate non-fatal `try/catch` with component `mounted` guards, ensuring playlist fetch errors or empty collections never trigger fatal "CONNECTION ERROR" screens.
   - Wraps Web Playback SDK `getOAuthToken: async (cb)` with `try/catch` and safe fallback token refreshing.
2. **Robust API Interceptor (`src/spotify/api.ts`):**
   - **401 Unauthorized:** Transparently calls `refreshToken()` using single-flight promise deduplication. If refreshed, retries the failed request once. If refresh fails, invokes `logout()` to reset session state cleanly.
   - **403 Forbidden:** Detects unapproved development accounts and explicitly informs the user that their Spotify email must be registered under **Spotify Developer Dashboard &rarr; User Management**.
   - **429 Rate Limit:** Reads `Retry-After` header and sleeps before executing a retry.
   - **Network/Fetch Errors:** Catches low-level connection failures and routes messages to the status banner without breaking React renders.
3. **Defensive Data Access:**
   - Universal null-safe property chaining across all track, album, image, artist, and playlist fields (`track?.album?.images?.[0]?.url`, `Array.isArray(track?.artists)`, `list?.tracks?.total ?? 0`).
   - Missing album arts gracefully fall back to SVG disc placeholders.
4. **Brutalist Error Boundary (`src/components/ErrorBoundary.tsx`):**
   - Top-level React error catcher preventing any unhandled exceptions from turning the viewport into a blank yellow canvas.
   - Renders a neo-brutalist crash screen featuring the exact error message, stack trace toggle, and a hard "RESET APPLICATION" button that wipes storage and restarts clean.
