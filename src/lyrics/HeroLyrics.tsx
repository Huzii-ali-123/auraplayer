import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import type { ProgressState } from '../components/WheelPlayer';
import { parseLrc } from './client';
import type { LyricLine, LyricsRecord } from './client';

type Props = {
  trackId?: string;
  lyrics: LyricsRecord | null;
  progressRef: React.MutableRefObject<ProgressState>;
  onSeek: (fraction: number) => void;
};

type DisplayPayload = { trackId?: string; lyrics: LyricsRecord | null };
type Geometry = { offset: number; height: number };

const STORAGE_KEY = 'auraplayer_show_lyrics';
const readLyricsPref = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  } catch { return true; }
};

function HeroLyricsView({ trackId, lyrics, progressRef, onSeek }: Props) {
  const [showLyrics, setShowLyrics] = useState<boolean>(readLyricsPref);
  const [display, setDisplay] = useState<DisplayPayload>({ trackId, lyrics });
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const gapRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const textRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const geometryRef = useRef<Geometry[]>([]);
  const activeIndexRef = useRef(-1);
  const seekTargetRef = useRef<number | null>(null);
  const seekStartedAtRef = useRef(0);
  const resizeSyncRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const targetRef = useRef<DisplayPayload>({ trackId, lyrics });
  const initializedRef = useRef(false);

  const synced = display.lyrics?.syncedLyrics || '';
  const entries = useMemo(() => (synced ? parseLrc(synced) : []), [synced]);
  const plainLines = useMemo(
    () => display.lyrics?.plainLyrics?.split(/\r?\n/).map(line => line.trim()).filter(Boolean) || [],
    [display.lyrics]
  );
  const hasLyrics = entries.length > 0 || plainLines.length > 0;

  const toggleVisibility = () => setShowLyrics(value => {
    const next = !value;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private browsing */ }
    return next;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input,textarea,button,[contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'l') { event.preventDefault(); toggleVisibility(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Keep the outgoing list mounted while it fades; new track data enters only after fade-out.
  useLayoutEffect(() => {
    const next = { trackId, lyrics };
    const prev = targetRef.current;
    const changed = prev.trackId !== next.trackId || prev.lyrics !== next.lyrics;
    if (!changed && initializedRef.current) return;
    targetRef.current = next;
    if (!initializedRef.current) {
      initializedRef.current = true;
      setDisplay(next);
      return;
    }

    const content = contentRef.current;
    if (!content) { setDisplay(next); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.killTweensOf(content);
      gsap.set(content, { opacity: 1, y: 0 });
      setDisplay(next);
      return;
    }
    const token = Symbol('lyrics-transition');
    (content as HTMLDivElement & { __transition?: symbol }).__transition = token;
    gsap.killTweensOf(content);
    gsap.to(content, {
      opacity: 0, y: -8, duration: 0.25, ease: 'power2.in', overwrite: true,
      onComplete: () => {
        if ((content as HTMLDivElement & { __transition?: symbol }).__transition !== token) return;
        setDisplay(next);
        requestAnimationFrame(() => {
          if ((content as HTMLDivElement & { __transition?: symbol }).__transition !== token) return;
          gsap.fromTo(content, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', overwrite: true });
        });
      }
    });
  }, [trackId, lyrics]);

  // Measure lyric offsets only after load and on resize, never from the playback ticker.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!viewport || !list || !entries.length) { geometryRef.current = []; return; }
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      geometryRef.current = entries.map((_, index) => {
        const node = lineRefs.current[index];
        if (!node) return { offset: 0, height: 0 };
        // offsetTop is layout-space and is unaffected by the animated list transform.
        return { offset: node.offsetTop, height: node.offsetHeight };
      });
      if (activeIndexRef.current >= 0) resizeSyncRef.current = true;
    };
    // Fonts can change wrapping and row height; wait for the actual font metrics.
    void document.fonts.ready.then(measure);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(list);
    return () => { disposed = true; observer.disconnect(); };
  }, [entries, display.trackId, showLyrics]);

  useGSAP(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    const marker = barRef.current;
    if (!viewport || !list || !marker) return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = media.matches;
    const onMotionChange = (event: MediaQueryListEvent) => { reducedMotionRef.current = event.matches; };
    media.addEventListener('change', onMotionChange);

    const setListY = gsap.quickTo(list, 'y', { duration: 0.58, ease: 'power3.out', overwrite: 'auto' });
    const progressSetters = textRefs.current.map(node => node ? gsap.quickSetter(node, '--lyric-progress') : null);
    let active = -1;
    let gapActive = false;

    const animateIndex = (index: number, fast: boolean) => {
      active = index;
      activeIndexRef.current = index;
      const viewportHeight = viewport.clientHeight;
      const geometry = geometryRef.current[index];
      if (geometry) {
        const y = viewportHeight * 0.4 - geometry.offset - geometry.height * 0.5;
        if (reducedMotionRef.current) gsap.set(list, { y });
        else if (fast) gsap.to(list, { y, duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
        else setListY(y);
        const barHeight = Math.min(54, Math.max(30, geometry.height * 0.76));
        const barY = geometry.offset + geometry.height * 0.5 - barHeight * 0.5;
        const barScale = barHeight / 40;
        if (reducedMotionRef.current) gsap.set(marker, { y: barY, scaleY: barScale });
        else gsap.to(marker, { y: barY, scaleY: barScale, duration: fast ? 0.3 : 0.42, ease: 'power3.out', overwrite: 'auto' });
      }

      const low = Math.max(0, index - 5);
      const high = Math.min(entries.length - 1, index + 5);
      lineRefs.current.forEach((node, lineIndex) => {
        if (!node) return;
        const lyricText = textRefs.current[lineIndex];
        if (lyricText) lyricText.classList.toggle('is-active', lineIndex === index);
        if (lineIndex === index) node.setAttribute('aria-current', 'true');
        else node.removeAttribute('aria-current');
        if (lineIndex < low || lineIndex > high) {
          const distance = Math.abs(lineIndex - index);
          node.style.color = 'var(--on-surface)';
          node.style.backgroundColor = 'var(--surface)';
          node.style.fontWeight = '600';
          gsap.set(node, { opacity: distance > 3 ? 0.85 : 0.9, scale: 0.9 });
          return;
        }
        const distance = Math.abs(lineIndex - index);
        const opacity = lineIndex === index ? 1 : distance > 3 ? 0.85 : 0.9;
        const scale = lineIndex === index ? 1 : 0.9;
        const color = lineIndex === index ? 'var(--on-accent)' : 'var(--on-surface)';
        const weight = lineIndex === index ? 800 : 600;
        node.style.color = color;
        node.style.backgroundColor = lineIndex === index ? 'var(--on-accent)' : 'var(--surface)';
        node.style.fontWeight = String(weight);
        if (reducedMotionRef.current) gsap.set(node, { opacity, scale: 1 });
        else gsap.to(node, { opacity, scale, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
      });
    };

    const paint = () => {
      if (!entries.length) return;
      const playback = progressRef.current;
      const elapsed = playback.playing ? Math.max(0, performance.now() - playback.updatedAt) : 0;
      const position = Math.min(playback.duration || Infinity, playback.position + elapsed);
      let lo = 0;
      let hi = entries.length - 1;
      let index = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (entries[mid].at <= position) { index = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      let displayIndex = index;
      const seekTarget = seekTargetRef.current;
      if (seekTarget !== null) {
        const seekReached = Math.abs(position - entries[seekTarget].at) < 1500;
        const seekTimedOut = performance.now() - seekStartedAtRef.current > 2500;
        if (seekReached || seekTimedOut) seekTargetRef.current = null;
        else displayIndex = seekTarget;
      }
      if (displayIndex !== active || resizeSyncRef.current) {
        const fast = seekTargetRef.current !== null;
        resizeSyncRef.current = false;
        animateIndex(displayIndex, fast);
      }

      const line = entries[displayIndex];
      const next = entries[displayIndex + 1];
      const isGap = !!next && next.at - line.at > 6000 && position > line.at + 1200 && position < next.at;
      if (isGap !== gapActive) {
        gapActive = isGap;
        const sticker = gapRef.current;
        if (sticker) {
          if (isGap && playback.playing && !reducedMotionRef.current) gsap.to(sticker, { autoAlpha: 1, y: 0, duration: 0.18, overwrite: true });
          else gsap.to(sticker, { autoAlpha: 0, y: 5, duration: 0.15, overwrite: true });
        }
      }
      if (gapActive && gapRef.current) {
        gapRef.current.dataset.playing = String(playback.playing && !reducedMotionRef.current);
      }

      // Local interpolation drives the accent mask; React never receives playback ticks.
      const text = textRefs.current[displayIndex];
      if (text) {
        const start = line.at;
        const end = next?.at ?? (start + Math.max(1000, line.duration));
        const fraction = playback.playing ? Math.max(0, Math.min(1, (position - start) / Math.max(1, end - start))) : Math.max(0, Math.min(1, (playback.position - start) / Math.max(1, end - start)));
        progressSetters[displayIndex]?.(`${fraction * 100}%`);
      }
    };

    gsap.ticker.add(paint);
    paint();
    return () => {
      gsap.ticker.remove(paint);
      media.removeEventListener('change', onMotionChange);
    };
  }, { dependencies: [entries, display.trackId], revertOnUpdate: true });

  // Toggle height separately so lyric text itself is never replaced by the animation.
  useGSAP(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (showLyrics) gsap.to(viewport, { height: 'auto', opacity: 1, duration: 0.3, ease: 'power3.out', overwrite: true });
    else gsap.to(viewport, { height: 0, opacity: 0, duration: 0.22, ease: 'power2.in', overwrite: true });
  }, { dependencies: [showLyrics, entries.length], revertOnUpdate: false });

  const seekLineAt = (index: number) => {
    if (!entries.length) return;
    const duration = progressRef.current.duration;
    if (duration > 0) {
      seekTargetRef.current = index;
      seekStartedAtRef.current = performance.now();
      onSeek(entries[index].at / duration);
    }
  };

  return (
    <div className="hero-lyrics-wrapper">
      <div className="hero-lyrics-toolbar">
        <button className="lyrics-toggle-btn" onClick={toggleVisibility} aria-label={showLyrics ? 'Hide lyrics' : 'Show lyrics'} title="Toggle lyrics (L)">
          {showLyrics ? <EyeOff size={13} /> : <Eye size={13} />}
          <span>{showLyrics ? 'HIDE LYRICS' : 'SHOW LYRICS'}</span><kbd>L</kbd>
        </button>
        {showLyrics && hasLyrics && <span className="lyrics-type-badge"><Sparkles size={11} /> {entries.length ? 'SYNCED' : 'PLAIN'}</span>}
      </div>

      <div ref={viewportRef} className={`hero-lyrics-viewport ${entries.length ? 'is-synced' : 'is-plain'}`}>
        <div ref={contentRef} className="hero-lyrics-content">
          {entries.length ? (
            <>
              <div ref={listRef} className="hero-lyrics-list">
                <div ref={barRef} className="hero-lyric-highlight-bar" aria-hidden="true" />
                {entries.map((line: LyricLine, index) => (
                  <button
                    key={`${line.at}-${index}`}
                    ref={node => { lineRefs.current[index] = node; }}
                    className="hero-lyric-list-line"
                    data-lyric-index={index}
                    aria-current={activeIndexRef.current === index ? 'true' : undefined}
                    aria-label={`Seek to ${line.text}`}
                    onClick={() => seekLineAt(index)}
                  >
                    <span ref={node => { textRefs.current[index] = node; }} className="hero-lyric-text">{line.text}</span>
                  </button>
                ))}
              </div>
              <div ref={gapRef} className="hero-lyrics-gap" aria-label="Instrumental break" aria-hidden="true">
                <b>...</b><span><i /><i /><i /></span>
              </div>
            </>
          ) : plainLines.length ? (
            <div className="hero-lyrics-plain" aria-label="Plain lyrics">
              {plainLines.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
            </div>
          ) : <div className="hero-lyrics-missing"><span className="no-lyrics-sticker">NO LYRICS FOUND</span></div>}
        </div>
      </div>
    </div>
  );
}

export const HeroLyrics = memo(HeroLyricsView);
