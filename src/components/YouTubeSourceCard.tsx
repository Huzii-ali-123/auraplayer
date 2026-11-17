import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Youtube } from 'lucide-react';
import type { YouTubeSource } from '../youtube/source';

type Props = { source: YouTubeSource; active: boolean; error?: string };

export function YouTubeSourceCard({ source, active, error }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const [rendered, setRendered] = useState(active);

  useLayoutEffect(() => {
    if (active) setRendered(true);
  }, [active]);

  useLayoutEffect(() => {
    const node = section.current;
    if (!node) return;
    if (active) {
      gsap.killTweensOf(node);
      gsap.fromTo(node, { x: 22, opacity: 0 }, { x: 0, opacity: 1, duration: 0.32, ease: 'power2.out', overwrite: true });
    } else {
      gsap.to(node, { x: -22, opacity: 0, duration: 0.24, ease: 'power2.in', overwrite: true, onComplete: () => setRendered(false) });
    }
    return () => { gsap.killTweensOf(node); };
  }, [active, rendered]);

  useEffect(() => {
    if (active && host.current) void source.mount(host.current);
  }, [active, source, rendered]);

  if (!rendered) return null;
  return (
    <section ref={section} className="youtube-source-card" aria-label="YouTube video source">
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
