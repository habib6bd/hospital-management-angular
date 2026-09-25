import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SITE_CONFIG } from '../../../core/config/site-config';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { TranslationKey } from '../../../core/i18n/dictionaries/en';
import { SeoService } from '../../../core/seo/seo.service';
import { IconComponent, type IconName } from '../../../shared/ui/icon/icon.component';
import { PublicSiteService } from '../public-site.service';
import { DepartmentCardComponent } from '../ui/department-card.component';
import { DoctorCardComponent } from '../ui/doctor-card.component';
import { RevealDirective } from '../ui/reveal.directive';
import { SectionHeadingComponent } from '../ui/section-heading.component';
import { SiteButtonDirective } from '../ui/site-button.directive';
import { HeroSliderComponent } from './hero-slider.component';
import { HomePackagesComponent } from './home-packages.component';
import { HomeTestimonialsComponent } from './home-testimonials.component';

interface QuickAction {
  readonly icon: IconName;
  readonly title: TranslationKey;
  readonly text: TranslationKey;
  readonly link?: string;
  readonly href?: string;
}

@Component({
  selector: 'site-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgOptimizedImage,
    RouterLink,
    IconComponent,
    DepartmentCardComponent,
    DoctorCardComponent,
    RevealDirective,
    SectionHeadingComponent,
    SiteButtonDirective,
    HeroSliderComponent,
    HomePackagesComponent,
    HomeTestimonialsComponent,
    ...I18N_PIPES,
  ],
  template: `
    <site-hero-slider />

    <!-- ============================================ search + quick actions -->
    <section class="relative z-10 -mt-16 px-4 sm:px-6 lg:px-8" [attr.aria-label]="'home.quick.label' | t">
      <div class="mx-auto max-w-6xl rounded-[2rem] bg-surface-raised p-3 shadow-lift ring-1 ring-slate-900/5 sm:p-4 dark:ring-white/10">
        <form role="search" class="grid gap-2 rounded-3xl bg-tint p-2 sm:grid-cols-[1fr_14rem_auto]" (submit)="search($event)">
          <label for="home-search" class="sr-only-focusable">{{ 'home.hero.searchLabel' | t }}</label>
          <div class="flex items-center gap-3 rounded-2xl bg-surface-raised px-4">
            <hms-icon name="search" [size]="20" class="shrink-0 text-brand-500" />
            <input
              id="home-search"
              type="search"
              autocomplete="off"
              class="h-13 w-full bg-transparent text-sm text-surface-fg placeholder:text-slate-400 focus:outline-none"
              [placeholder]="'home.hero.searchPlaceholder' | t"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
            />
          </div>
          <label for="home-department" class="sr-only-focusable">{{ 'nav.departments' | t }}</label>
          <select
            id="home-department"
            class="h-13 rounded-2xl bg-surface-raised px-4 text-sm text-surface-fg focus:outline-none focus:ring-2 focus:ring-brand-500"
            (change)="department.set($any($event.target).value)"
          >
            <option value="">{{ 'doctors.allDepartments' | t }}</option>
            @for (item of site.departments(); track item.slug) {
              <option [value]="item.slug">{{ item.name | loc }}</option>
            }
          </select>
          <button type="submit" siteBtn size="lg" class="h-13 rounded-2xl px-8">
            {{ 'home.hero.searchButton' | t }}
          </button>
        </form>

        <ul class="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          @for (action of quickActions; track action.title; let last = $last) {
            <li>
              @if (action.link) {
                <a [routerLink]="action.link" class="group flex h-full flex-col gap-3 rounded-2xl p-4 transition-colors hover:bg-tint sm:flex-row sm:items-center sm:gap-4">
                  <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-950 dark:text-brand-300">
                    <hms-icon [name]="action.icon" [size]="22" />
                  </span>
                  <span class="min-w-0">
                    <span class="block text-sm font-bold text-accent-950 dark:text-white">{{ action.title | t }}</span>
                    <span class="mt-0.5 hidden text-xs text-slate-500 sm:block dark:text-surface-fg-muted">{{ action.text | t }}</span>
                  </span>
                </a>
              } @else {
                <a [href]="action.href" class="group flex h-full flex-col gap-3 rounded-2xl bg-emergency-soft p-4 transition-colors hover:bg-emergency hover:text-white sm:flex-row sm:items-center sm:gap-4 dark:bg-emergency/15">
                  <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emergency text-white">
                    <hms-icon [name]="action.icon" [size]="22" />
                  </span>
                  <span class="min-w-0">
                    <span class="block text-sm font-bold text-emergency-strong group-hover:text-white">{{ action.title | t }}</span>
                    <span class="mt-0.5 block text-xs font-semibold text-emergency group-hover:text-white/90 sm:text-sm">{{ config.emergency | num }}</span>
                  </span>
                </a>
              }
            </li>
          }
        </ul>
      </div>
    </section>

    <!-- ================================================================ about -->
    <section class="py-20 lg:py-28" aria-labelledby="about-heading">
      <div class="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <div class="relative" siteReveal>
          <div class="relative overflow-hidden rounded-[2rem] shadow-lift">
            <img ngSrc="/images/about/team.webp" width="1200" height="800" sizes="(min-width: 1024px) 50vw, 100vw" alt="" class="aspect-[5/4] w-full object-cover" />
          </div>
          <div class="absolute -bottom-10 -right-2 hidden w-56 overflow-hidden rounded-3xl border-8 border-surface shadow-lift sm:block lg:-right-10">
            <img ngSrc="/images/about/lobby.webp" width="1200" height="900" sizes="(min-width: 640px) 20vw, 50vw" alt="" class="aspect-square w-full object-cover" />
          </div>
          <div class="absolute -left-3 top-8 flex items-center gap-3 rounded-2xl bg-surface-raised px-5 py-4 shadow-lift lg:-left-8">
            <span class="font-display text-4xl font-extrabold text-brand-600">{{ years | num }}+</span>
            <span class="max-w-[7rem] text-sm font-semibold leading-tight text-accent-950 dark:text-white">{{ 'home.about.badge' | t }}</span>
          </div>
        </div>

        <div siteReveal>
          <site-section-heading
            align="left"
            headingId="about-heading"
            [eyebrow]="'home.about.eyebrow' | t"
            [title]="'home.about.title' | t"
            [lead]="'home.about.lead' | t"
          />
          <ul class="mt-8 space-y-5">
            @for (point of aboutPoints; track point.title) {
              <li class="flex gap-4">
                <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                  <hms-icon [name]="point.icon" [size]="20" />
                </span>
                <div>
                  <p class="font-bold text-accent-950 dark:text-white">{{ point.title | t }}</p>
                  <p class="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-surface-fg-muted">{{ point.text | t }}</p>
                </div>
              </li>
            }
          </ul>
          <dl class="mt-10 grid grid-cols-3 gap-4 border-t border-slate-200 pt-8 dark:border-white/10">
            @for (stat of stats; track stat.label) {
              <div class="flex flex-col-reverse">
                <dt class="text-xs text-slate-500 sm:text-sm dark:text-surface-fg-muted">{{ stat.label | t }}</dt>
                <dd class="font-display text-xl font-extrabold text-accent-950 sm:text-3xl dark:text-white">{{ stat.value | num }}<span class="text-brand-500">+</span></dd>
              </div>
            }
          </dl>
          <a routerLink="/about" siteBtn="outline" class="mt-8">
            {{ 'home.about.cta' | t }}
            <hms-icon name="arrow-right" [size]="16" />
          </a>
        </div>
      </div>
    </section>

    <!-- ========================================================== departments -->
    <section class="bg-tint py-20 lg:py-28" aria-labelledby="departments-heading">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <site-section-heading
            align="left"
            headingId="departments-heading"
            [eyebrow]="'home.departments.eyebrow' | t"
            [title]="'home.departments.title' | t"
            [lead]="'home.departments.lead' | t"
          />
          <a routerLink="/departments" siteBtn="outline" class="self-start sm:self-auto">
            {{ 'common.viewAll' | t }}
            <hms-icon name="arrow-right" [size]="16" />
          </a>
        </div>
        <ul class="mt-12 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4" siteReveal="li">
          @for (department of site.departments(); track department.slug) {
            <li><site-department-card [department]="department" /></li>
          } @empty {
            @for (i of placeholders; track i) {
              <li class="h-80 animate-pulse rounded-3xl bg-surface-raised"></li>
            }
          }
        </ul>
      </div>
    </section>

    <!-- ============================================================== doctors -->
    <section class="py-20 lg:py-28" aria-labelledby="doctors-heading">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <site-section-heading
            align="left"
            headingId="doctors-heading"
            [eyebrow]="'home.doctors.eyebrow' | t"
            [title]="'home.doctors.title' | t"
            [lead]="'home.doctors.lead' | t"
          />
          <a routerLink="/doctors" siteBtn="outline" class="self-start sm:self-auto">
            {{ 'home.doctors.all' | t }}
            <hms-icon name="arrow-right" [size]="16" />
          </a>
        </div>
      </div>
      <!-- Scrolls sideways on phones, becomes a grid from md up. -->
      <ul
        class="no-scrollbar mx-auto mt-12 flex max-w-7xl snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-6 sm:scroll-px-6 sm:px-6 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-4 lg:gap-6 lg:px-8"
        siteReveal="li"
      >
        @for (doctor of featuredDoctors(); track doctor.id) {
          <li class="w-[78%] shrink-0 snap-start sm:w-[45%] md:w-auto">
            <site-doctor-card [doctor]="doctor" />
          </li>
        } @empty {
          @for (i of placeholders.slice(0, 4); track i) {
            <li class="h-[28rem] w-[78%] shrink-0 animate-pulse rounded-3xl bg-surface-sunken sm:w-[45%] md:w-auto"></li>
          }
        }
      </ul>
    </section>

    <!-- ============================================================= services -->
    <section class="relative isolate overflow-hidden bg-brand-950 py-20 lg:py-28" aria-labelledby="services-heading">
      <img ngSrc="/images/about/lobby.webp" fill sizes="100vw" alt="" class="-z-20 object-cover opacity-20" />
      <div class="absolute inset-0 -z-10 bg-linear-to-b from-brand-950/80 via-brand-950/95 to-brand-950"></div>
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <site-section-heading
            align="left"
            [inverse]="true"
            headingId="services-heading"
            [eyebrow]="'home.services.eyebrow' | t"
            [title]="'home.services.title' | t"
            [lead]="'home.services.lead' | t"
          />
          <a routerLink="/services" siteBtn="glass" class="self-start sm:self-auto">
            {{ 'common.viewAll' | t }}
            <hms-icon name="arrow-right" [size]="16" />
          </a>
        </div>
        <ul class="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" siteReveal="li">
          @for (service of site.services(); track service.slug) {
            <li>
              <a
                [routerLink]="['/services', service.slug]"
                class="group relative flex h-72 flex-col justify-end overflow-hidden rounded-3xl p-6 ring-1 ring-white/10"
              >
                <img
                  [ngSrc]="service.image"
                  width="800"
                  height="600"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  alt=""
                  class="absolute inset-0 -z-10 size-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div class="absolute inset-0 -z-10 bg-linear-to-t from-brand-950 via-brand-950/60 to-brand-950/5"></div>
                <span
                  class="flex size-11 items-center justify-center rounded-xl backdrop-blur"
                  [class]="service.isEmergency ? 'bg-emergency text-white' : 'bg-white/15 text-white ring-1 ring-white/25'"
                >
                  <hms-icon [name]="service.icon" [size]="20" />
                </span>
                <h3 class="font-display mt-4 text-lg font-bold text-white">{{ service.name | loc }}</h3>
                <p class="mt-1 line-clamp-2 text-sm text-white/70">{{ service.summary | loc }}</p>
              </a>
            </li>
          }
        </ul>
      </div>
    </section>

    @defer (on viewport) {
      <site-home-packages />
      <site-home-testimonials />
    } @placeholder {
      <div class="min-h-[48rem]" aria-hidden="true"></div>
    }

    <!-- ================================================================== CTA -->
    <section class="px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
      <div class="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-brand-700 px-6 py-14 sm:px-14 sm:py-16" siteReveal>
        <img ngSrc="/images/about/care.webp" fill sizes="100vw" alt="" class="-z-20 object-cover opacity-35" />
        <div class="absolute inset-0 -z-10 bg-linear-to-r from-brand-800 via-brand-700/90 to-brand-600/60"></div>
        <div class="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div class="max-w-xl">
            <h2 class="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{{ 'home.cta.title' | t }}</h2>
            <p class="mt-3 text-lg text-white/80">{{ 'home.cta.lead' | t }}</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <a routerLink="/book" siteBtn="white" size="lg">
              <hms-icon name="calendar" [size]="18" />
              {{ 'cta.bookAppointment' | t }}
            </a>
            <a [href]="'tel:' + config.hotline" siteBtn="glass" size="lg">
              <hms-icon name="phone" [size]="18" />
              {{ config.hotline | num }}
            </a>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class HomeComponent {
  protected readonly site = inject(PublicSiteService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  protected readonly config = SITE_CONFIG;
  protected readonly query = signal('');
  protected readonly department = signal('');
  protected readonly placeholders = [1, 2, 3, 4, 5, 6, 7, 8];
  protected readonly years = new Date().getFullYear() - SITE_CONFIG.established;

  private readonly doctors = this.site.doctorsResource(() => ({
    search: '',
    department: '',
    day: '',
    gender: '',
    page: 1,
  }));

  protected readonly featuredDoctors = computed(() => this.doctors.value()?.items.slice(0, 4) ?? []);

  protected readonly quickActions: readonly QuickAction[] = [
    { icon: 'calendar', title: 'home.quick.book', text: 'home.quick.bookText', link: '/book' },
    { icon: 'stethoscope', title: 'home.quick.find', text: 'home.quick.findText', link: '/doctors' },
    { icon: 'download', title: 'home.quick.reports', text: 'home.quick.reportsText', link: '/patient/reports' },
    { icon: 'siren', title: 'home.quick.emergency', text: 'home.quick.emergency', href: `tel:${SITE_CONFIG.emergency}` },
  ];

  protected readonly aboutPoints: readonly { icon: IconName; title: TranslationKey; text: TranslationKey }[] = [
    { icon: 'shield-check', title: 'home.why.accredited', text: 'home.why.accreditedText' },
    { icon: 'clock', title: 'home.why.emergency', text: 'home.why.emergencyText' },
    { icon: 'microscope', title: 'home.why.diagnostics', text: 'home.why.diagnosticsText' },
  ];

  protected readonly stats: readonly { value: string; label: TranslationKey }[] = [
    { value: '120', label: 'home.stats.doctors' },
    { value: '350', label: 'home.stats.beds' },
    { value: '2,00,000', label: 'home.stats.patients' },
  ];

  constructor() {
    effect(() => {
      this.i18n.lang();
      this.seo.set({
        title: this.i18n.pick(SITE_CONFIG.name),
        description: this.i18n.t('home.hero.lead'),
      });
    });
  }

  protected async search(event: Event): Promise<void> {
    event.preventDefault();
    const search = this.query().trim();
    const department = this.department();
    await this.router.navigate(['/doctors'], {
      queryParams: { search: search || null, department: department || null },
    });
  }
}
