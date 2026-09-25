import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SeoService } from '../../../core/seo/seo.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { PaginationComponent } from '../../../shared/ui/pagination/pagination.component';
import type { DoctorQuery, Gender } from '../../../shared/models/public.model';
import { PublicSiteService } from '../public-site.service';
import { DoctorCardComponent } from '../ui/doctor-card.component';
import { PageHeroComponent } from '../ui/page-hero.component';
import { SiteButtonDirective } from '../ui/site-button.directive';
import { weekdayLong } from '../site-format';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Doctor directory. Every filter lives in the query string (bound to inputs by
 * `withComponentInputBinding`), so a filtered list can be bookmarked, shared
 * and restored with the back button.
 */
@Component({
  selector: 'site-doctor-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    IconComponent,
    SkeletonComponent,
    EmptyStateComponent,
    PaginationComponent,
    DoctorCardComponent,
    PageHeroComponent,
    SiteButtonDirective,
    ...I18N_PIPES,
  ],
  template: `
    <site-page-hero
      [title]="'doctors.title' | t"
      [lead]="'doctors.lead' | t"
      [crumbs]="[{ label: ('nav.doctors' | t) }]"
      image="/images/about/team.webp"
    />

    <ng-template #filterPanel let-idPrefix>
      <div class="space-y-6">
        <div>
          <label [for]="idPrefix + '-search'" class="text-sm font-semibold text-accent-950 dark:text-white">
            {{ 'doctors.searchLabel' | t }}
          </label>
          <div class="relative mt-2">
            <hms-icon name="search" [size]="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-fg-muted" />
            <input
              [id]="idPrefix + '-search'"
              type="search"
              autocomplete="off"
              class="h-11 w-full rounded-xl bg-surface pl-10 pr-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border placeholder:text-surface-fg-muted focus:ring-2 focus:ring-brand-500"
              [placeholder]="'doctors.searchPlaceholder' | t"
              [value]="search()"
              (input)="onSearch($any($event.target).value)"
            />
          </div>
        </div>

        <fieldset>
          <legend class="text-sm font-semibold text-accent-950 dark:text-white">{{ 'nav.departments' | t }}</legend>
          <div class="mt-2 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            <button type="button" [class]="chipClass(department() === '')" (click)="apply({ department: '' })">
              {{ 'doctors.allDepartments' | t }}
            </button>
            @for (item of site.departments(); track item.slug) {
              <button type="button" [class]="chipClass(department() === item.slug)" [attr.aria-pressed]="department() === item.slug" (click)="apply({ department: item.slug })">
                {{ item.name | loc }}
                <span class="ml-auto pl-2 text-xs opacity-60">{{ item.doctorCount | num }}</span>
              </button>
            }
          </div>
        </fieldset>

        <div>
          <label [for]="idPrefix + '-day'" class="text-sm font-semibold text-accent-950 dark:text-white">{{ 'doctors.day' | t }}</label>
          <select
            [id]="idPrefix + '-day'"
            class="mt-2 h-11 w-full rounded-xl bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            (change)="apply({ day: $any($event.target).value })"
          >
            <option value="" [selected]="day() === ''">{{ 'doctors.anyDay' | t }}</option>
            @for (weekday of weekdays(); track weekday.value) {
              <option [value]="weekday.value" [selected]="day() === weekday.value">{{ weekday.label }}</option>
            }
          </select>
        </div>

        <fieldset>
          <legend class="text-sm font-semibold text-accent-950 dark:text-white">{{ 'doctors.gender' | t }}</legend>
          <div class="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-surface-sunken p-1">
            @for (option of genderOptions; track option.value) {
              <button
                type="button"
                class="rounded-lg py-2 text-xs font-semibold transition-colors"
                [class]="gender() === option.value ? 'bg-surface-raised text-brand-700 shadow-sm dark:text-brand-300' : 'text-surface-fg-muted hover:text-surface-fg'"
                [attr.aria-pressed]="gender() === option.value"
                (click)="apply({ gender: option.value })"
              >
                {{ option.label | t }}
              </button>
            }
          </div>
        </fieldset>

        @if (activeFilterCount() > 0) {
          <button type="button" class="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400" (click)="reset()">
            {{ 'doctors.clear' | t }}
          </button>
        }
      </div>
    </ng-template>

    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div class="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside class="hidden lg:block" [attr.aria-label]="'doctors.filters' | t">
          <div class="sticky top-28 rounded-3xl bg-surface-raised shadow-soft p-5 ring-1 ring-slate-900/5 dark:ring-white/10">
            <ng-container *ngTemplateOutlet="filterPanel; context: { $implicit: 'desktop' }" />
          </div>
        </aside>

        <div>
          <div class="flex items-center justify-between gap-4">
            <p class="text-sm text-surface-fg-muted" aria-live="polite">
              @if (result.value(); as page) {
                {{ 'doctors.count' | t: { n: page.total } }}
              }
            </p>
            <button type="button" siteBtn="outline" size="sm" class="lg:hidden!" (click)="openFilters()">
              <hms-icon name="filter" [size]="16" />
              {{ 'doctors.filters' | t }}
              @if (activeFilterCount() > 0) {
                <span class="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] text-white">
                  {{ activeFilterCount() | num }}
                </span>
              }
            </button>
          </div>

          @if (result.isLoading() && result.value() === undefined) {
            <ul class="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              @for (i of [1, 2, 3, 4, 5, 6]; track i) {
                <li class="rounded-3xl bg-surface-raised shadow-soft p-5 ring-1 ring-slate-900/5 dark:ring-white/10">
                  <hms-skeleton [lines]="6" [height]="14" />
                </li>
              }
            </ul>
          } @else if (result.value(); as page) {
            @if (page.items.length === 0) {
              <div class="mt-6 rounded-3xl bg-surface-raised shadow-soft ring-1 ring-slate-900/5 dark:ring-white/10">
                <hms-empty-state [title]="'doctors.emptyTitle' | t" [description]="'doctors.emptyText' | t">
                  <button type="button" siteBtn="outline" size="sm" (click)="reset()">{{ 'doctors.clear' | t }}</button>
                </hms-empty-state>
              </div>
            } @else {
              <ul class="mt-6 grid gap-5 transition-opacity sm:grid-cols-2 xl:grid-cols-3" [class.opacity-60]="result.isLoading()">
                @for (doctor of page.items; track doctor.id) {
                  <li><site-doctor-card [doctor]="doctor" /></li>
                }
              </ul>
              @if (page.totalPages > 1) {
                <div class="mt-8">
                  <hms-pagination
                    [page]="page.page"
                    [pageSize]="page.pageSize"
                    [total]="page.total"
                    [totalPages]="page.totalPages"
                    (pageChanged)="apply({ page: $event })"
                  />
                </div>
              }
            }
          } @else if (result.error()) {
            <div class="mt-6 rounded-3xl bg-surface-raised shadow-soft ring-1 ring-slate-900/5 dark:ring-white/10">
              <hms-empty-state [title]="'common.loadError' | t">
                <button type="button" siteBtn="outline" size="sm" (click)="result.reload()">{{ 'common.retry' | t }}</button>
              </hms-empty-state>
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Bottom sheet for filters on small screens. -->
    <dialog
      #filterSheet
      class="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-3xl bg-surface-raised p-0 text-surface-fg backdrop:bg-accent-950/50"
      [attr.aria-label]="'doctors.filters' | t"
      (click)="onSheetClick($event)"
    >
      <div class="sticky top-0 flex items-center justify-between border-b border-surface-border bg-surface-raised px-5 py-4">
        <h2 class="text-base font-semibold">{{ 'doctors.filters' | t }}</h2>
        <button type="button" class="flex size-9 items-center justify-center rounded-full hover:bg-surface-sunken" [attr.aria-label]="'common.close' | t" (click)="closeFilters()">
          <hms-icon name="x" [size]="20" />
        </button>
      </div>
      <div class="px-5 py-5">
        <ng-container *ngTemplateOutlet="filterPanel; context: { $implicit: 'mobile' }" />
      </div>
      <div class="sticky bottom-0 border-t border-surface-border bg-surface-raised p-4">
        <button type="button" siteBtn class="w-full" (click)="closeFilters()">
          {{ 'doctors.showResults' | t: { n: result.value()?.total ?? 0 } }}
        </button>
      </div>
    </dialog>
  `,
})
export class DoctorListComponent {
  protected readonly site = inject(PublicSiteService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  /* Query params, bound by the router. */
  readonly search = input('', { transform: (value: string | undefined) => value ?? '' });
  readonly department = input('', { transform: (value: string | undefined) => value ?? '' });
  readonly day = input('', { transform: (value: string | undefined) => value ?? '' });
  readonly gender = input<Gender | '', string | undefined>('', {
    transform: (value: string | undefined): Gender | '' => (value === 'male' || value === 'female' ? value : ''),
  });
  readonly page = input(1, { transform: (value: unknown) => Math.max(1, numberAttribute(value, 1)) });

  private readonly filterSheet = viewChild.required<ElementRef<HTMLDialogElement>>('filterSheet');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly result = this.site.doctorsResource(
    (): DoctorQuery => ({
      search: this.search(),
      department: this.department(),
      day: this.day(),
      gender: this.gender(),
      page: this.page(),
    }),
  );

  protected readonly activeFilterCount = computed(
    () => [this.search(), this.department(), this.day(), this.gender()].filter((value) => value !== '').length,
  );

  /** Saturday first: the Bangladeshi working week. */
  protected readonly weekdays = computed(() =>
    [6, 0, 1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: weekdayLong(value, this.i18n.lang()) })),
  );

  protected readonly genderOptions = [
    { value: '' as const, label: 'doctors.any' as const },
    { value: 'male' as const, label: 'doctors.male' as const },
    { value: 'female' as const, label: 'doctors.female' as const },
  ];

  constructor() {
    effect(() => {
      const department = this.site.departmentBySlug(this.department());
      const title = department === undefined
        ? this.i18n.t('doctors.title')
        : `${this.i18n.pick(department.name)} — ${this.i18n.t('nav.doctors')}`;
      this.seo.set({ title, description: this.i18n.t('doctors.lead') });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  protected chipClass(active: boolean): string {
    const base = 'flex items-center rounded-full px-3 py-1.5 text-left text-sm font-medium transition-colors lg:rounded-lg lg:px-3 lg:py-2';
    return active
      ? `${base} bg-brand-600 text-white`
      : `${base} bg-surface-sunken text-surface-fg hover:bg-brand-50 hover:text-brand-700 lg:bg-transparent dark:hover:bg-brand-950 dark:hover:text-brand-300`;
  }

  protected onSearch(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.apply({ search: value.trim() }, true), SEARCH_DEBOUNCE_MS);
  }

  /** Any filter change goes back to page 1; only paging keeps the page number. */
  protected async apply(changes: Partial<Record<'search' | 'department' | 'day' | 'gender', string>> & { page?: number }, replaceUrl = false): Promise<void> {
    const next = {
      search: this.search(),
      department: this.department(),
      day: this.day(),
      gender: this.gender() as string,
      ...changes,
      page: changes.page ?? 1,
    };
    await this.router.navigate([], {
      queryParams: {
        search: next.search || null,
        department: next.department || null,
        day: next.day || null,
        gender: next.gender || null,
        page: next.page > 1 ? next.page : null,
      },
      replaceUrl,
      // Filtering should not throw the visitor back to the top of the page;
      // paging should, so they start reading the new page from its first card.
      scroll: changes.page === undefined ? 'manual' : 'after-transition',
    });
  }

  protected async reset(): Promise<void> {
    await this.router.navigate([], { queryParams: {}, scroll: 'manual' });
  }

  protected openFilters(): void {
    this.filterSheet().nativeElement.showModal();
  }

  protected closeFilters(): void {
    this.filterSheet().nativeElement.close();
  }

  protected onSheetClick(event: MouseEvent): void {
    if (event.target === this.filterSheet().nativeElement) {
      this.closeFilters();
    }
  }
}
