# AURA//PLAYER

**AURA//PLAYER** is a Spotify web player with a neo-brutalist interface. The page changes its color palette and animated scene with the current track. It includes a circular playback wheel, queue and playlist panels, Spotify search, lyrics when available, and optional autoplay suggestions.

> **Spotify Premium is required for playback.** You need your own Spotify account and your own Spotify Developer app Client ID to run this project. Do not use somebody else's account or API credentials.

Repository: [github.com/Huzii-ali-123/auraplayer](https://github.com/Huzii-ali-123/auraplayer)

## Features

- Spotify sign-in using Authorization Code with PKCE. The frontend does not use a Spotify client secret.
- Spotify Web Playback SDK browser device with play/pause, next/previous, seek, volume, shuffle, and transfer to AuraPlayer.
- Spotify search, playlists, and the current Spotify queue.
- A wheel player with an SVG progress ring and album art.
- Nine scene palettes: Snow, Rain, Night Stars, Fireflies, Embers, Ocean, Sunset, Neon City, and Cherry Blossom.
- A custom Canvas 2D renderer draws geometric particles. Track changes reveal the incoming flat scene left-to-right with a slow, zipper-style GSAP transition while the player remains visible.
- Synced or plain lyrics are shown when LRCLIB has a match. Missing lyrics leave the player in its normal scene.
- Optional Last.fm similarity data can fill the autoplay queue. Without a Last.fm key, AuraPlayer can fall back to Spotify search.
- Responsive layout, reduced-motion support, keyboard shortcuts, and a development-only frame meter.
- Installable PWA with a home-screen icon, standalone display, and cached app shell. Spotify playback still needs an internet connection.
- Optional related-track autoplay fills Spotify's queue for single-track playback in the background; Next is sent immediately and rapid duplicate skip clicks are ignored while Spotify changes tracks.

## Requirements

- Node.js 20 or newer and npm
- Git
- A Spotify account with **Premium** for browser playback
- A Spotify Developer app and its Client ID
- Optional: a Last.fm API key for Last.fm-based autoplay suggestions

## Run it on Windows

Clone the repository and install packages:

```powershell
git clone https://github.com/Huzii-ali-123/auraplayer.git
cd auraplayer
npm install
Copy-Item .env.example .env
```

Open `.env` and replace `your_spotify_client_id` with the Client ID from your own Spotify Developer app. Keep the redirect URI exactly as shown:

```dotenv
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback
VITE_LASTFM_API_KEY=your_lastfm_api_key_here
```

`VITE_LASTFM_API_KEY` is optional. Leave the placeholder if you do not want Last.fm-powered autoplay. No Spotify client secret belongs in `.env` or in the frontend.

Start the development server:

```powershell
npm run dev
```

Always open **[http://127.0.0.1:5173/](http://127.0.0.1:5173/)**, never `localhost`. Vite binds to IPv4 `127.0.0.1` on port `5173` and refuses to silently switch ports. If `5173` is already in use, stop the other dev server first. The app redirects a `localhost:5173` page to the canonical IP origin before React and Spotify authentication start, so the PKCE storage and callback share the same origin.

## Install AuraPlayer on a phone

Deploy the site to HTTPS (the Vercel URL is already HTTPS), then open it in the phone's browser and use **INSTALL APP** if offered. On iPhone/iPad, open the page in Safari, tap **Share**, then **Add to Home Screen**. On Android, use **Install app** from the browser prompt or menu. The installed shortcut opens AuraPlayer in a standalone app window. Keep an internet connection for Spotify sign-in, search, lyrics, and streaming; the service worker only caches the app shell and static files.

## Configure Spotify

1. Sign in to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) with your own Spotify account and create an app.
2. In the app settings, add this exact value to **Redirect URIs**, then save:

   ```text
   http://127.0.0.1:5173/callback
   ```

3. Copy the app's **Client ID** into `VITE_SPOTIFY_CLIENT_ID` in your local `.env` file.
4. Confirm `VITE_SPOTIFY_REDIRECT_URI` is exactly `http://127.0.0.1:5173/callback` in `.env`.
5. Run `npm run dev`, open `http://127.0.0.1:5173/`, and click **CONNECT SPOTIFY**.
6. Approve access on Spotify. Spotify should return you to AuraPlayer. If the browser blocks playback until a user action, click **CLICK TO START**.

The app requests these Spotify scopes:

```text
streaming
user-read-email
user-read-private
user-read-playback-state
user-modify-playback-state
user-read-currently-playing
playlist-read-private
```

Spotify development-mode apps may restrict sign-in to users explicitly added in the Developer Dashboard's user management settings. Add the Spotify account you use to test the app if Spotify reports that the account is not allowed.

## Deploy to Vercel

The repository's `.env` is for local development only. For the deployed site, add environment variables in **Vercel → Project → Settings → Environment Variables**:

```dotenv
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_SPOTIFY_REDIRECT_URI=https://your-project.vercel.app/callback
```

For this deployment, the redirect value should be:

```text
https://auraplayer-one.vercel.app/callback
```

In Spotify Developer Dashboard, register both the local URI (`http://127.0.0.1:5173/callback`) and the deployed URI (`https://auraplayer-one.vercel.app/callback`). They must exactly match their respective local and Vercel environment values. Select Production (and Preview if needed) for the Vercel variables, then redeploy so Vite rebuilds with them. Never replace your local `.env` callback with the Vercel URL; keep the local and hosted origins separate.

## Troubleshooting Spotify login and playback

- **Connection refused on the callback:** make sure `npm run dev` is still running and open `http://127.0.0.1:5173/`. Do not start sign-in from `localhost` or another port.
- **Port 5173 is busy:** stop the other Vite process, then run `npm run dev` again. `strictPort` is enabled by design; the app needs the registered callback port.
- **Redirect URI mismatch locally:** compare the Spotify Dashboard value and local `.env` character-for-character; both must be `http://127.0.0.1:5173/callback`.
- **Redirect URI mismatch on Vercel:** set `VITE_SPOTIFY_REDIRECT_URI` in Vercel to `https://your-project.vercel.app/callback`, register that exact URL in Spotify, then redeploy.
- **Verifier missing or state mismatch:** return to `http://127.0.0.1:5173/` and start a fresh sign-in. Do not start the flow on one hostname and finish it on another.
- **Premium or playback error:** browser playback through the Spotify Web Playback SDK requires Spotify Premium and a supported browser. Approve the Spotify prompt, return to AuraPlayer, and use **CLICK TO START** if prompted.
- **Account not permitted:** in Spotify's development mode, make sure your testing account is included in the app's allowed users.
- **API changes are not visible:** restart Vite after changing `.env`; Vite reads those variables when the dev server starts.

## Features and controls

- Press **Space** to play or pause.
- Press **Left** or **Right Arrow** to seek by five seconds.
- Press **Shift + Left** or **Shift + Right** to skip tracks.
- Press **L** to toggle the lyrics display.
- Use **SEARCH**, **PLAYLISTS**, and **UP NEXT** to find music and inspect the queue.
- Click the wheel's progress ring to seek. Adjust volume and shuffle in the expanded player panel.
- The expanded panel's repeat control cycles **Repeat All → Repeat One → Repeat Off**. With single-track playback and related picks enabled, AuraPlayer fills the Spotify queue in the background. Next is dispatched immediately; duplicate clicks are ignored during the track transition.

Lyrics are retrieved from [LRCLIB](https://lrclib.net/) using track metadata and duration. Availability depends on that service's catalogue; instrumental tracks and tracks with no match show the player without lyrics. Spotify does not provide the lyrics used by this interface.

Last.fm is only used for optional autoplay discovery. Its API key is a public client-side key when placed in a Vite `VITE_` variable, so do not put a private account password or other secret there. Autoplay can also search Spotify when Last.fm is not configured or has no results.

## Add a song-to-scene mapping

Open `src/scenes/songMap.ts` and add one entry using the Spotify track ID and a scene key:

```ts
'spotify_track_id': 'snow',
```

Scene keys are `snow`, `rain`, `stars`, `fireflies`, `ember`, `ocean`, `sunset`, `neon`, and `blossom`. The resolver checks the curated map, then matches keywords in the title, album, and artist, then checks artist genres, and finally uses colors sampled from album art.

## Project layout

```text
src/
├── App.tsx                 # App composition, Spotify SDK, search, playlists, queue
├── auth/pkce.ts            # PKCE sign-in, callback exchange, and token refresh
├── autoplay/autoplay.ts    # Optional Last.fm discovery and Spotify queue insertion
├── components/
│   ├── ErrorBoundary.tsx   # Top-level React crash screen
│   ├── SceneCanvas.tsx     # Canvas 2D scenes and dev frame meter
│   ├── UpNextQueue.tsx     # Upcoming track list
│   ├── WheelPlayer.tsx     # SVG wheel and playback controls
│   └── WipeTransition.tsx  # GSAP scene transition
├── lyrics/                 # LRCLIB fetch and synchronized hero lyrics
├── scenes/                 # Scene definitions, resolver, and song map
├── spotify/api.ts          # Spotify Web API client
└── store/player.ts         # Zustand player state
```

## Commands

```powershell
npm run dev      # Start at http://127.0.0.1:5173/
npm run build    # TypeScript check and production build in dist/
npm run preview  # Preview the production build
```

## Performance notes and limitations

- GSAP's ticker is capped at 60fps. The custom Canvas renderer caps the particle pool at 120 on desktop and 50 on mobile and caps device pixel ratio at 1.5.
- The canvas pauses when playback is paused, the tab is hidden, or reduced motion is requested. Track progress is extrapolated from Spotify SDK events without storing each progress tick in React state or polling playback on a timer.
- The development overlay reports ticker FPS and canvas render time. Actual frame timing depends on the device and browser; use Chrome DevTools Performance to profile your target machine.
- No tempo is inferred for fake beat synchronization. The app does not call Spotify's deprecated Audio Features or Audio Analysis endpoints, or the Recommendations endpoint.
- Spotify controls and catalogue access are subject to account, market, device, and Spotify API availability. Search results and playback may differ by account or region.

## License

No license file is currently included. Ask the repository owner before redistributing or reusing the project beyond the permissions granted by GitHub's default repository terms.
