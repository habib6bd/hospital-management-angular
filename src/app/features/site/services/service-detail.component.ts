import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_CONFIG } from '../../../core/config/site-config';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SeoService } from '../../../core/seo/seo.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { PublicSiteService } from '../public-site.service';
import { PageHeroComponent } from '../ui/page-hero.component';
import { SiteButtonDirective } from '../ui/site-button.directive';
import { HomePackagesComponent } from '../home/home-packages.component';

@Component({
  selector: 'site-service-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    SkeletonComponent,
    EmptyStateComponent,
    PageHeroComponent,
    SiteButtonDirective,
    HomePackagesComponent,
    ...I18N_PIPES,
  ],
  template: `
    @if (service.value(); as s) {
      <site-page-hero
        [title]="s.name | loc"
        [lead]="s.summary | loc"
        [crumbs]="[{ label: ('nav.services' | t), link: '/services' }, { label: (s.name | loc) }]"
        [image]="s.image"
      >
        @if (s.isEmergency) {
          <a [href]="'tel:' + config.emergency" siteBtn="emergency" size="lg" class="mt-6">
            <hms-icon name="phone" [size]="18" />
            {{ 'top.callEmergency' | t }} · {{ config.emergency | num }}
          </a>
        }
      </site-page-hero>

      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div class="grid gap-10 lg:grid-cols-[1fr_20rem]">
          <section>
            <p class="text-base leading-relaxed text-surface-fg">{{ s.description | loc }}</p>
            <ul class="mt-8 grid gap-4 sm:grid-cols-3">
              @for (feature of s.features; track $index) {
                <li class="rounded-3xl bg-surface-raised shadow-soft p-5 ring-1 ring-slate-900/5 dark:ring-white/10">
                  <hms-icon name="check-circle" [size]="22" class="text-brand-600" />
                  <p class="mt-3 text-sm font-semibold text-accent-950 dark:text-white">{{ feature | loc }}</p>
                </li>
              }
            </ul>
          </section>

          <aside class="space-y-4">
            <div class="rounded-card bg-accent-900 p-6 text-white">
              <hms-icon [name]="s.icon" [size]="28" class="text-brand-300" />
              <h2 class="mt-4 font-semibold">{{ 'service.help' | t }}</h2>
              <p class="mt-1 text-sm text-white/75">{{ 'service.helpText' | t }}</p>
              <a [href]="'tel:' + config.hotline" siteBtn="white" class="mt-5 w-full">
                <hms-icon name="phone" [size]="18" />
                {{ config.hotline | num }}
              </a>
            </div>
            <a routerLink="/book" siteBtn="outline" class="w-full">
              <hms-icon name="calendar" [size]="18" />
              {{ 'cta.bookAppointment' | t }}
            </a>
          </aside>
        </div>
      </div>

      @if (s.slug === 'health-checkup') {
        <site-home-packages />
      }

      @if (related().length > 0) {
        <section class="border-t border-surface-border bg-tint py-12" aria-labelledby="related-heading">
          <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="related-heading" class="font-display text-lg font-bold text-accent-950 dark:text-white">{{ 'service.related' | t }}</h2>
            <ul class="mt-5 flex flex-wrap gap-2">
              @for (item of related(); track item.slug) {
                <li>
                  <a
                    [routerLink]="['/services', item.slug]"
                    class="inline-flex items-center gap-2 rounded-full bg-surface-raised px-4 py-2 text-sm font-medium text-surface-fg ring-1 ring-slate-900/5 dark:ring-white/10 hover:ring-brand-300"
                  >
                    <hms-icon [name]="item.icon" [size]="16" class="text-brand-600" />
                    {{ item.name | loc }}
                  </a>
                </li>
              }
            </ul>
          </div>
        </section>
      }
    } @else if (service.error()) {
      <div class="mx-auto max-w-lg px-4 py-24">
        <hms-empty-state [title]="'service.notFound' | t">
          <a routerLink="/services" siteBtn="outline" size="sm">{{ 'common.viewAll' | t }}</a>
        </hms-empty-state>
      </div>
    } @else {
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <hms-skeleton [lines]="6" [height]="20" />
      </div>
    }
  `,
})
export class ServiceDetailComponent {
  private readonly site = inject(PublicSiteService);

  protected readonly config = SITE_CONFIG;

  /** Route param `:slug`. */
  readonly slug = input.required<string>();

  protected readonly service = this.site.serviceResource(() => this.slug());

  protected readonly related = computed(() =>
    this.site.services().filter((item) => item.slug !== this.slug()),
  );

  constructor() {
    const i18n = inject(I18nService);
    const seo = inject(SeoService);
    effect(() => {
      if (this.service.error() !== undefined) {
        seo.notFound();
      }
    });
    effect(() => {
      const s = this.service.value();
      if (s !== undefined) {
        seo.set({ title: i18n.pick(s.name), description: i18n.pick(s.summary) });
      }
    });
  }
}
