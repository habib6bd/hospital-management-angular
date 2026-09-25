import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';
import { loadGsap, prefersReducedMotion } from './gsap-loader';

/**
 * Fades content up as it scrolls into view.
 *
 *   <ul siteReveal="li">…</ul>   staggers each matching child
 *   <section siteReveal>…</section>   animates the element itself
 *
 * The content is fully visible in the server-rendered HTML and without
 * JavaScript; the hidden state is applied in the browser only, by the tween
 * itself. Reduced-motion users get no animation at all.
 */
@Directive({ selector: '[siteReveal]' })
export class RevealDirective {
  /** CSS selector for children to stagger; empty animates the host. */
  readonly siteReveal = input('');
  readonly revealDelay = input(0);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let dispose: (() => void) | null = null;
    let destroyed = false;

    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      dispose?.();
    });

    afterNextRender(() => {
      if (prefersReducedMotion()) {
        return;
      }
      void loadGsap().then(({ gsap }) => {
        if (destroyed) {
          return;
        }
        const selector = this.siteReveal();
        const targets = selector === '' ? [host] : Array.from(host.querySelectorAll<HTMLElement>(selector));
        if (targets.length === 0) {
          return;
        }
        const tween = gsap.from(targets, {
          y: 28,
          autoAlpha: 0,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.09,
          delay: this.revealDelay(),
          clearProps: 'transform,opacity,visibility',
          scrollTrigger: { trigger: host, start: 'top 88%', once: true },
        });
        dispose = () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });
    });
  }
}
