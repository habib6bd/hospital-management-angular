import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SeoService } from '../../../core/seo/seo.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { PublicSiteService } from '../public-site.service';
import { PageHeroComponent } from '../ui/page-hero.component';

@Component({
  selector: 'site-service-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SkeletonComponent, PageHeroComponent, ...I18N_PIPES],
  template: `
    <site-page-hero
      [title]="'services.title' | t"
      [lead]="'services.lead' | t"
      [crumbs]="[{ label: ('nav.services' | t) }]"
      image="/images/services/diagnostics.webp"
    />
    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        @for (service of site.services(); track service.slug) {
          <li>
            <a
              [routerLink]="['/services', service.slug]"
              class="group flex h-full gap-5 rounded-3xl bg-surface-raised shadow-soft p-6 ring-1 ring-slate-900/5 dark:ring-white/10 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-900/5 hover:ring-brand-200 dark:hover:ring-brand-800"
            >
              <span
                class="flex size-12 shrink-0 items-center justify-center rounded-xl"
                [class]="service.isEmergency ? 'bg-emergency-soft text-emergency' : 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300'"
              >
                <hms-icon [name]="service.icon" [size]="24" />
              </span>
              <span class="flex flex-col">
                <span class="font-semibold text-accent-950 dark:text-white">{{ service.name | loc }}</span>
                <span class="mt-1 text-sm text-surface-fg-muted">{{ service.summary | loc }}</span>
                <span class="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-400">
                  {{ 'common.learnMore' | t }}
                  <hms-icon name="arrow-right" [size]="16" class="transition-transform group-hover:translate-x-0.5" />
                </span>
              </span>
            </a>
          </li>
        } @empty {
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <li class="rounded-3xl bg-surface-raised shadow-soft p-6 ring-1 ring-slate-900/5 dark:ring-white/10">
              <hms-skeleton [lines]="3" [height]="14" />
            </li>
          }
        }
      </ul>
    </div>
  `,
})
export class ServiceListComponent {
  protected readonly site = inject(PublicSiteService);

  constructor() {
    const i18n = inject(I18nService);
    const seo = inject(SeoService);
    effect(() => seo.set({ title: i18n.t('services.title'), description: i18n.t('services.lead') }));
  }
}
