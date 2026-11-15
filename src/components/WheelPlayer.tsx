import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  Activity,
  Disc3,
  HelpCircle,
  ListMusic,
  Pause,
  Play,
  Radio,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  X
} from 'lucide-react';
import type { Track } from '../spotify/api';
import type { Scene } from '../scenes/scenes';
import { hashTrackId } from '../scenes/scenes';
import { parseLrc, sampleLyricEnergy } from '../lyrics/client';
import type { LyricLine, LyricsRecord } from '../lyrics/client';

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
  expanded: boolean;
  lyrics: LyricsRecord | null;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (fraction: number) => void;
  onVolume: (volume: number) => void;
  onShuffle: () => void;
  onSearch: () => void;
  onQueue: () => void;
  onExpand: () => void;
  onClose: () => void;
  onNotice: (message: string) => void;
};

const VISUALIZER_STYLES = [
  'RADIAL BARS',
  'SPIKE RING',
  'CONCENTRIC RINGS',
  'DOTTED ORBIT',
  'ZIGZAG WAVE'
] as const;

function WheelPlayerView({
  track,
  scene,
  playing,
  progressRef,
  volume,
  shuffle,
  expanded,
  lyrics,
  onToggle,
  onNext,
  onPrev,
  onSeek,
  onVolume,
  onShuffle,
  onSearch,
  onQueue,
  onExpand,
  onClose,
  onNotice
}: Props) {
  const ring = useRef<SVGCircleElement>(null);
  const handle = useRef<SVGGElement>(null);
  const ticks = useRef<SVGGElement>(null);
  const disc = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const ringTween = useRef<gsap.core.Tween | null>(null);
  const discTween = useRef<gsap.core.Tween | null>(null);
  const panelTimeline = useRef<gsap.core.Timeline | null>(null);
  const currentTime = useRef<HTMLSpanElement>(null);
  const totalTime = useRef<HTMLSpanElement>(null);
  const progressBar = useRef<HTMLElement>(null);
  const waveCanvas = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);

  // Sound wave mode: 'procedural' (Mode A) or 'live' (Mode B)
  const [waveMode, setWaveMode] = useState<'procedural' | 'live'>('procedural');
  const [showLivePrompt, setShowLivePrompt] = useState(false);
  const waveAmp = useRef({ value: playing ? 1.0 : 0.08, burst: 1.0 });
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const radius = 76;
  const circumference = 2 * Math.PI * radius;

  // Synced lyrics parsed for energy extraction
  const synced = lyrics?.syncedLyrics || '';
  const syncedEntries: LyricLine[] = useMemo(() => (synced ? parseLrc(synced) : []), [synced]);

  // Visualizer style choice: 5 distinct styles chosen deterministically from track ID
  const styleIdx = useMemo(() => {
    return track?.id ? hashTrackId(track.id) % 5 : 0;
  }, [track?.id]);
  const styleName = VISUALIZER_STYLES[styleIdx];

  // Trigger visualizer burst on track change or seek
  useEffect(() => {
    waveAmp.current.burst = 2.0;
    gsap.to(waveAmp.current, { burst: 1.0, duration: 1.2, ease: 'power2.out', overwrite: true });
  }, [track?.id]);

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

    gsap.to(waveAmp.current, {
      value: playing ? 1.0 : 0.08,
      duration: 0.8,
      ease: 'power2.out',
      overwrite: true
    });
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
    if (expanded) panelTimeline.current?.play();
    else panelTimeline.current?.reverse();
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

  // Requirement 3: Smart Visualizer that changes with music (Song data, chorus, WPS, 5 visual styles)
  useGSAP(
    () => {
      const canvas = waveCanvas.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = 260;
      canvas.width = size;
      canvas.height = size;
      const cx = size / 2;
      const cy = size / 2;
      const innerRadius = 101;

      let freqData: Uint8Array | null = null;
      if (analyserRef.current) {
        freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
      }

      // Seed factors from track ID
      const seed = track?.id ? hashTrackId(track.id) : 42;
      const f1 = 2 + (seed % 5);
      const f2 = 5 + ((seed >> 3) % 7);

      const renderWave = (now: number) => {
        ctx.clearRect(0, 0, size, size);

        const p = progressRef.current;
        const elapsed = p.playing ? Math.max(0, performance.now() - p.updatedAt) : 0;
        const position = Math.min(p.duration, p.position + elapsed);

        // a & b) Lyric energy, line pulse & chorus boost
        let lyricIntensity = 1.0;
        let isChorus = false;
        let isLineStart = false;

        if (syncedEntries.length > 0) {
          const energy = sampleLyricEnergy(syncedEntries, position);
          lyricIntensity = energy.intensity;
          isChorus = energy.isChorus;
          isLineStart = energy.isLineStart;
        }

        // c) Track position intro / outro envelope
        const duration = Math.max(1, p.duration);
        const progressRatio = position / duration;
        let envelope = 1.0;
        if (progressRatio < 0.05) {
          envelope = 0.35 + (progressRatio / 0.05) * 0.65; // gentle intro ramp
        } else if (progressRatio > 0.94) {
          envelope = Math.max(0.2, 1.0 - ((progressRatio - 0.94) / 0.06) * 0.8); // outro fade
        }

        // Combined dynamic energy
        const baseAmp = waveAmp.current.value * waveAmp.current.burst;
        const totalAmp = baseAmp * lyricIntensity * envelope * (isLineStart ? 1.4 : 1.0);

        const color = isChorus ? scene.colors[2] || '#FF4FA1' : scene.colors[1] || '#FFE600';

        // Mode B Live Sync
        if (waveMode === 'live' && analyserRef.current) {
          if (!freqData) freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(freqData);
        }

        // Draw depending on deterministic visual style
        if (styleIdx === 0) {
          // Style 0: RADIAL BARS (64 bars)
          const barCount = 64;
          for (let i = 0; i < barCount; i++) {
            const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
            let barHeight = 3;

            if (waveMode === 'live' && freqData && freqData.length > 0) {
              const binIdx = Math.floor((i / barCount) * Math.min(freqData.length, 48));
              barHeight = 2 + ((freqData[binIdx] || 0) / 255) * 26;
            } else {
              const waveA = Math.sin(angle * f1 + now * 0.003) * 0.55;
              const waveB = Math.cos(angle * f2 - now * 0.004) * 0.35;
              const waveC = Math.sin(angle * 12 + now * 0.008) * 0.15;
              barHeight = 2 + Math.max(0, 0.5 + waveA + waveB + waveC) * 22 * totalAmp;
            }

            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const x1 = cx + cos * innerRadius;
            const y1 = cy + sin * innerRadius;
            const x2 = cx + cos * (innerRadius + barHeight);
            const y2 = cy + sin * (innerRadius + barHeight);

            ctx.strokeStyle = '#111';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        } else if (styleIdx === 1) {
          // Style 1: SPIKE RING (44 sharp triangular spikes)
          const spikeCount = 44;
          for (let i = 0; i < spikeCount; i++) {
            const angle = (i / spikeCount) * Math.PI * 2 - Math.PI / 2;
            const nextAngle = ((i + 1) / spikeCount) * Math.PI * 2 - Math.PI / 2;
            const midAngle = (angle + nextAngle) / 2;

            const noise = Math.sin(angle * f1 + now * 0.003) * 0.5 + Math.cos(angle * 7 - now * 0.005) * 0.5;
            const spikeH = 3 + Math.max(0, 0.4 + noise) * 20 * totalAmp;

            const xBase1 = cx + Math.cos(angle) * innerRadius;
            const yBase1 = cy + Math.sin(angle) * innerRadius;
            const xTip = cx + Math.cos(midAngle) * (innerRadius + spikeH);
            const yTip = cy + Math.sin(midAngle) * (innerRadius + spikeH);
            const xBase2 = cx + Math.cos(nextAngle) * innerRadius;
            const yBase2 = cy + Math.sin(nextAngle) * innerRadius;

            ctx.fillStyle = color;
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(xBase1, yBase1);
            ctx.lineTo(xTip, yTip);
            ctx.lineTo(xBase2, yBase2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        } else if (styleIdx === 2) {
          // Style 2: CONCENTRIC RINGS (3 pulsed brutalist rings)
          for (let ringIdx = 0; ringIdx < 3; ringIdx++) {
            const pulse = (Math.sin(now * 0.003 + ringIdx * 1.5) * 0.5 + 0.5) * totalAmp;
            const ringR = innerRadius + 4 + ringIdx * 7 + pulse * 6;

            ctx.strokeStyle = '#111';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = ringIdx === 0 ? color : scene.colors[0];
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (styleIdx === 3) {
          // Style 3: DOTTED ORBIT (36 square studs)
          const dotCount = 36;
          for (let i = 0; i < dotCount; i++) {
            const angle = (i / dotCount) * Math.PI * 2 + now * 0.0006 * (f1 % 2 === 0 ? 1 : -1);
            const offset = (Math.sin(angle * 4 + now * 0.004) * 0.5 + 0.5) * 16 * totalAmp;
            const r = innerRadius + 6 + offset;

            const px = cx + Math.cos(angle) * r;
            const py = cy + Math.sin(angle) * r;
            const s = 6;

            ctx.fillStyle = color;
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 2;
            ctx.fillRect(px - s / 2, py - s / 2, s, s);
            ctx.strokeRect(px - s / 2, py - s / 2, s, s);
          }
        } else {
          // Style 4: ZIGZAG WAVE (Continuous jagged polygonal polygon)
          const points = 48;
          ctx.beginPath();
          for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
            const zag = (i % 2 === 0 ? 1 : -0.5);
            const noise = (Math.sin(angle * f2 + now * 0.005) * 0.5 + 0.5) * totalAmp;
            const r = innerRadius + 4 + zag * 7 + noise * 12;

            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 5;
          ctx.stroke();

          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      };

      const tick = (time: number) => renderWave(time);
      gsap.ticker.add(tick);

      const onVis = () => {
        if (document.hidden) gsap.ticker.remove(tick);
        else gsap.ticker.add(tick);
      };
      document.addEventListener('visibilitychange', onVis);

      return () => {
        gsap.ticker.remove(tick);
        document.removeEventListener('visibilitychange', onVis);
      };
    },
    { dependencies: [waveMode, scene.key, track?.id, styleIdx, syncedEntries], revertOnUpdate: true }
  );

  // Requirement 4: Explicit Live Sync pre-dialog instructions & precise error handling
  const handleLiveSyncClick = () => {
    if (waveMode === 'live') {
      stopLiveSync();
      setWaveMode('procedural');
      onNotice('Reverted to song-reactive WAVE visualizer.');
      return;
    }
    // Show instruction prompt before opening browser picker
    setShowLivePrompt(true);
  };

  const proceedLiveSync = async () => {
    setShowLivePrompt(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      onNotice('Tab audio capture is not supported in this browser. Staying on procedural WAVE.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Discard video track immediately
      stream.getVideoTracks().forEach(t => t.stop());

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        stream.getTracks().forEach(t => t.stop());
        onNotice('No audio track shared. Did you tick "Share tab audio" in the Chrome dialog?');
        setWaveMode('procedural');
        return;
      }

      mediaStreamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      setWaveMode('live');
      onNotice('LIVE SYNC active! Visualizer capturing tab audio.');

      // Silence detection: if average volume < 2 for 2.2 seconds, fallback to Mode A
      let silentTicks = 0;
      const checkBuffer = new Uint8Array(analyser.frequencyBinCount);
      const silenceInterval = window.setInterval(() => {
        analyser.getByteFrequencyData(checkBuffer);
        const sum = checkBuffer.reduce((acc, val) => acc + val, 0);
        const avg = sum / checkBuffer.length;
        if (avg < 2) {
          silentTicks++;
          if (silentTicks >= 4) {
            window.clearInterval(silenceInterval);
            stopLiveSync();
            setWaveMode('procedural');
            onNotice(
              'Browser audio is silent or DRM-protected by Spotify. Falling back to song-reactive WAVE.'
            );
          }
        } else {
          silentTicks = 0;
        }
      }, 550);

      audioTracks[0].onended = () => {
        window.clearInterval(silenceInterval);
        stopLiveSync();
        setWaveMode('procedural');
      };
    } catch (err: any) {
      stopLiveSync();
      setWaveMode('procedural');
      if (err.name === 'NotAllowedError') {
        onNotice('Tab share was cancelled by user. Staying on procedural WAVE.');
      } else {
        onNotice(`Live audio capture failed (${err.name || 'Unknown'}). Reverted to procedural WAVE.`);
      }
    }
  };

  const stopLiveSync = () => {
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
  };

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
      {/* Requirement 3: Radiating 64-bar circular wave visualizer */}
      <canvas ref={waveCanvas} className="wheel-wave-canvas" aria-hidden="true" />

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
            {scene.label.toUpperCase()} • {styleName}
          </span>
          <button aria-label="Close player panel" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Cover Art on Top */}
        <div className="panel-art-large">
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
            className={`wave-mode-btn ${waveMode === 'live' ? 'is-live' : ''}`}
            onClick={handleLiveSyncClick}
            title={waveMode === 'live' ? 'Revert to procedural wave' : 'Experimental live tab audio sync'}
          >
            {waveMode === 'live' ? <Radio size={13} /> : <Activity size={13} />}
            {waveMode === 'live' ? 'LIVE SYNC' : styleName}
          </button>
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

      {/* Requirement 4: Live Sync Pre-Prompt Instructions Modal */}
      {showLivePrompt && (
        <div className="live-prompt-overlay" role="dialog" aria-modal="true">
          <div className="live-prompt-card">
            <div className="live-prompt-header">
              <span className="live-prompt-sticker">EXPERIMENTAL // AUDIO SYNC</span>
              <button onClick={() => setShowLivePrompt(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <h3>SHARE TAB AUDIO</h3>
            <p>To synchronize the visualizer with your live browser tab sound:</p>
            <ol className="live-steps-list">
              <li>
                In the browser popup, click <strong>"Chrome Tab"</strong>.
              </li>
              <li>
                Choose <strong>THIS TAB</strong> (Aura Player).
              </li>
              <li>
                Check the box: <strong>"Share tab audio"</strong>.
              </li>
            </ol>
            <small>
              <HelpCircle size={12} /> Video is immediately discarded. If Spotify's DRM blocks tab audio, the player will automatically revert to procedural WAVE.
            </small>
            <div className="live-prompt-actions">
              <button className="live-cancel-btn" onClick={() => setShowLivePrompt(false)}>
                CANCEL
              </button>
              <button className="live-confirm-btn" onClick={proceedLiveSync}>
                CONTINUE TO PROMPT ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const WheelPlayer = memo(WheelPlayerView);
export const fmt = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
