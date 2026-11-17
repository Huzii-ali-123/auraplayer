import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { Scene } from '../scenes/scenes';

type Props = { scene: Scene; onSwap: (scene: Scene) => void };

const TEETH = Array.from({ length: 24 }, (_, index) => index);

export function WipeTransition({ scene, onSwap }: Props) {
  const reveal = useRef<HTMLDivElement>(null);
  const zipper = useRef<HTMLDivElement>(null);
  const transition = useRef<gsap.core.Timeline | null>(null);
  const previousSignature = useRef('');
  const swapRef = useRef(onSwap);
  swapRef.current = onSwap;
  const signature = `${scene.key}:${scene.revision || ''}:${scene.background}:${scene.palette?.accent || scene.colors[2] || ''}`;

  useEffect(() => {
    if (!previousSignature.current) {
      previousSignature.current = signature;
      if (reveal.current) gsap.set(reveal.current, { scaleX: 0, opacity: 1, transformOrigin: 'left center' });
      if (zipper.current) {
        const width = zipper.current.offsetWidth;
        const tab = zipper.current.querySelector<HTMLElement>('.scene-zip-tab');
        const visualRight = Math.max(width, (tab?.offsetLeft || 0) + (tab?.offsetWidth || 0));
        gsap.set(zipper.current, { xPercent: 0, x: -visualRight - 24 });
      }
      swapRef.current(scene);
      return;
    }
    if (previousSignature.current === signature) return;
    previousSignature.current = signature;

    const revealElement = reveal.current;
    const zipperElement = zipper.current;
    if (!revealElement || !zipperElement) return;

    // If a new track arrives mid-sweep, continue from the current reveal point
    // instead of snapping the old animation back to its starting position.
    let progress = Number(gsap.getProperty(revealElement, 'scaleX')) || 0;
    const width = zipperElement.offsetWidth;
    const tab = zipperElement.querySelector<HTMLElement>('.scene-zip-tab');
    const visualRight = Math.max(width, (tab?.offsetLeft || 0) + (tab?.offsetWidth || 0));
    const hiddenX = -visualRight - 24;
    if (progress >= 0.995) {
      progress = 0;
      gsap.set(revealElement, { scaleX: 0, opacity: 1 });
      gsap.set(zipperElement, { xPercent: 0, x: hiddenX });
    }

    transition.current?.kill();
    const timeline = gsap.timeline();
    transition.current = timeline;

    gsap.set(revealElement, {
      transformOrigin: 'left center',
      scaleX: progress,
      opacity: 1
    });
    gsap.set(zipperElement, { xPercent: 0 });
    const sweepDuration = 1.75 * Math.max(0.28, 1 - progress);
    timeline.to(revealElement, {
      scaleX: 1,
      backgroundColor: scene.background,
      duration: sweepDuration,
      ease: 'power1.inOut'
    }, 0);
    timeline.to(zipperElement, {
      x: window.innerWidth + visualRight + 24,
      duration: sweepDuration,
      ease: 'power1.inOut'
    }, 0);
    timeline.call(() => {
      // Update particles and the remaining palette while the new background
      // covers the page, then fade the reveal to uncover the completed scene.
      swapRef.current(scene);
    }, [], sweepDuration);
    timeline.to(revealElement, { opacity: 0, duration: 0.28, ease: 'power1.out' }, sweepDuration + 0.12);
    timeline.set(revealElement, { scaleX: 0, opacity: 1 }, sweepDuration + 0.4);
    timeline.set(zipperElement, { x: hiddenX }, sweepDuration + 0.4);

    return () => {
      timeline.kill();
      if (transition.current === timeline) transition.current = null;
    };
  }, [signature]);

  return (
    <>
      <div ref={reveal} className="scene-reveal" aria-hidden="true" />
      <div ref={zipper} className="scene-zipper" aria-hidden="true">
        <div className="scene-zip-teeth">
          {TEETH.map(index => <i key={index} />)}
        </div>
        <div className="scene-zip-tab">
          <span>SCENE SHIFT / ZIP</span>
          <strong>{scene.label.toUpperCase()}</strong>
        </div>
      </div>
    </>
  );
}
