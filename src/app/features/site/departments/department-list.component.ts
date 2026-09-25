import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { PublicSiteService } from '../public-site.service';
import { DepartmentCardComponent } from '../ui/department-card.component';
import { PageHeroComponent } from '../ui/page-hero.component';

@Component({
  selector: 'site-department-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, DepartmentCardComponent, PageHeroComponent, ...I18N_PIPES],
  template: `
    <site-page-hero
      [title]="'departments.title' | t"
      [lead]="'departments.lead' | t"
      [crumbs]="[{ label: ('nav.departments' | t) }]"
      image="/images/about/lobby.webp"
    />
    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        @for (department of site.departments(); track department.slug) {
          <li><site-department-card [department]="department" /></li>
        } @empty {
          @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) {
            <li class="rounded-3xl bg-surface-raised shadow-soft p-5 ring-1 ring-slate-900/5 dark:ring-white/10">
              <hms-skeleton [lines]="4" [height]="14" />
            </li>
          }
        }
      </ul>
    </div>
  `,
})
export class DepartmentListComponent {
  protected readonly site = inject(PublicSiteService);

  constructor() {
    const i18n = inject(I18nService);
    const seo = inject(SeoService);
    effect(() => seo.set({ title: i18n.t('departments.title'), description: i18n.t('departments.lead') }));
  }
}
