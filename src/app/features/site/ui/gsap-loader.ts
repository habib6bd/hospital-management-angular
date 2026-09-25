import type { gsap as Gsap } from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';

export interface GsapKit {
  readonly gsap: typeof Gsap;
  readonly ScrollTrigger: typeof ScrollTriggerType;
}

let kit: Promise<GsapKit> | null = null;

/**
 * GSAP is loaded on demand, from the browser only. Keeping it behind a dynamic
 * import keeps it out of the initial bundle and away from SSR, where there is
 * nothing to animate.
 */
export function loadGsap(): Promise<GsapKit> {
  kit ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([core, scroll]) => {
    core.gsap.registerPlugin(scroll.ScrollTrigger);
    return { gsap: core.gsap, ScrollTrigger: scroll.ScrollTrigger };
  });
  return kit;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
