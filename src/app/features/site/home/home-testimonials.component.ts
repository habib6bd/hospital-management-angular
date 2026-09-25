import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PublicSiteService } from '../public-site.service';
import { SectionHeadingComponent } from '../ui/section-heading.component';
import { loadGsap, prefersReducedMotion, type GsapKit } from '../ui/gsap-loader';

const ROTATE_SECONDS = 7;

/** One quote at a time, crossfaded with GSAP; arrows and dots to step through. */
@Component({
  selector: 'site-home-testimonials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, IconComponent, SectionHeadingComponent, ...I18N_PIPES],
  host: { class: 'block' },
  template: `
    <section class="bg-tint py-20 lg:py-28" aria-labelledby="testimonials-heading">
      <div class="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[5fr_7fr] lg:gap-16 lg:px-8">
        <div class="relative hidden lg:block">
          <div class="overflow-hidden rounded-[2rem] shadow-lift">
            <img ngSrc="/images/about/reception.webp" width="1200" height="1400" sizes="40vw" alt="" class="aspect-[6/7] w-full object-cover" />
          </div>
          <div class="absolute -bottom-6 -right-6 flex items-center gap-3 rounded-2xl bg-surface-raised px-5 py-4 shadow-lift">
            <span class="flex text-amber-400" aria-hidden="true">
              @for (s of [1, 2, 3, 4, 5]; track s) {
                <hms-icon name="star" [size]="18" class="fill-current" />
              }
            </span>
            <span class="text-sm font-bold text-accent-950 dark:text-white">{{ '4.8' | num }} / {{ '5' | num }}</span>
          </div>
        </div>

        <div>
          <site-section-heading
            align="left"
            headingId="testimonials-heading"
            [eyebrow]="'home.testimonials.eyebrow' | t"
            [title]="'home.testimonials.title' | t"
          />

          <div
            class="relative mt-10 rounded-[2rem] bg-surface-raised p-8 shadow-soft ring-1 ring-slate-900/5 sm:p-10 dark:ring-white/10"
            aria-roledescription="carousel"
            [attr.aria-label]="'home.testimonials.title' | t"
            (mouseenter)="hold(true)"
            (mouseleave)="hold(false)"
          >
            <hms-icon name="quote" [size]="44" class="text-brand-100 dark:text-brand-900" />
            <div #quote aria-live="polite">
              @if (current(); as item) {
                <blockquote class="font-display mt-5 min-h-[7.5rem] text-lg font-medium leading-relaxed text-accent-950 sm:text-xl dark:text-white">
                  “{{ item.quote | loc }}”
                </blockquote>
                <div class="mt-8 flex items-center gap-4">
                  <span class="flex size-12 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white" aria-hidden="true">
                    {{ (item.name | loc).charAt(0) }}
                  </span>
                  <span>
                    <span class="block font-bold text-accent-950 dark:text-white">{{ item.name | loc }}</span>
                    <span class="block text-sm text-slate-500 dark:text-surface-fg-muted">{{ item.location | loc }}</span>
                  </span>
                </div>
              }
            </div>

            <div class="mt-8 flex items-center justify-between border-t border-slate-100 pt-6 dark:border-white/10">
              <div class="flex gap-2">
                @for (item of site.testimonials(); track item.id; let i = $index) {
                  <button
                    type="button"
                    class="h-2 rounded-full transition-all"
                    [class]="i === index() ? 'w-8 bg-brand-600' : 'w-2 bg-slate-300 hover:bg-slate-400 dark:bg-white/20'"
                    [attr.aria-label]="'hero.goTo' | t: { n: i + 1 }"
                    [attr.aria-current]="i === index() ? 'true' : null"
                    (click)="show(i)"
                  ></button>
                }
              </div>
              <div class="flex gap-2">
                <button type="button" class="flex size-10 items-center justify-center rounded-full ring-1 ring-slate-200 transition hover:bg-brand-600 hover:text-white hover:ring-brand-600 dark:ring-white/20" [attr.aria-label]="'hero.prev' | t" (click)="show(index() - 1)">
                  <hms-icon name="chevron-left" [size]="18" />
                </button>
                <button type="button" class="flex size-10 items-center justify-center rounded-full ring-1 ring-slate-200 transition hover:bg-brand-600 hover:text-white hover:ring-brand-600 dark:ring-white/20" [attr.aria-label]="'hero.next' | t" (click)="show(index() + 1)">
                  <hms-icon name="chevron-right" [size]="18" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class HomeTestimonialsComponent {
  protected readonly site = inject(PublicSiteService);
  protected readonly index = signal(0);
  protected readonly current = computed(() => this.site.testimonials()[this.index()]);

  private readonly quote = viewChild.required<ElementRef<HTMLElement>>('quote');
  private kit: GsapKit | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private held = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
    afterNextRender(() => {
      if (prefersReducedMotion()) {
        return;
      }
      void loadGsap().then((kit) => (this.kit = kit));
      this.timer = setInterval(() => {
        if (!this.held) {
          this.show(this.index() + 1);
        }
      }, ROTATE_SECONDS * 1000);
    });
  }

  protected hold(value: boolean): void {
    this.held = value;
  }

  protected show(target: number): void {
    const count = this.site.testimonials().length;
    if (count === 0) {
      return;
    }
    const next = (target + count) % count;
    if (this.kit === null) {
      this.index.set(next);
      return;
    }
    const { gsap } = this.kit;
    const el = this.quote().nativeElement;
    gsap.to(el, {
      autoAlpha: 0,
      x: -16,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        this.index.set(next);
        gsap.fromTo(el, { autoAlpha: 0, x: 16 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: 'power2.out' });
      },
    });
  }
}
