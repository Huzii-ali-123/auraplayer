# AURA//PLAYER

A neo-brutalist Spotify player built with React 18, Vite, TypeScript, GSAP, `@gsap/react`, a custom Canvas 2D renderer, Zustand, and plain CSS with Tailwind available for utilities.

## Run locally

1. Use Node.js 20 or newer and run `npm install`.
2. In the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), create an app and add `http://127.0.0.1:5173/callback` as a **Redirect URI**.
3. Copy `.env.example` to `.env`, then set `VITE_SPOTIFY_CLIENT_ID` and `VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback`. There is no client secret in the frontend.
4. Run `npm run dev` and open `http://127.0.0.1:5173/callback`. Sign in with Spotify Premium. If the browser blocks playback, click **CLICK TO START**.

Spotify may require your account to be added to the app's allowed users while it is in development mode.

## Commands

- `npm run dev` — start Vite on its default local port
- `npm run build` — TypeScript check and production build to `dist/`
- `npm run preview` — preview the production build

## Add a curated scene

Add one entry to `src/scenes/songMap.ts`:

```ts
'spotify_track_id': 'snow',
```

Available scene keys are `snow`, `rain`, `stars`, `fireflies`, `ember`, `ocean`, `sunset`, `neon`, and `blossom`. The resolver checks the curated map first, then track title/album/artist keywords, artist genres, and sampled album-art colors.

## Performance implementation

- The GSAP ticker is capped at 60fps. GSAP timelines drive the scene wipe, while `gsap.quickTo` moves the SVG seek handle.
- The canvas owns a fixed pool capped at 120 desktop / 50 mobile particles and caps device pixel ratio at 1.5. Shapes are grouped for drawing; no particle library, per-frame gradients, shadows, or per-frame particle allocation is used.
- Canvas updates run through `gsap.ticker` only while playback is active and the page is visible. Reduced-motion preference renders a still scene without particles.
- Spotify's SDK state-change event updates a transient ref; the wheel extrapolates position from the last position and timestamp and writes the SVG arc and elapsed text directly. Playback progress is never held in React state and playback is not timer-polled.
- `WheelPlayer` is memoized and isolated. The dev-only overlay reports ticker FPS and canvas render work; use Chrome DevTools **Performance** on your target hardware for the full page's frame-time profile. No web app can guarantee a strict 16ms ceiling on every device or browser workload.

## Spotify limitations

Playback needs Spotify Premium, a supported browser, an active device, and sometimes a user gesture. Artist genres may be missing, in which case the resolver uses sampled album-art colors. Track tempo is not used for fake beat sync. The app does not call Audio Features, Audio Analysis, or Recommendations endpoints.
