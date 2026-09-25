import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SITE_CONFIG } from '../../../core/config/site-config';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import type { TranslationKey } from '../../../core/i18n/dictionaries/en';
import { IconComponent, type IconName } from '../../../shared/ui/icon/icon.component';
import { SiteButtonDirective } from '../ui/site-button.directive';
import { loadGsap, prefersReducedMotion, type GsapKit } from '../ui/gsap-loader';

interface SlideAction {
  readonly label: TranslationKey;
  readonly icon: IconName;
  readonly link?: string;
  readonly href?: string;
}

interface Slide {
  readonly image: string;
  /** Mirrors the photo so its subject sits on the right, clear of the text. */
  readonly mirror: boolean;
  readonly eyebrow: TranslationKey;
  readonly title: TranslationKey;
  readonly lead: TranslationKey;
  readonly primary: SlideAction;
  readonly secondary: SlideAction;
}

const SLIDE_SECONDS = 6.5;
const SWIPE_THRESHOLD_PX = 50;

const SLIDES: readonly Slide[] = [
  {
    image: '/images/hero/slide-1.webp',
    mirror: true,
    eyebrow: 'hero.s1.eyebrow',
    title: 'hero.s1.title',
    lead: 'hero.s1.lead',
    primary: { label: 'cta.bookAppointment', icon: 'calendar', link: '/book' },
    secondary: { label: 'home.quick.find', icon: 'stethoscope', link: '/doctors' },
  },
  {
    image: '/images/hero/slide-2.webp',
    mirror: false,
    eyebrow: 'hero.s2.eyebrow',
    title: 'hero.s2.title',
    lead: 'hero.s2.lead',
    primary: { label: 'top.callEmergency', icon: 'phone', href: `tel:${SITE_CONFIG.emergency}` },
    secondary: { label: 'nav.services', icon: 'arrow-right', link: '/services' },
  },
  {
    image: '/images/hero/slide-3.webp',
    mirror: false,
    eyebrow: 'hero.s3.eyebrow',
    title: 'hero.s3.title',
    lead: 'hero.s3.lead',
    primary: { label: 'nav.reports', icon: 'download', link: '/patient/reports' },
    secondary: { label: 'footer.packages', icon: 'clipboard-check', link: '/services/health-checkup' },
  },
];

/**
 * Home-page hero carousel.
 *
 * The first slide is fully rendered on the server, so the page is complete
 * before any script runs. GSAP (loaded lazily) then drives the crossfade, a
 * slow Ken Burns zoom and the staggered text entrance. Autoplay pauses on
 * hover and keyboard focus, has a visible pause control (WCAG 2.2.2), and is
 * off entirely for reduced-motion users.
 */
@Component({
  selector: 'site-hero-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RouterLink, IconComponent, SiteButtonDirective, ...I18N_PIPES],
  host: { class: 'block' },
  template: `
    <section
      class="relative isolate h-[36rem] overflow-hidden bg-brand-950 sm:h-[38rem] lg:h-[44rem]"
      aria-roledescription="carousel"
      [attr.aria-label]="'hero.label' | t"
      (mouseenter)="hover(true)"
      (mouseleave)="hover(false)"
      (focusin)="hover(true)"
      (focusout)="hover(false)"
      (pointerdown)="swipeStart($event)"
      (pointerup)="swipeEnd($event)"
    >
      @for (slide of slides; track slide.image; let i = $index) {
        <div
          #slideEl
          class="absolute inset-0"
          [class.invisible]="i !== 0"
          [class.opacity-0]="i !== 0"
          role="group"
          aria-roledescription="slide"
          [attr.aria-label]="'hero.slideOf' | t: { n: i + 1, total: slides.length }"
          [attr.aria-hidden]="active() !== i"
          [attr.inert]="active() !== i ? '' : null"
        >
          <div class="hero-media absolute inset-0 will-change-transform">
            <img
              [ngSrc]="slide.image"
              fill
              sizes="100vw"
              [priority]="i === 0"
              alt=""
              class="object-cover object-center"
              [class.-scale-x-100]="slide.mirror"
            />
          </div>
          <!-- Light wash on the text side keeps the copy readable on any photo. -->
          <div class="absolute inset-0 bg-linear-to-r from-white/95 from-0% via-white/85 via-45% to-white/20 to-100% lg:from-white lg:from-15% lg:via-white/70 lg:via-40% lg:to-transparent lg:to-65% dark:from-accent-950 dark:via-accent-950/80"></div>
          <div class="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-white/60 to-transparent dark:from-accent-950/60"></div>

          <div class="relative mx-auto flex h-full max-w-7xl items-center px-4 pb-16 sm:px-6 lg:px-8">
            <div class="max-w-xl">
              <p class="hero-anim inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-100 dark:bg-brand-950 dark:text-brand-300 dark:ring-brand-900">
                <span class="size-1.5 rounded-full bg-brand-500"></span>
                {{ slide.eyebrow | t: { year: config.established } }}
              </p>
              @if (i === 0) {
                <h1 class="hero-anim font-display mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-accent-950 sm:text-5xl lg:text-6xl dark:text-white">
                  {{ slide.title | t }}
                </h1>
              } @else {
                <p class="hero-anim font-display mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-accent-950 sm:text-5xl lg:text-6xl dark:text-white">
                  {{ slide.title | t }}
                </p>
              }
              <p class="hero-anim mt-5 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg dark:text-white/75">
                {{ slide.lead | t }}
              </p>
              <div class="hero-anim mt-8 flex flex-wrap gap-3">
                @if (slide.primary.link) {
                  <a [routerLink]="slide.primary.link" siteBtn size="lg">
                    <hms-icon [name]="slide.primary.icon" [size]="18" />
                    {{ slide.primary.label | t }}
                  </a>
                } @else {
                  <a [href]="slide.primary.href" siteBtn="emergency" size="lg">
                    <hms-icon [name]="slide.primary.icon" [size]="18" />
                    {{ slide.primary.label | t }}
                  </a>
                }
                <a [routerLink]="slide.secondary.link" siteBtn="outline" size="lg">
                  {{ slide.secondary.label | t }}
                  <hms-icon [name]="slide.secondary.icon" [size]="18" />
                </a>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Controls -->
      <div class="absolute inset-x-0 bottom-20 z-10 sm:bottom-24">
        <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div class="flex items-center gap-2">
            @for (slide of slides; track slide.image; let i = $index) {
              <button
                type="button"
                class="group relative h-1.5 w-10 overflow-hidden rounded-full bg-accent-900/15 sm:w-14 dark:bg-white/20"
                [attr.aria-label]="'hero.goTo' | t: { n: i + 1 }"
                [attr.aria-current]="active() === i ? 'true' : null"
                (click)="goTo(i)"
              >
                <span
                  #progressEl
                  class="absolute inset-0 origin-left rounded-full bg-brand-600"
                  [style.transform]="active() === i ? 'scaleX(1)' : 'scaleX(0)'"
                ></span>
              </button>
            }
            <button
              type="button"
              class="ml-2 flex size-8 items-center justify-center rounded-full text-accent-900/70 hover:bg-accent-900/5 hover:text-accent-900 dark:text-white/70"
              [attr.aria-label]="(paused() ? 'hero.play' : 'hero.pause') | t"
              (click)="togglePause()"
            >
              @if (paused()) {
                <svg class="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>
              } @else {
                <svg class="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
              }
            </button>
          </div>
          <div class="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              class="flex size-11 items-center justify-center rounded-full bg-white/90 text-accent-900 shadow-soft ring-1 ring-black/5 backdrop-blur transition hover:bg-white hover:text-brand-700"
              [attr.aria-label]="'hero.prev' | t"
              (click)="step(-1)"
            >
              <hms-icon name="chevron-left" [size]="20" />
            </button>
            <button
              type="button"
              class="flex size-11 items-center justify-center rounded-full bg-white/90 text-accent-900 shadow-soft ring-1 ring-black/5 backdrop-blur transition hover:bg-white hover:text-brand-700"
              [attr.aria-label]="'hero.next' | t"
              (click)="step(1)"
            >
              <hms-icon name="chevron-right" [size]="20" />
            </button>
          </div>
        </div>
      </div>

      <p class="sr-only-focusable" aria-live="polite" aria-atomic="true">
        @if (paused()) {
          {{ 'hero.slideOf' | t: { n: active() + 1, total: slides.length } }}
        }
      </p>
    </section>
  `,
})
export class HeroSliderComponent {
  protected readonly config = SITE_CONFIG;
  protected readonly slides = SLIDES;
  protected readonly active = signal(0);
  /** User-requested pause (the button); hover/focus pauses are separate. */
  protected readonly paused = signal(false);

  private readonly slideEls = viewChildren<ElementRef<HTMLElement>>('slideEl');
  private readonly progressEls = viewChildren<ElementRef<HTMLElement>>('progressEl');

  private kit: GsapKit | null = null;
  private reducedMotion = false;
  private hovering = false;
  private progressTween: ReturnType<GsapKit['gsap']['to']> | null = null;
  private zoomTween: ReturnType<GsapKit['gsap']['to']> | null = null;
  private swipeX: number | null = null;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.progressTween?.kill();
      this.zoomTween?.kill();
    });

    afterNextRender(() => {
      this.reducedMotion = prefersReducedMotion();
      if (this.reducedMotion) {
        // No autoplay and no motion: the controls still switch slides.
        this.paused.set(true);
        return;
      }
      void loadGsap().then((kit) => {
        if (this.destroyed) {
          return;
        }
        this.kit = kit;
        this.startTimers(0);
      });
    });
  }

  protected goTo(index: number): void {
    const from = this.active();
    const to = (index + this.slides.length) % this.slides.length;
    if (to === from) {
      return;
    }
    this.active.set(to);
    this.transition(from, to);
  }

  protected step(delta: number): void {
    this.goTo(this.active() + delta);
  }

  protected togglePause(): void {
    this.paused.update((value) => !value);
    this.syncPlayback();
  }

  protected hover(value: boolean): void {
    this.hovering = value;
    this.syncPlayback();
  }

  protected swipeStart(event: PointerEvent): void {
    this.swipeX = event.pointerType === 'mouse' ? null : event.clientX;
  }

  protected swipeEnd(event: PointerEvent): void {
    if (this.swipeX === null) {
      return;
    }
    const delta = event.clientX - this.swipeX;
    this.swipeX = null;
    if (Math.abs(delta) > SWIPE_THRESHOLD_PX) {
      this.step(delta < 0 ? 1 : -1);
    }
  }

  private transition(from: number, to: number): void {
    const outgoing = this.slideEls()[from]?.nativeElement;
    const incoming = this.slideEls()[to]?.nativeElement;
    if (outgoing === undefined || incoming === undefined) {
      return;
    }

    if (this.kit === null) {
      // Reduced motion (or GSAP not loaded yet): switch instantly.
      outgoing.style.visibility = 'hidden';
      outgoing.style.opacity = '0';
      incoming.style.visibility = 'visible';
      incoming.style.opacity = '1';
      return;
    }

    const { gsap } = this.kit;
    gsap.to(outgoing, { autoAlpha: 0, duration: 0.9, ease: 'power2.inOut' });
    gsap.fromTo(incoming, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, ease: 'power2.inOut' });
    gsap.fromTo(
      incoming.querySelectorAll('.hero-anim'),
      { y: 32, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out', stagger: 0.1, delay: 0.25 },
    );
    this.startTimers(to);
  }

  /** Ken Burns zoom on the active photo, plus the progress bar that drives autoplay. */
  private startTimers(index: number): void {
    if (this.kit === null) {
      return;
    }
    const { gsap } = this.kit;
    this.progressTween?.kill();
    this.zoomTween?.kill();

    const media = this.slideEls()[index]?.nativeElement.querySelector('.hero-media');
    if (media !== null && media !== undefined) {
      this.zoomTween = gsap.fromTo(media, { scale: 1.1 }, { scale: 1, duration: SLIDE_SECONDS + 1.5, ease: 'none' });
    }

    const bar = this.progressEls()[index]?.nativeElement;
    if (bar !== undefined) {
      this.progressEls().forEach((el, i) => i !== index && gsap.set(el.nativeElement, { scaleX: 0 }));
      this.progressTween = gsap.fromTo(
        bar,
        { scaleX: 0 },
        { scaleX: 1, duration: SLIDE_SECONDS, ease: 'none', onComplete: () => this.step(1) },
      );
    }
    this.syncPlayback();
  }

  private syncPlayback(): void {
    const hold = this.paused() || this.hovering;
    if (hold) {
      this.progressTween?.pause();
      this.zoomTween?.pause();
    } else {
      this.progressTween?.resume();
      this.zoomTween?.resume();
    }
  }
}
