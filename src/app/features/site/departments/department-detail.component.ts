import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SeoService } from '../../../core/seo/seo.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { PublicSiteService } from '../public-site.service';
import { DoctorCardComponent } from '../ui/doctor-card.component';
import { PageHeroComponent } from '../ui/page-hero.component';
import { SiteButtonDirective } from '../ui/site-button.directive';

@Component({
  selector: 'site-department-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    SkeletonComponent,
    EmptyStateComponent,
    DoctorCardComponent,
    PageHeroComponent,
    SiteButtonDirective,
    ...I18N_PIPES,
  ],
  template: `
    @if (department(); as d) {
      <site-page-hero
        [title]="d.name | loc"
        [lead]="d.summary | loc"
        [crumbs]="[{ label: ('nav.departments' | t), link: '/departments' }, { label: (d.name | loc) }]"
        [image]="d.image"
      >
        <div class="mt-6 flex flex-wrap gap-3">
          <a routerLink="/book" [queryParams]="{ department: d.slug }" siteBtn="white">
            <hms-icon name="calendar" [size]="18" />
            {{ 'cta.bookAppointment' | t }}
          </a>
        </div>
      </site-page-hero>

      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div class="grid gap-10 lg:grid-cols-[1fr_20rem]">
          <section aria-labelledby="overview-heading">
            <h2 id="overview-heading" class="font-display text-xl font-bold text-accent-950 dark:text-white">{{ 'department.overview' | t }}</h2>
            <p class="mt-3 text-base leading-relaxed text-surface-fg">{{ d.description | loc }}</p>
          </section>
          <aside class="rounded-3xl bg-surface-raised shadow-soft p-6 ring-1 ring-slate-900/5 dark:ring-white/10" aria-labelledby="dept-services-heading">
            <span class="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              <hms-icon [name]="d.icon" [size]="24" />
            </span>
            <h2 id="dept-services-heading" class="mt-4 font-semibold text-accent-950 dark:text-white">{{ 'department.services' | t }}</h2>
            <ul class="mt-3 space-y-2.5 text-sm">
              @for (service of d.services; track $index) {
                <li class="flex gap-2.5 text-surface-fg">
                  <hms-icon name="check-circle" [size]="18" class="shrink-0 text-brand-600" />
                  {{ service | loc }}
                </li>
              }
            </ul>
          </aside>
        </div>

        <section class="mt-14" aria-labelledby="dept-doctors-heading">
          <h2 id="dept-doctors-heading" class="font-display text-xl font-bold text-accent-950 dark:text-white">
            {{ 'department.ourDoctors' | t }}
          </h2>
          @if (doctors.value(); as page) {
            @if (page.items.length > 0) {
              <ul class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                @for (doctor of page.items; track doctor.id) {
                  <li><site-doctor-card [doctor]="doctor" /></li>
                }
              </ul>
            } @else {
              <hms-empty-state [title]="'doctors.emptyTitle' | t" />
            }
          } @else {
            <div class="mt-6"><hms-skeleton [lines]="4" [height]="18" /></div>
          }
        </section>
      </div>
    } @else if (!site.isDepartmentsLoading()) {
      <div class="mx-auto max-w-lg px-4 py-24">
        <hms-empty-state [title]="'department.notFound' | t">
          <a routerLink="/departments" siteBtn="outline" size="sm">{{ 'common.viewAll' | t }}</a>
        </hms-empty-state>
      </div>
    } @else {
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <hms-skeleton [lines]="6" [height]="20" />
      </div>
    }
  `,
})
export class DepartmentDetailComponent {
  protected readonly site = inject(PublicSiteService);

  /** Route param `:slug`. */
  readonly slug = input.required<string>();

  protected readonly department = computed(() => this.site.departmentBySlug(this.slug()));

  protected readonly doctors = this.site.doctorsResource(() => ({
    search: '',
    department: this.slug(),
    day: '',
    gender: '',
    page: 1,
  }));

  constructor() {
    const i18n = inject(I18nService);
    const seo = inject(SeoService);
    effect(() => {
      if (!this.site.isDepartmentsLoading() && this.site.departments().length > 0 && this.department() === undefined) {
        seo.notFound();
      }
    });
    effect(() => {
      const d = this.department();
      if (d !== undefined) {
        seo.set({ title: i18n.pick(d.name), description: i18n.pick(d.summary) });
      }
    });
  }
}
