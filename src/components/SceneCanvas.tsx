import { memo, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import type { Scene } from '../scenes/scenes';
import { frameStats } from '../performance/frameStats';

gsap.registerPlugin(useGSAP);

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  spin: number;
  phase: number;
  colorIdx: number;
  shapeIdx: number;
};

const MAX_DESKTOP = 120;
const MAX_MOBILE = 50;

function FpsMeter() {
  const [metrics, setMetrics] = useState({ fps: 0, max: 0 });
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let last = performance.now();
    let frames = 0;
    let worst = 0;
    const tick = () => {
      frames++;
      worst = Math.max(worst, frameStats.canvasWorkMs);
      const now = performance.now();
      if (now - last > 500) {
        setMetrics({
          fps: Math.round((frames * 1000) / (now - last)),
          max: Math.round(worst * 10) / 10
        });
        frames = 0;
        worst = 0;
        last = now;
      }
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);
  return import.meta.env.DEV ? (
    <output className="fps-meter">
      {metrics.fps} FPS / {metrics.max} MS RENDER
    </output>
  ) : null;
}

function SceneCanvasView({ scene, playing }: { scene: Scene; playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const initializedRef = useRef(false);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  // Time scale controller for smooth freeze / unfreeze
  const timeScale = useRef({ value: playing ? 1 : 0 });
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Smoothly ease timeScale on play / pause without resetting particles
  useEffect(() => {
    gsap.to(timeScale.current, {
      value: playing && !reduced ? 1 : 0,
      duration: 0.6,
      ease: 'power2.out',
      overwrite: true
    });
  }, [playing, reduced]);

  // Main canvas engine — created ONCE and persists for the entire session
  useGSAP(
    () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const isMobile = matchMedia('(max-width: 700px)').matches;
      const count = isMobile ? MAX_MOBILE : MAX_DESKTOP;

      // Allocate particles ONCE if not already allocated
      if (!initializedRef.current || particlesRef.current.length === 0) {
        particlesRef.current = Array.from({ length: count }, (_, i) => ({
          x: Math.random(),
          y: Math.random(),
          vx: (Math.random() - 0.5) * 0.045,
          vy: 0.018 + Math.random() * 0.065,
          size: 3 + Math.random() * 8,
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.025,
          phase: Math.random() * Math.PI * 2,
          colorIdx: i % 3,
          shapeIdx: i % 3
        }));
        initializedRef.current = true;
      }

      const particles = particlesRef.current;
      let width = 0;
      let height = 0;
      let dpr = 1;
      let lightningFlash = 0;
      let nextLightningAt = performance.now() + 3000 + Math.random() * 4000;

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(performance.now(), 0);
      };

      const resetParticle = (p: Particle, top: boolean) => {
        p.x = Math.random();
        p.y = top ? -0.08 : 1.08;
        p.size = 3 + Math.random() * 8;
        p.phase = Math.random() * Math.PI * 2;
        p.colorIdx = Math.floor(Math.random() * 3);
      };

      // Scene-specific backdrop drawings
      const drawBackdrop = (currentScene: Scene, now: number) => {
        ctx.fillStyle = currentScene.colors[0];
        ctx.strokeStyle = currentScene.ink;
        ctx.lineWidth = 3;

        if (currentScene.kind === 'lightning') {
          // Thunderstorm: violent strobe flash and lightning bolt
          if (now > nextLightningAt && timeScale.current.value > 0.1) {
            lightningFlash = 1.0;
            nextLightningAt = now + 2500 + Math.random() * 4500;
          }
          if (lightningFlash > 0.02) {
            lightningFlash *= 0.88;
            ctx.fillStyle = `rgba(255, 255, 255, ${lightningFlash * 0.45})`;
            ctx.fillRect(0, 0, width, height);

            // Draw jagged lightning bolt
            if (lightningFlash > 0.4) {
              ctx.strokeStyle = '#FFE600';
              ctx.lineWidth = 4;
              ctx.beginPath();
              let lx = width * (0.3 + Math.sin(now * 0.01) * 0.3);
              let ly = 0;
              ctx.moveTo(lx, ly);
              while (ly < height * 0.7) {
                lx += (Math.random() - 0.5) * 50;
                ly += 30 + Math.random() * 40;
                ctx.lineTo(lx, ly);
              }
              ctx.stroke();
            }
          }
        } else if (currentScene.kind === 'heat') {
          // Desert Heat: rising wavy heat mirage lines and flat stylized dunes
          ctx.strokeStyle = currentScene.colors[1];
          ctx.lineWidth = 2;
          for (let row = 0; row < 4; row++) {
            const baseY = height * 0.55 + row * 35;
            ctx.beginPath();
            for (let x = 0; x <= width; x += 30) {
              const waveY = baseY + Math.sin(x * 0.02 + now * 0.002 + row) * 8;
              if (x === 0) ctx.moveTo(x, waveY);
              else ctx.lineTo(x, waveY);
            }
            ctx.stroke();
          }
          // Flat geometric dune
          ctx.fillStyle = currentScene.colors[2];
          ctx.beginPath();
          ctx.moveTo(0, height);
          ctx.lineTo(0, height * 0.85);
          ctx.quadraticCurveTo(width * 0.4, height * 0.75, width, height * 0.9);
          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (currentScene.kind === 'orbit') {
          // Deep Space: large flat geometric planet in corner + asteroid ring
          const cx = width * 0.82;
          const cy = height * 0.22;
          const pr = Math.min(width, height) * 0.14;
          ctx.fillStyle = currentScene.colors[1];
          ctx.beginPath();
          ctx.arc(cx, cy, pr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Planet ring
          ctx.lineWidth = 4;
          ctx.strokeStyle = currentScene.colors[2];
          ctx.beginPath();
          ctx.ellipse(cx, cy, pr * 1.8, pr * 0.35, -0.3, 0, Math.PI * 2);
          ctx.stroke();
        } else if (currentScene.kind === 'sun') {
          ctx.beginPath();
          ctx.arc(width * 0.78, height * 0.24, Math.min(width, height) * 0.13, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          for (let i = 0; i < 5; i++) {
            ctx.fillRect(0, height * 0.55 + i * 15, width, height * 0.012);
          }
        } else if (currentScene.kind === 'city') {
          ctx.lineWidth = 2;
          for (let x = 0; x < width; x += 55) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let i = 0; i < 9; i++) {
            const bx = (i * 137 + 40) % Math.max(width, 1);
            const bh = (i * 53 + 90) % (height * 0.4);
            ctx.fillStyle = currentScene.colors[i % 3];
            ctx.fillRect(bx, height - bh, 35, bh);
          }
        } else if (currentScene.kind === 'wave') {
          for (let row = 0; row < 6; row++) {
            const y = height * 0.62 + row * 28;
            const step = 28 + (row % 3) * 10;
            for (let x = -step; x < width + step; x += step * 2) {
              const shift = Math.sin(now * 0.0004 + row) * step;
              ctx.fillStyle = currentScene.colors[(row + 1) % 3];
              ctx.fillRect(x + shift, y, step, height - y);
            }
          }
        } else if (currentScene.kind === 'art') {
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = currentScene.colors[i % currentScene.colors.length];
            ctx.fillRect(0, height * (i / 4), width, height / 4);
          }
        }
      };

      // Optimized single-pass draw loop without nested 9x iterations or ctx.save/restore overhead
      const draw = (now: number, deltaSeconds: number) => {
        ctx.clearRect(0, 0, width, height);

        const activeScene = sceneRef.current;
        drawBackdrop(activeScene, now);

        const motionVariant = activeScene.motionVariant ?? 0;
        const ts = timeScale.current.value;
        const dt = deltaSeconds * ts;

        ctx.lineWidth = 2.5;

        // Single pass over particles: advance & draw
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // Compute motion variants
          if (dt > 0.0001) {
            if (activeScene.kind === 'snow') {
              if (motionVariant === 1) {
                // Blizzard gust: strong diagonal drift
                p.x += (p.vx * 3 + 0.04) * dt * 25;
                p.y += p.vy * dt * 32;
              } else if (motionVariant === 2) {
                // Floating slow flakes: gentle sine bobbing
                p.x += Math.sin(now * 0.001 + p.phase) * dt * 0.03;
                p.y += p.vy * dt * 8;
              } else if (motionVariant === 3) {
                // Swirling vortex
                const cx = p.x - 0.5;
                const cy = p.y - 0.5;
                p.x += -cy * dt * 0.4 + (Math.random() - 0.5) * 0.002;
                p.y += cx * dt * 0.4 + p.vy * dt * 5;
              } else {
                // Gentle fall default
                p.x += p.vx * dt * 9;
                p.y += p.vy * dt * 14;
              }
            } else if (activeScene.kind === 'rain' || activeScene.kind === 'lightning') {
              if (motionVariant === 1) {
                // Wind slant
                p.x += (p.vx - 0.06) * dt * 30;
                p.y += p.vy * dt * 35;
              } else if (motionVariant === 2) {
                // Heavy downpour
                p.x += p.vx * dt * 10;
                p.y += p.vy * dt * 45;
              } else {
                p.x += p.vx * dt * 25;
                p.y += p.vy * dt * 30;
              }
            } else if (activeScene.key === 'ember') {
              if (motionVariant === 2) {
                // Inferno spiral
                p.x += Math.sin(now * 0.002 + p.phase) * dt * 0.06;
                p.y -= p.vy * dt * 20;
              } else {
                p.x += p.vx * dt * 16;
                p.y -= p.vy * dt * 14;
              }
            } else if (activeScene.kind === 'heat') {
              // Rising shimmering heat
              p.x += Math.sin(now * 0.003 + p.phase) * dt * 0.04;
              p.y -= p.vy * dt * 10;
            } else if (activeScene.kind === 'orbit') {
              // Space orbital drift
              p.x += p.vx * dt * 6;
              p.y += p.vy * dt * 5;
            } else {
              p.x += p.vx * dt * 9;
              p.y += p.vy * dt * 8;
            }

            p.rot += p.spin * dt * 30;

            // Boundary wrapping
            const wrapTop = activeScene.key === 'ember' || activeScene.kind === 'heat';
            if (p.y > 1.1 || p.y < -0.1 || p.x > 1.1 || p.x < -0.1) {
              resetParticle(p, wrapTop);
            }
          }

          // Render particle shape
          const px = p.x * width;
          const py = p.y * height;
          const s = p.size;
          const color = activeScene.colors[(p.colorIdx + 1) % activeScene.colors.length];

          ctx.fillStyle = color;
          ctx.strokeStyle = activeScene.ink;

          if (activeScene.kind === 'rain' || activeScene.kind === 'lightning') {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px - 10, py + 26);
            ctx.stroke();
          } else if (activeScene.key === 'ember') {
            ctx.beginPath();
            ctx.moveTo(px, py - s);
            ctx.lineTo(px + s, py + s);
            ctx.lineTo(px - s, py + s);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (activeScene.kind === 'plus') {
            ctx.fillRect(px - s / 2, py - 1.5, s, 3);
            ctx.fillRect(px - 1.5, py - s / 2, 3, s);
          } else if (activeScene.kind === 'snow' && p.shapeIdx === 0) {
            ctx.beginPath();
            ctx.arc(px, py, s * 0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else if (activeScene.kind === 'petal') {
            const cos = Math.cos(p.rot);
            const sin = Math.sin(p.rot);
            const rx = s * 0.55;
            const ry = s;
            ctx.beginPath();
            for (let a = 0; a <= Math.PI * 2; a += 0.8) {
              const ex = rx * Math.cos(a);
              const ey = ry * Math.sin(a);
              const tx = px + (ex * cos - ey * sin);
              const ty = py + (ex * sin + ey * cos);
              if (a === 0) ctx.moveTo(tx, ty);
              else ctx.lineTo(tx, ty);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else {
            // Square / Diamond (fast transform without ctx.save/restore)
            const cos = Math.cos(p.rot);
            const sin = Math.sin(p.rot);
            const hs = s * 0.5;
            const x1 = px + (-hs * cos - -hs * sin);
            const y1 = py + (-hs * sin + -hs * cos);
            const x2 = px + (hs * cos - -hs * sin);
            const y2 = py + (hs * sin + -hs * cos);
            const x3 = px + (hs * cos - hs * sin);
            const y3 = py + (hs * sin + hs * cos);
            const x4 = px + (-hs * cos - hs * sin);
            const y4 = py + (-hs * sin + hs * cos);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.lineTo(x4, y4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
      };

      resize();
      window.addEventListener('resize', resize, { passive: true });

      let lastTick = performance.now();
      const tick = (time: number) => {
        const deltaSeconds = Math.min(0.05, (time - lastTick) / 1000);
        lastTick = time;

        const start = performance.now();
        draw(time, deltaSeconds);
        frameStats.canvasWorkMs = performance.now() - start;
      };

      // Tab visibility management: pause GSAP ticker when tab is hidden
      const onVisibility = () => {
        if (document.hidden) {
          gsap.ticker.remove(tick);
        } else {
          lastTick = performance.now();
          gsap.ticker.add(tick);
        }
      };

      gsap.ticker.add(tick);
      document.addEventListener('visibilitychange', onVisibility);

      return () => {
        gsap.ticker.remove(tick);
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    },
    { dependencies: [], revertOnUpdate: false } // Created ONCE for the whole session!
  );

  return (
    <>
      <div className="scene-flat" style={{ backgroundColor: scene.background }} />
      <canvas ref={canvasRef} className="scene-canvas" aria-hidden="true" />
      <FpsMeter />
    </>
  );
}

export const SceneCanvas = memo(SceneCanvasView);
