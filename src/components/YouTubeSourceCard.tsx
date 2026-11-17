import { useEffect, useRef } from 'react';
import { Youtube } from 'lucide-react';
import type { YouTubeSource } from '../youtube/source';

type Props = { source: YouTubeSource; error?: string };

export function YouTubeSourceCard({ source, error }: Props) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (host.current) void source.mount(host.current);
  }, [source]);
  return (
    <section className="youtube-source-card" aria-label="YouTube video source">
      <span className="youtube-source-sticker"><Youtube size={14} /> SOURCE / YOUTUBE</span>
      <div className="youtube-player-viewport">
        <div ref={host} className="youtube-player-host" />
        {!source.hasMedia() && <span className="youtube-idle-mark">SELECT A VIDEO TO PLAY</span>}
      </div>
      {error && <p className="youtube-video-error" role="status">{error}</p>}
      <small>OFFICIAL EMBEDDED VIDEO · NO YOUTUBE LOGIN</small>
    </section>
  );
}
