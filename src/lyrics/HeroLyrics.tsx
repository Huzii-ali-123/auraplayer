import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import type { ProgressState } from '../components/WheelPlayer';
import { parseLrc } from './client';
import type { LyricLine, LyricsRecord } from './client';

type Props = {
  lyrics: LyricsRecord | null;
  progressRef: React.MutableRefObject<ProgressState>;
  onSeek: (fraction: number) => void;
  accentColor: string;
};

const STORAGE_KEY = 'auraplayer_show_lyrics';

function readLyricsPref(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  } catch {
    return true;
  }
}

function saveLyricsPref(val: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
  } catch {}
}

function HeroLyricsView({ lyrics, progressRef, onSeek, accentColor }: Props) {
  const [showLyrics, setShowLyrics] = useState<boolean>(readLyricsPref);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Line elements refs for direct DOM mutation without React state ticks
  const prevLineRef = useRef<HTMLButtonElement>(null);
  const currentLineRef = useRef<HTMLButtonElement>(null);
  const nextLine1Ref = useRef<HTMLButtonElement>(null);
  const nextLine2Ref = useRef<HTMLButtonElement>(null);
  const chorusBadgeRef = useRef<HTMLSpanElement>(null);

  const synced = lyrics?.syncedLyrics || '';
  const syncedEntries: LyricLine[] = useMemo(() => (synced ? parseLrc(synced) : []), [synced]);
  const plainLines: string[] = useMemo(
    () => lyrics?.plainLyrics?.split(/\r?\n/).map(s => s.trim()).filter(Boolean) || [],
    [lyrics]
  );
  const hasLyrics = syncedEntries.length > 0 || plainLines.length > 0;

  const currentIdxRef = useRef<number>(-1);
  const entriesRef = useRef<LyricLine[]>(syncedEntries);
  entriesRef.current = syncedEntries;

  // Toggle button handler
  const toggleVisibility = () => {
    setShowLyrics(prev => {
      const next = !prev;
      saveLyricsPref(next);
      return next;
    });
  };

  // Keyboard shortcut: 'L' key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,textarea,button')) return;
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        toggleVisibility();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Collapse / Expand animation
  useGSAP(
    () => {
      if (!viewportRef.current) return;
      if (showLyrics) {
        gsap.to(viewportRef.current, {
          height: 'auto',
          opacity: 1,
          y: 0,
          scaleY: 1,
          duration: 0.32,
          ease: 'power3.out',
          overwrite: true
        });
      } else {
        gsap.to(viewportRef.current, {
          height: 0,
          opacity: 0,
          y: -8,
          scaleY: 0.94,
          duration: 0.24,
          ease: 'power3.in',
          overwrite: true
        });
      }
    },
    { dependencies: [showLyrics], revertOnUpdate: false }
  );

  // Kinetic lyric line updates on gsap.ticker
  useGSAP(
    () => {
      const entries = syncedEntries;
      if (!entries.length) {
        // Plain lyrics fallback setup
        if (plainLines.length) {
          if (prevLineRef.current) prevLineRef.current.textContent = '';
          if (currentLineRef.current) currentLineRef.current.textContent = plainLines[0] || '';
          if (nextLine1Ref.current) nextLine1Ref.current.textContent = plainLines[1] || '';
          if (nextLine2Ref.current) nextLine2Ref.current.textContent = plainLines[2] || '';
        }
        return;
      }

      currentIdxRef.current = -1;

      const paint = () => {
        const p = progressRef.current;
        const elapsed = p.playing ? Math.max(0, performance.now() - p.updatedAt) : 0;
        const position = Math.min(p.duration, p.position + elapsed);

        // Binary search active line
        let low = 0;
        let high = entries.length - 1;
        let idx = 0;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (entries[mid].at <= position) {
            idx = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        if (idx !== currentIdxRef.current) {
          currentIdxRef.current = idx;
          const prev = entries[idx - 1]?.text || '';
          const curr = entries[idx]?.text || '';
          const next1 = entries[idx + 1]?.text || '';
          const next2 = entries[idx + 2]?.text || '';
          const isChorus = entries[idx]?.isChorus || false;

          if (prevLineRef.current) prevLineRef.current.textContent = prev;
          if (currentLineRef.current) currentLineRef.current.textContent = curr;
          if (nextLine1Ref.current) nextLine1Ref.current.textContent = next1;
          if (nextLine2Ref.current) nextLine2Ref.current.textContent = next2;

          if (chorusBadgeRef.current) {
            chorusBadgeRef.current.style.display = isChorus ? 'inline-flex' : 'none';
          }

          // Transform & Opacity slide-up transition on line change
          if (currentLineRef.current) {
            gsap.fromTo(
              currentLineRef.current,
              { y: 14, opacity: 0.3 },
              { y: 0, opacity: 1, duration: 0.28, ease: 'power2.out', overwrite: true }
            );
          }
        }
      };

      paint();
      gsap.ticker.add(paint);
      return () => gsap.ticker.remove(paint);
    },
    { dependencies: [syncedEntries, plainLines], revertOnUpdate: false }
  );

  const seekLineAt = (offset: number) => {
    const entries = entriesRef.current;
    if (!entries.length) return;
    const targetIdx = Math.max(0, Math.min(entries.length - 1, currentIdxRef.current + offset));
    const targetLine = entries[targetIdx];
    if (targetLine && progressRef.current.duration) {
      onSeek(targetLine.at / progressRef.current.duration);
    }
  };

  return (
    <div ref={containerRef} className="hero-lyrics-wrapper">
      <div className="hero-lyrics-toolbar">
        <button
          className="lyrics-toggle-btn"
          onClick={toggleVisibility}
          title="Toggle lyrics overlay (Shortcut: L)"
        >
          {showLyrics ? <EyeOff size={13} /> : <Eye size={13} />}
          <span>{showLyrics ? 'HIDE LYRICS' : 'SHOW LYRICS'}</span>
          <kbd>L</kbd>
        </button>
        {showLyrics && hasLyrics && (
          <span className="lyrics-type-badge">
            <Sparkles size={11} /> {syncedEntries.length ? 'SYNCED' : 'PLAIN'}
          </span>
        )}
      </div>

      <div
        ref={viewportRef}
        className="hero-lyrics-viewport"
        style={{ '--lyric-accent': accentColor } as React.CSSProperties}
      >
        {hasLyrics ? (
          <div className="hero-lyrics-stack">
            {/* Previous Line (Dimmed) */}
            <button
              ref={prevLineRef}
              className="hero-lyric-line is-prev"
              onClick={() => seekLineAt(-1)}
              title="Click to seek back"
            />

            {/* Current Line (Large & Bold with Scene Accent Color) */}
            <div className="hero-lyric-current-row">
              <button
                ref={currentLineRef}
                className="hero-lyric-line is-current"
                onClick={() => seekLineAt(0)}
                title="Active lyric line"
              />
              <span ref={chorusBadgeRef} className="hero-chorus-badge">
                CHORUS
              </span>
            </div>

            {/* Next 2 Lines (Dimmed) */}
            <button
              ref={nextLine1Ref}
              className="hero-lyric-line is-next"
              onClick={() => seekLineAt(1)}
              title="Click to seek forward"
            />
            <button
              ref={nextLine2Ref}
              className="hero-lyric-line is-next is-faint"
              onClick={() => seekLineAt(2)}
              title="Click to seek forward"
            />
          </div>
        ) : (
          <div className="hero-lyrics-missing">
            <span className="no-lyrics-sticker">NO LYRICS FOUND</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const HeroLyrics = memo(HeroLyricsView);
