# AURA//PLAYER

**AURA//PLAYER** is an independent Spotify and YouTube music-video player with a neo-brutalist interface. Switch sources in the header; the page changes its color palette and animated scene with the selected track. It includes a circular playback wheel, queue and playlist panels, lyrics when available, and optional related-track suggestions.

> **Spotify Premium is required for playback.** You need your own Spotify account and your own Spotify Developer app Client ID to run this project. Do not use somebody else's account or API credentials.

Repository: [github.com/Huzii-ali-123/auraplayer](https://github.com/Huzii-ali-123/auraplayer)

## Features

- Spotify sign-in using Authorization Code with PKCE. The frontend does not use a Spotify client secret.
- Spotify Web Playback SDK browser device with play/pause, next/previous, seek, volume, shuffle, and transfer to AuraPlayer.
- Spotify search, playlists, and the current Spotify queue.
- YouTube video search and playback through the official YouTube Data API v3 and a visible YouTube IFrame Player. YouTube needs no user login; results use a local queue and search only runs on Enter.
- A wheel player with an SVG progress ring and album art.
- Nine scene palettes: Snow, Rain, Night Stars, Fireflies, Embers, Ocean, Sunset, Neon City, and Cherry Blossom.
- A custom Canvas 2D renderer draws geometric particles. Track changes reveal the incoming flat scene left-to-right with a slow, zipper-style GSAP transition while the player remains visible.
- Synced or plain lyrics are shown when LRCLIB has a match. Missing lyrics leave the player in its normal scene.
- Optional Last.fm similarity data can fill the Spotify or YouTube queue. YouTube related picks require a Last.fm key.
- Responsive layout, reduced-motion support, keyboard shortcuts, and a development-only frame meter.
- Installable PWA with a home-screen icon, standalone display, and cached app shell. Both sources require an internet connection.
- Optional related-track autoplay fills Spotify's queue for single-track playback in the background; Next is sent immediately and rapid duplicate skip clicks are ignored while Spotify changes tracks.

## Requirements

- Node.js 20 or newer and npm
- Git
- A Spotify account with **Premium** for browser playback
- A Spotify Developer app and its Client ID
- A Google Cloud project with YouTube Data API v3 enabled and a website-restricted API key (for YouTube search)
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
VITE_YOUTUBE_API_KEY=your_google_cloud_youtube_data_api_v3_key_here
```

`VITE_LASTFM_API_KEY` is optional; YouTube related picks need it. `VITE_YOUTUBE_API_KEY` is required only for YouTube search. Vite variables are bundled into browser code, so restrict the Google key by website referrer and to the YouTube Data API v3 in Google Cloud Console. No Spotify client secret belongs in `.env` or in the frontend.

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

## Configure YouTube video search

YouTube source plays public music videos, not a user's YouTube Music library. It does not ask the listener to sign in. Search and playback use Google's official YouTube Data API and the official embedded player.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project and enable **YouTube Data API v3**.
2. Create an API key under **APIs & Services → Credentials**.
3. Restrict the key to **YouTube Data API v3**. Under website/referrer restrictions, allow the exact local and deployed origins, for example `http://127.0.0.1:5173/*` and `https://auraplayer-one.vercel.app/*`.
4. Put the key in local `.env` as `VITE_YOUTUBE_API_KEY=...`, restart Vite, or add it to Vercel Production/Preview environment variables and redeploy.
5. Choose **YOUTUBE** in AuraPlayer, open Search, type a query, then press Enter. Repeated identical searches use the session cache.

Quota note: the app stops new search requests at a local safety cap of 100 per UTC day and displays a counter/low-quota sticker. Google's current default quota documents 100 `search.list` requests per day; each costs 100 quota units. The `videos.list` detail request costs 1 unit. Google can change allocations, so check the quota page in your own Cloud project. A quota error is shown in the UI; Spotify remains available. See [YouTube quota details](https://developers.google.com/youtube/v3/getting-started#quota) and [search.list parameters](https://developers.google.com/youtube/v3/docs/search/list).

The embedded video remains visible in a framed source card at least 200×200 pixels, as required by YouTube's player guidance. Videos whose owners disable embedding or that are unavailable in your region are skipped with a message. See [YouTube IFrame Player requirements](https://developers.google.com/youtube/iframe_api_reference#Requirements).

## Deploy to Vercel

The repository's `.env` is for local development only. For the deployed site, add environment variables in **Vercel → Project → Settings → Environment Variables**:

```dotenv
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_SPOTIFY_REDIRECT_URI=https://your-project.vercel.app/callback
VITE_YOUTUBE_API_KEY=your_restricted_google_cloud_key
VITE_LASTFM_API_KEY=your_lastfm_api_key_here
```

For this deployment, the redirect value should be:

```text
https://auraplayer-one.vercel.app/callback
```

In Spotify Developer Dashboard, register both the local URI (`http://127.0.0.1:5173/callback`) and the deployed URI (`https://auraplayer-one.vercel.app/callback`). They must exactly match their respective local and Vercel environment values. Select Production (and Preview if needed) for the Vercel variables, then redeploy so Vite rebuilds with them. Restrict the Google key to your Vercel domain and local development origin. Never replace your local `.env` callback with the Vercel URL; keep the local and hosted origins separate.

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
- Use the **SPOTIFY / YOUTUBE** header tabs to switch between sources. Spotify requires OAuth and Premium for in-browser playback; public YouTube video search/playback does not require a YouTube login.
- Use **SEARCH**, **PLAYLISTS**, and **UP NEXT** to find music and inspect the queue.
- Click the wheel's progress ring to seek. Adjust volume and shuffle in the expanded player panel.
- The expanded panel's repeat control cycles **Repeat All → Repeat One → Repeat Off**. With single-track playback and related picks enabled, AuraPlayer fills the Spotify queue in the background. Next is dispatched immediately; duplicate clicks are ignored during the track transition.

Lyrics are retrieved from [LRCLIB](https://lrclib.net/) using track metadata and duration. Availability depends on that service's catalogue; instrumental tracks and tracks with no match show the player without lyrics. Spotify does not provide the lyrics used by this interface.

YouTube search uses cleaned video titles, channel names, available thumbnails, and durations returned by the Data API. Search results are cached for the tab session. The IFrame Player remains visible and uses the YouTube video itself; AuraPlayer does not extract audio streams or access a YouTube Music account. Shuffle, repeat, playlists, and Spotify's remote queue are not available for the YouTube source. Its queue is local to AuraPlayer.

Last.fm is only used for optional autoplay discovery. Its API key is a public client-side key when placed in a Vite `VITE_` variable, so do not put a private account password or other secret there. Spotify can use Spotify search for related picks if Last.fm has no results; YouTube related picks require Last.fm because the YouTube API does not expose related-video search.

## Add a song-to-scene mapping

Open `src/scenes/songMap.ts` and add one entry using the Spotify track ID or the namespaced YouTube video ID and a scene key:

```ts
'spotify_track_id': 'snow',
'youtube:youtube_video_id': 'ocean',
```

Scene keys are `snow`, `rain`, `stars`, `fireflies`, `ember`, `ocean`, `sunset`, `neon`, and `blossom`. The resolver checks the curated map, then matches keywords in the title, album, and artist, then checks artist genres, and finally uses colors sampled from album art.

## Project layout

```text
src/
├── App.tsx                 # App composition, Spotify SDK, search, playlists, queue
├── player/                  # Shared normalized track and playback source contract
├── youtube/                 # YouTube Data API, title cleaning, player source and autoplay
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
npm test         # Contrast and YouTube title/duration tests
```

## Performance notes and limitations

- GSAP's ticker is capped at 60fps. The custom Canvas renderer caps the particle pool at 120 on desktop and 50 on mobile and caps device pixel ratio at 1.5.
- The canvas pauses when playback is paused, the tab is hidden, or reduced motion is requested. Spotify progress is interpolated from SDK updates; YouTube position is polled only while playing at 4 Hz into a ref, not React state.
- The development overlay reports ticker FPS and canvas render time. Actual frame timing depends on the device and browser; use Chrome DevTools Performance to profile your target machine.
- No tempo is inferred for fake beat synchronization. The app does not call Spotify's deprecated Audio Features or Audio Analysis endpoints, or the Recommendations endpoint.
- Spotify controls and catalogue access are subject to account, market, device, and Spotify API availability. YouTube results/playback are subject to Google API quota, embedding permission, geography, and browser autoplay policy.

## License

No license file is currently included. Ask the repository owner before redistributing or reusing the project beyond the permissions granted by GitHub's default repository terms.
