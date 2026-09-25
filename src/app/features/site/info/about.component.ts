import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SITE_CONFIG } from '../../../core/config/site-config';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { TranslationKey } from '../../../core/i18n/dictionaries/en';
import { SeoService } from '../../../core/seo/seo.service';
import { IconComponent, type IconName } from '../../../shared/ui/icon/icon.component';
import { PageHeroComponent } from '../ui/page-hero.component';
import { SectionHeadingComponent } from '../ui/section-heading.component';
import { SiteButtonDirective } from '../ui/site-button.directive';

@Component({
  selector: 'site-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RouterLink, IconComponent, PageHeroComponent, SectionHeadingComponent, SiteButtonDirective, ...I18N_PIPES],
  template: `
    <site-page-hero [title]="'about.title' | t" [lead]="'about.lead' | t" [crumbs]="[{ label: ('nav.about' | t) }]" image="/images/about/team.webp" />

    <section class="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
      <div>
        <site-section-heading align="left" [eyebrow]="'about.storyEyebrow' | t" [title]="'about.storyTitle' | t" />
        <div class="mt-5 space-y-4 leading-relaxed text-surface-fg">
          <p>{{ 'about.story1' | t: { year: config.established } }}</p>
          <p>{{ 'about.story2' | t }}</p>
        </div>
      </div>
      <div>
        <div class="overflow-hidden rounded-[2rem] shadow-lift">
          <img ngSrc="/images/about/lobby.webp" width="1200" height="900" sizes="(min-width: 1024px) 50vw, 100vw" alt="" class="aspect-[16/10] w-full object-cover" />
        </div>
      <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        @for (fact of facts; track fact.label) {
          <div class="rounded-3xl bg-surface-raised shadow-soft p-6 ring-1 ring-slate-900/5 dark:ring-white/10">
            <p class="font-display text-2xl font-extrabold text-accent-950 dark:text-white">{{ fact.value | num }}<span class="text-brand-600">+</span></p>
            <p class="mt-1 text-sm text-surface-fg-muted">{{ fact.label | t }}</p>
          </div>
        }
      </div>
      </div>
    </section>

    <section class="bg-tint py-14 lg:py-20" aria-labelledby="values-heading">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <site-section-heading headingId="values-heading" [eyebrow]="'about.valuesEyebrow' | t" [title]="'about.valuesTitle' | t" />
        <ul class="mt-12 grid gap-6 md:grid-cols-3">
          @for (value of values; track value.title) {
            <li class="rounded-3xl bg-surface-raised shadow-soft p-6 ring-1 ring-slate-900/5 dark:ring-white/10">
              <span class="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                <hms-icon [name]="value.icon" [size]="24" />
              </span>
              <h3 class="mt-4 font-semibold text-accent-950 dark:text-white">{{ value.title | t }}</h3>
              <p class="mt-1.5 text-sm text-surface-fg-muted">{{ value.text | t }}</p>
            </li>
          }
        </ul>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20" aria-labelledby="facilities-heading">
      <site-section-heading headingId="facilities-heading" [eyebrow]="'about.facilitiesEyebrow' | t" [title]="'about.facilitiesTitle' | t" />
      <ul class="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        @for (item of facilities; track item) {
          <li class="flex items-center gap-3 rounded-2xl bg-surface-raised px-4 py-3.5 text-sm font-medium text-surface-fg ring-1 ring-slate-900/5 dark:ring-white/10">
            <hms-icon name="check-circle" [size]="18" class="shrink-0 text-brand-600" />
            {{ item | t }}
          </li>
        }
      </ul>
      <div class="mt-12 flex flex-wrap justify-center gap-3">
        <a routerLink="/doctors" siteBtn>{{ 'home.doctors.all' | t }}</a>
        <a routerLink="/contact" siteBtn="outline">{{ 'nav.contact' | t }}</a>
      </div>
    </section>
  `,
})
export class AboutComponent {
  protected readonly config = SITE_CONFIG;

  protected readonly facts: readonly { value: string; label: TranslationKey }[] = [
    { value: '350', label: 'home.stats.beds' },
    { value: '120', label: 'home.stats.doctors' },
    { value: '40', label: 'about.icuBeds' },
    { value: '6', label: 'about.theatres' },
  ];

  protected readonly values: readonly { icon: IconName; title: TranslationKey; text: TranslationKey }[] = [
    { icon: 'heart', title: 'about.value1', text: 'about.value1Text' },
    { icon: 'shield-check', title: 'about.value2', text: 'about.value2Text' },
    { icon: 'patients', title: 'about.value3', text: 'about.value3Text' },
  ];

  protected readonly facilities: readonly TranslationKey[] = [
    'about.fac1',
    'about.fac2',
    'about.fac3',
    'about.fac4',
    'about.fac5',
    'about.fac6',
    'about.fac7',
    'about.fac8',
  ];

  constructor() {
    const i18n = inject(I18nService);
    const seo = inject(SeoService);
    effect(() => seo.set({ title: i18n.t('about.title'), description: i18n.t('about.lead') }));
  }
}
