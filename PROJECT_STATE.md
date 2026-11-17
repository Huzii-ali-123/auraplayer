# AURA//PLAYER — Codebase Audit & Project State

**Updated:** 2026-11-17
**Author:** Antigravity
**Status:** Spotify and YouTube video playback, per-track palettes/scenes, synchronized lyrics, source-exclusive queues, responsive player, and installable PWA.

> **Local development URL:** Always open `http://127.0.0.1:5173/`, never `localhost`. Vite binds this exact IPv4 host and port; the entry page redirects `localhost:5173` to the canonical origin before auth starts.

---

## 1. Executive Overview: Completed vs. Remaining Work

### Core Vision
**AURA//PLAYER** is a neo-brutalist web Spotify player where the entire viewport's atmosphere dynamically matches the playing track. It features:
- A prominent hero layout where synced kinetic lyrics flow directly underneath the chunky track title and artist name.
- A dedicated right-docked "UP NEXT" queue panel with a spotlight "NEXT" card, minimum 66px track rows, and clear `AUTOPLAY` badges.
- A vector circular wheel player fixed at the bottom-left, with the visualizer removed from its playback panel. Ambient scene particles remain behind the interface.
- A compact editorial artwork/lyrics layout, responsive home-screen PWA install flow, and a visible accent sweep while track colors transition.

### Status Matrix

| Subsystem | Status | Details |
| :--- | :--- | :--- |
| **Hero Synced Lyrics** | **Completed** | LRCLIB lines scroll as one GSAP-translated column under the title, with a moving highlight bar, direct tap-to-seek, progress fill, pause-aware ticking, SHOW/HIDE persistence and `L` shortcut. Plain lyrics stay static. Never overlaps album art, wheel, or queue. |
| **Stable Related-Track Queue** | **Completed** | Current/history rows stay in place; Last.fm similarity results or Spotify artist search fill the Spotify queue in the background for single-track playback. Next dispatches immediately, with duplicate skips guarded during the transition. |
| **Wheel Player Visualizer** | **Removed** | The player canvas, visual-style switcher, and audio-source explanation were removed from the wheel panel. Spotify does not expose decoded frequency data through its Web Playback SDK. Ambient scene particles remain a page background. |
| **Installable PWA** | **Completed** | Web app manifest, 180/192/512 app icons, production service worker for the app shell/static assets, and browser install guidance for Android/iOS. Playback remains online-only. |
| **Persistent 60fps Particles** | **Completed** | Single-pass canvas loop, particle pool in a ref, GSAP `timeScale` tweening (0 on pause, 1 on play), zero resets or respawns on pause/resume, 12 scene themes with 4 motion variants each. |
| **Auth & Crash Resilience** | **Completed** | PKCE StrictMode duplicate-exchange guard, immediate URL code stripping, 401 refresh loop prevention, 403 user-whitelisting alert, 429 Retry-After backoff, top-level brutalist Error Boundary, and safe-access guards across all track/album/artist/playlist metadata. |
| **Song Color & Contrast System** | **Completed** | A cached 48×48 album-art sampler feeds a normalized flat palette. Scene motion stays independent. Palette text roles use WCAG contrast calculations and tween under the zipper-style scene reveal. Development contrast report: press `D`. |

---

## 2. Folder Structure & Key Files

```
music-player/
├── .env                         # Local environment variables (Spotify, Last.fm, optional YouTube Data API)
├── .env.example                 # Environment template
├── index.html                   # HTML entry with Space Grotesk & Space Mono fonts
├── package.json                 # Dependencies
├── vite.config.ts               # Bundler config
├── PROJECT_STATE.md             # This document
├── src/
    ├── main.tsx                 # App mount, ErrorBoundary wrapper & GSAP 60fps cap
    ├── App.tsx                  # Main layout orchestrator & hero integration
    ├── styles.css               # Neo-brutalist stylesheets & mobile bottom sheets
    ├── color/
    │   ├── contrast.ts          # sRGB luminance, WCAG ratios & readable foreground selection
    │   ├── extract.ts           # Cached 48×48 album-art color quantizer
    │   └── palette.ts           # Song palette builder and color separation constraints
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
        ├── ContrastDebugOverlay.tsx # Dev contrast report (shortcut: D)
        ├── SceneCanvas.tsx      # Persistent 60fps canvas renderer (freeze/resume without reset)
        ├── UpNextQueue.tsx      # Dedicated right-docked UP NEXT queue panel
        ├── WheelPlayer.tsx      # SVG wheel and playback controls
        └── WipeTransition.tsx   # Full-height GSAP zipper reveal between scenes
└── tests/
    └── color.test.mjs           # Contrast utility, 20-color and scene-fallback regression tests
```

---

## 3. Album-Art Palette & Contrast Pipeline

1. On each track change, `extractAlbumColors` draws album art to a 48×48 offscreen canvas with `crossOrigin="anonymous"`. A small RGB bucket quantizer ignores transparent, near-black, near-white, and low-saturation pixels, then favors saturated buckets. The extraction promise is cached by Spotify track ID. If CORS or image decoding fails, the scene palette supplies the color seeds.
2. `resolveScene` still chooses the particle kind, scene label, and motion. Its palette builder combines the art colors with the selected scene's preset colors; `songPaletteMap` in `src/scenes/songMap.ts` adds an optional per-track palette override alongside the existing one-line scene mapping.
3. `buildPalette` returns flat `bg`, `surface`, `accent`, `accent2`, `ink`, and `paper` colors. `--on-bg`, `--on-surface`, and `--on-accent` come from `pickReadable` in `src/color/contrast.ts`. Backgrounds are nudged until one of ink or paper meets 4.5:1, with the black outline reaching at least 3:1. Page, surface, and accent colors stay distinct.
4. `WipeTransition` reveals the next flat background from left to right with a full-height moving zipper seam. It takes about 1.75 seconds, keeps the UI visible, then swaps the particle scene under the completed reveal and fades it away.
5. Main title, artist, lyric lines, wheel labels, queue rows, and panel controls use opaque surface/accent plates and the corresponding `on-*` foreground role. In development, press `D` for a contrast report; pairs below 4.5:1 are flagged.

Run `npm test` for the contrast utility checks, the 20-color suite (including pure yellow, white, black, gray, cyan, hot pink, and navy), and the 12-scene fallback/curated palette checks.

### Files changed for the palette pass

- `src/color/contrast.ts`, `src/color/extract.ts`, `src/color/palette.ts`
- `src/scenes/scenes.ts`, `src/scenes/songMap.ts`
- `src/App.tsx`, `src/components/WipeTransition.tsx`, `src/components/ContrastDebugOverlay.tsx`
- `src/components/WheelPlayer.tsx`, `src/components/UpNextQueue.tsx`, `src/lyrics/HeroLyrics.tsx`, `src/styles.css`
- `tests/color.test.mjs`, `package.json`, and this document

---

## 4. PWA Installation and Playback Requirements

- `index.html` links the web manifest and Apple home-screen icon. `public/manifest.webmanifest` declares standalone display and matching 192px/512px icons.
- `src/App.tsx` registers `public/sw.js` in production and exposes the browser install prompt where supported. On iOS, the install button displays the Safari **Share → Add to Home Screen** steps.
- The service worker caches the app shell and same-origin static assets only. Spotify login, playback, search, and LRCLIB lyrics still require a network connection.
- Spotify playback requires Premium and a supported browser. The Web Playback SDK does not provide decoded PCM/frequency data to AuraPlayer, so the removed wheel visualizer is not advertised as audio-reactive.

---

## 5. Spotify Auth & Crash Resilience Architecture

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

---

## 6. Provider Architecture and Current Integration Status

- `src/providers/types.ts` defines provider IDs, capability names, and the adapter contract. `src/providers/spotify.ts` is the adapter for Spotify sign-in, search, and playlists; `src/providers/registry.ts` distinguishes implemented providers from future integrations.
- `src/player/types.ts` defines the normalized `Track` shape and `src/player/source.ts` defines shared playback controls. `SpotifySource` wraps the existing SDK/API, and `src/youtube/source.ts` wraps one persistent official YouTube IFrame Player instance.
- `src/components/ConnectedServices.tsx` is the provider status center. Spotify connect/disconnect uses the existing PKCE/auth and playback lifecycle. YouTube video search/playback needs a restricted Data API key and no user login. Apple Music and SoundCloud are not integrated; YouTube Music is unavailable as an account integration.
- Spotify and YouTube videos are supported as separate sources, each with its own queue. YouTube uses an AuraPlayer-local queue because the Data API has no queue control. Cross-provider mixed queues are not enabled.
- Apple Music’s official web SDK can search/play catalog and library content, but requires a developer token signed with an Apple private key. Keep token signing server-side; never place that private key in Vite environment variables.
- SoundCloud offers an official API and OAuth 2.1 PKCE, but streaming is per-track availability dependent and refresh tokens are single-use. It requires app credentials and an adapter with secure token lifecycle handling.
- Google’s official YouTube IFrame Player API works with public embedded videos; it is not a YouTube Music account/library connection. AuraPlayer does not use unofficial YouTube Music APIs.
- `src/youtube/api.ts` searches only after explicit submission, caches results per query in memory and session storage, loads durations in one batched `videos.list` request, and tracks daily searches. The browser-side guard is 100 searches per UTC day with a low-quota notice beginning at 80. Google quota settings can differ by project and change over time; the Google Cloud Console is authoritative.
- YouTube autoplay uses optional Last.fm similar-track/artist results, resolving at most five suggestions per fill. YouTube position is polled at 4 Hz only while playing and held outside React state. LRCLIB, scene resolution, and album-art palette extraction consume normalized tracks.
- A deterministic CSS layer stack puts scene transitions below queue/library surfaces and the wheel; expanded player controls stay above both. The services center is the top modal layer. The zipper begins fully offscreen based on the full tab width, not just its narrow seam.
- Mobile title, artist, playlist and lyric boxes now have explicit minimum-width, wrapping and font-size constraints; Playlists uses a library icon distinct from Play Order’s queue icon.

### Current integration scope

| Service | Status | Integration detail |
| --- | --- | --- |
| Spotify | Fully integrated | OAuth PKCE, Web Playback SDK, search, playlists, playback and queue; Premium required for web playback. |
| Apple Music | Not integrated | Official MusicKit exists; needs Apple developer credentials and server-signed developer tokens. |
| SoundCloud | Not integrated | Official API exists; needs app access and track-aware streaming/refresh handling. |
| YouTube Music | Unavailable as an account integration | Official YouTube video embeds are distinct from YouTube Music. |
| YouTube videos | Fully integrated | Official Data API v3 search and persistent visible IFrame Player; public videos, no YouTube account login, local queue, and Google quota/key restrictions apply. |

---

## 7. Multi-Source Scene, Embed, and Connection Fixes (2026-11-17)

### Root causes found

1. **Per-song colors were discarded by a key mismatch.** Album art sampling used a `source:id` cache key, but the result was stored under the plain track ID. Scene resolution looked up the namespaced key, so it never received extracted colors and repeatedly used preset colors. The palette fallback also hashed only the raw ID, and an art failure used one static preset.
2. **The YouTube card was unconditional.** `App.tsx` rendered `YouTubeSourceCard` in every mode, and its mount effect immediately created the IFrame player. The empty grid column and sticker therefore remained in Spotify mode.
3. **Source selection was not a connection lifecycle.** The old `switchSource` only paused the other player and changed local React state. It did not destroy/disconnect that provider, and Zustand had no active-source or per-provider status. Fast clicks could overlap transitions.

### Changes made

- The normalized current track now lives in Zustand and drives scene resolution for both providers. Palette extraction, resolved scene revisions, fallback colors, and motion variants use `${source}:${id}`. Missing track IDs log a development warning.
- Artwork sampling sets `crossOrigin="anonymous"`, retries through a fetched blob/object URL when possible, and derives a deterministic saturated fallback palette from the source-qualified track key when image/canvas access fails. YouTube titles and artist names are normalized before scene matching and LRCLIB requests.
- The resolver records the winning step (`songMap`, lyric keywords, title keywords, genre, palette fallback, or idle). The existing `D` contrast overlay now also reports the track key, scene/step, and palette hex values.
- The YouTube card mounts only while YouTube is active/connecting, animates with a GSAP transform/opacity reveal, and exits from layout when disconnected. Disconnect stops and destroys the iframe player; a generation guard prevents an in-flight API load from recreating a disconnected player.
- Zustand now owns `activeSource`, each source's connection status, and `currentTrack`. Header and provider-hub controls share `connectSource`; transitions are serialized. Switching sources pauses and disconnects the other source, clears its current track/queue/playback state, and keeps a valid Spotify token in storage for an explicit reconnect. Reload restores YouTube only if it was last active and Spotify only if its stored token validates.

### Verification and remaining manual checks

- `npm run build` passes.
- `npm test` passes all 7 existing contrast and YouTube metadata tests.
- Not manually verified with five real tracks on each provider in this environment: that requires the owner’s Spotify Premium/allowlisted session, YouTube Data API key, and interactive playback. Use the `D` overlay to inspect per-track scene resolution and palette while testing. No other known implementation item remains from this fix request.

### Files changed for this fix

- `src/App.tsx`, `src/store/player.ts`, `src/auth/pkce.ts`
- `src/scenes/scenes.ts`, `src/color/extract.ts`, `src/components/ContrastDebugOverlay.tsx`
- `src/components/YouTubeSourceCard.tsx`, `src/youtube/source.ts`, `src/components/ConnectedServices.tsx`
- `src/styles.css`, and this document
