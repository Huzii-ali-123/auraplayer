import { memo, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  Disc3,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Repeat2,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2
} from 'lucide-react';
import type { Track } from '../spotify/api';
import type { Scene } from '../scenes/scenes';

export type ProgressState = {
  position: number;
  duration: number;
  updatedAt: number;
  playing: boolean;
};

type Props = {
  track: Track | null;
  scene: Scene;
  playing: boolean;
  progressRef: React.MutableRefObject<ProgressState>;
  volume: number;
  shuffle: boolean;
  repeatMode: 'off' | 'context' | 'track';
  expanded: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (fraction: number) => void;
  onVolume: (volume: number) => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onSearch: () => void;
  onQueue: () => void;
  onExpand: () => void;
  onClose: () => void;
};

function WheelPlayerView({
  track,
  scene,
  playing,
  progressRef,
  volume,
  shuffle,
  repeatMode,
  expanded,
  onToggle,
  onNext,
  onPrev,
  onSeek,
  onVolume,
  onShuffle,
  onRepeat,
  onSearch,
  onQueue,
  onExpand,
  onClose,
}: Props) {
  const ring = useRef<SVGCircleElement>(null);
  const handle = useRef<SVGGElement>(null);
  const ticks = useRef<SVGGElement>(null);
  const disc = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelArtwork = useRef<HTMLDivElement>(null);
  const ringTween = useRef<gsap.core.Tween | null>(null);
  const discTween = useRef<gsap.core.Tween | null>(null);
  const panelTimeline = useRef<gsap.core.Timeline | null>(null);
  const currentTime = useRef<HTMLSpanElement>(null);
  const totalTime = useRef<HTMLSpanElement>(null);
  const progressBar = useRef<HTMLElement>(null);
  const isDragging = useRef(false);

  const radius = 76;
  const circumference = 2 * Math.PI * radius;

  // Rotate ticks and disc smoothly with playback pause/play
  useGSAP(
    () => {
      const tTween = gsap.to(ticks.current, {
        rotation: 360,
        transformOrigin: '100px 100px',
        duration: 18,
        ease: 'none',
        repeat: -1,
        paused: true
      });
      ringTween.current = tTween;

      const dTween = gsap.to(disc.current, {
        rotation: 360,
        transformOrigin: '50% 50%',
        duration: 24,
        ease: 'none',
        repeat: -1,
        paused: true
      });
      discTween.current = dTween;

      if (playing) {
        tTween.play();
        dTween.play();
      }

      return () => {
        tTween.kill();
        dTween.kill();
      };
    },
    { dependencies: [], revertOnUpdate: false }
  );

  // Sync animation speeds with playing state
  useEffect(() => {
    if (ringTween.current) {
      if (playing && ringTween.current.paused()) ringTween.current.play();
      gsap.to(ringTween.current, {
        timeScale: playing ? 1 : 0,
        duration: 0.65,
        ease: 'power2.out',
        overwrite: true
      });
    }
    if (discTween.current) {
      if (playing && discTween.current.paused()) discTween.current.play();
      gsap.to(discTween.current, {
        timeScale: playing ? 1 : 0,
        duration: 0.65,
        ease: 'power2.out',
        overwrite: true
      });
    }

  }, [playing]);

  // Panel expand / collapse animation
  useGSAP(
    () => {
      if (!panel.current) return;
      const timeline = gsap.timeline({ paused: true });
      timeline.fromTo(
        panel.current,
        { opacity: 0, scaleY: 0.88, scaleX: 0.94, pointerEvents: 'none' },
        { opacity: 1, scaleY: 1, scaleX: 1, pointerEvents: 'auto', duration: 0.28, ease: 'power3.out' }
      );
      panelTimeline.current = timeline;
      return () => {
        timeline.kill();
        panelTimeline.current = null;
      };
    },
    { dependencies: [], revertOnUpdate: false }
  );

  useEffect(() => {
    if (expanded) {
      panelTimeline.current?.play();
      if (panelArtwork.current) gsap.fromTo(panelArtwork.current, { opacity: 0, y: 14, scale: 0.975 }, {
        opacity: 1, y: 0, scale: 1, duration: 0.42, delay: 0.08, ease: 'power3.out', overwrite: true
      });
    } else {
      panelTimeline.current?.reverse();
      if (panelArtwork.current) gsap.to(panelArtwork.current, { opacity: 0, y: 8, duration: 0.16, overwrite: true });
    }
  }, [expanded]);

  // Direct DOM ticker loop: Progress ring, Seek handle, Time format
  useGSAP(
    () => {
      if (!ring.current || !handle.current) return;
      gsap.set(handle.current, { svgOrigin: '100 100' });
      const rotateHandle = gsap.quickTo(handle.current, 'rotation', { duration: 0.08, ease: 'none' });

      const paint = () => {
        const p = progressRef.current;
        const elapsed = p.playing ? Math.max(0, performance.now() - p.updatedAt) : 0;
        const position = Math.min(p.duration, p.position + elapsed);
        const fraction = p.duration ? position / p.duration : 0;

        ring.current?.setAttribute('stroke-dashoffset', String(circumference * (1 - fraction)));
        ring.current?.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
        rotateHandle(fraction * 360);

        if (currentTime.current) currentTime.current.textContent = fmt(position);
        if (totalTime.current) totalTime.current.textContent = fmt(p.duration);
        if (progressBar.current) progressBar.current.style.transform = `scaleX(${fraction})`;
      };

      gsap.ticker.add(paint);
      return () => gsap.ticker.remove(paint);
    },
    { dependencies: [], revertOnUpdate: false }
  );

  const seekAt = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left - box.width / 2;
    const y = event.clientY - box.top - box.height / 2;
    let angle = Math.atan2(y, x) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    onSeek(angle / (Math.PI * 2));
  };

  const art = track?.album?.images?.[0]?.url || '';

  return (
    <div
      className={`wheel-dock ${expanded ? 'expanded' : ''}`}
    >
      <div className="wheel-wrap">
        <svg
          className="wheel-svg"
          viewBox="0 0 200 200"
          aria-label="Track progress seek control"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId);
            isDragging.current = true;
            seekAt(e);
          }}
          onPointerMove={e => {
            if (isDragging.current) seekAt(e);
          }}
          onPointerUp={() => {
            isDragging.current = false;
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowRight') {
              onSeek(
                Math.min(
                  1,
                  (progressRef.current.position + 5000) / Math.max(progressRef.current.duration, 1)
                )
              );
            }
            if (e.key === 'ArrowLeft') {
              onSeek(
                Math.max(
                  0,
                  (progressRef.current.position - 5000) / Math.max(progressRef.current.duration, 1)
                )
              );
            }
          }}
        >
          <circle cx="100" cy="100" r={radius} className="wheel-base" />
          <circle
            ref={ring}
            cx="100"
            cy="100"
            r={radius}
            className="wheel-progress"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
          />
          <g ref={ticks} className="wheel-ticks">
            {Array.from({ length: 48 }, (_, i) => (
              <line
                key={i}
                x1="100"
                y1="7"
                x2="100"
                y2={i % 4 === 0 ? '15' : '11'}
                className={i % 4 === 0 ? 'major-tick' : 'minor-tick'}
                transform={`rotate(${i * 7.5} 100 100)`}
              />
            ))}
          </g>
          <g ref={handle} className="seek-handle">
            <circle cx="100" cy="24" r="6" />
          </g>
          <circle cx="100" cy="100" r="92" className="wheel-border" />
        </svg>

        {/* Center spinning album disc */}
        <button
          className="wheel-disc"
          ref={disc}
          onClick={onExpand}
          aria-label="Show player details"
        >
          {art ? <img src={art} alt="Current album cover" /> : <Disc3 size={47} />}
          <span className="disc-center" />
        </button>

        {/* Sticker controls */}
        <button className="sticker prev-sticker" aria-label="Previous track" onClick={onPrev}>
          <SkipBack size={16} fill="currentColor" />
        </button>
        <button className="sticker next-sticker" aria-label="Next track" onClick={onNext}>
          <SkipForward size={16} fill="currentColor" />
        </button>
        <button
          className="wheel-play"
          aria-label={playing ? 'Pause playback' : 'Play playback'}
          onClick={onToggle}
        >
          {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
        </button>
        <span className="wheel-stamp">AURA//PLAYER</span>
      </div>

      {/* Expanded Brutalist Panel (Lyrics removed completely!) */}
      <section className="brutal-panel" ref={panel} aria-hidden={!expanded}>
        {/* Top Header */}
        <div className="panel-top">
          <span className="panel-badge">
          {scene.label.toUpperCase()} • NOW PLAYING
          </span>
          <button aria-label="Close player panel" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Cover Art on Top */}
        <div className="panel-art-large" ref={panelArtwork}>
          {art ? (
            <img src={art} alt="Cover artwork" />
          ) : (
            <div className="panel-art-fallback">
              <Disc3 size={54} />
            </div>
          )}
        </div>

        {/* Track Title & Artist */}
        <div className="panel-titles">
          <strong>{track?.name || 'CHOOSE YOUR SOUND'}</strong>
          <span>
            {Array.isArray(track?.artists)
              ? track.artists.map(a => a?.name || '').join(' / ') || 'CONNECT SPOTIFY TO BEGIN'
              : 'CONNECT SPOTIFY TO BEGIN'}
          </span>
        </div>

        {/* Timeline */}
        <div className="panel-timeline">
          <span ref={currentTime}>0:00</span>
          <div className="panel-line">
            <i ref={progressBar} />
          </div>
          <span ref={totalTime}>0:00</span>
        </div>

        {/* Controls */}
        <div className="panel-main-controls">
          <button onClick={onPrev} aria-label="Previous">
            <SkipBack size={15} />
          </button>
          <button className="panel-play-btn" onClick={onToggle} aria-label="Play/Pause">
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button onClick={onNext} aria-label="Next">
            <SkipForward size={15} />
          </button>
          <button
            className={shuffle ? 'is-active' : ''}
            onClick={onShuffle}
            aria-label="Toggle shuffle"
          >
            <Shuffle size={14} />
          </button>
          <button
            className={`repeat-mode-btn ${repeatMode !== 'off' ? 'is-active' : ''}`}
            onClick={onRepeat}
            aria-label={`Repeat ${repeatMode === 'off' ? 'off' : repeatMode === 'context' ? 'all' : 'one'}; activate to change mode`}
            title={`Repeat ${repeatMode === 'off' ? 'off' : repeatMode === 'context' ? 'all' : 'one'}`}
          >
            {repeatMode === 'context' ? <Repeat2 size={15} /> : repeatMode === 'track' ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </button>
          <span className="repeat-mode-label" aria-live="polite">{repeatMode === 'off' ? 'REPEAT OFF' : repeatMode === 'context' ? 'REPEAT ALL' : 'REPEAT ONE'}</span>
        </div>

        {/* Volume */}
        <label className="volume-row">
          <Volume2 size={16} />
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={e => onVolume(+e.target.value)}
          />
          <output>{volume}%</output>
        </label>

        {/* Bottom Drawer Actions */}
        <div className="panel-actions">
          <button onClick={onSearch}>
            <Search size={15} /> SEARCH
          </button>
          <button onClick={onQueue}>
            <ListMusic size={15} /> UP NEXT QUEUE
          </button>
        </div>
      </section>

    </div>
  );
}

export const WheelPlayer = memo(WheelPlayerView);
export const fmt = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
