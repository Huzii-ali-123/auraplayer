import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import type { Scene } from '../scenes/scenes';

type Props = { scene: Scene; onSwap: (scene: Scene) => void };

export function WipeTransition({ scene, onSwap }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const swapRef = useRef(onSwap);
  swapRef.current = onSwap;

  useGSAP(() => {
    if (first.current) {
      first.current = false;
      swapRef.current(scene);
      return;
    }

    const element = layer.current;
    if (!element) return;
    const timeline = gsap.timeline();
    timeline
      .set(element, {
        transformOrigin: 'left center',
        scaleX: 0,
        backgroundColor: scene.palette?.bg || scene.background
      })
      .to(element, { scaleX: 1, duration: 0.34, ease: 'power4.in' })
      .call(() => swapRef.current(scene))
      // Hold the flat wipe over the text while all palette variables tween together.
      .to({}, { duration: 0.8 })
      .set(element, { transformOrigin: 'right center' })
      .to(element, { scaleX: 0, duration: 0.34, ease: 'power4.out' });

    return () => timeline.kill();
  }, { dependencies: [scene.key, scene.revision, scene.background], revertOnUpdate: true });

  return <div ref={layer} className="scene-wipe" aria-hidden="true" />;
}
