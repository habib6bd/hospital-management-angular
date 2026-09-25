import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SITE_CONFIG } from '../../../core/config/site-config';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { PublicSiteService } from '../public-site.service';
import { DoctorAvatarComponent } from '../ui/doctor-avatar.component';
import { DoctorCardComponent } from '../ui/doctor-card.component';
import { SiteButtonDirective } from '../ui/site-button.directive';
import { formatDate, formatTime, toIsoDate, weekdayLong } from '../site-format';

/** How many upcoming chamber days to offer as one-tap booking shortcuts. */
const UPCOMING_DAYS = 4;

@Component({
  selector: 'site-doctor-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    SkeletonComponent,
    EmptyStateComponent,
    DoctorAvatarComponent,
    DoctorCardComponent,
    SiteButtonDirective,
    ...I18N_PIPES,
  ],
  template: `
    @if (doctor.value(); as d) {
      <section class="bg-linear-to-br from-brand-950 via-brand-900 to-brand-800 text-white">
        <div class="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb">
            <ol class="flex flex-wrap items-center gap-1 text-sm text-white/70">
              <li><a routerLink="/" class="hover:text-white">{{ 'nav.home' | t }}</a></li>
              <li class="flex items-center gap-1">
                <hms-icon name="chevron-right" [size]="14" />
                <a routerLink="/doctors" class="hover:text-white">{{ 'nav.doctors' | t }}</a>
              </li>
              <li class="flex items-center gap-1">
                <hms-icon name="chevron-right" [size]="14" />
                <span aria-current="page" class="text-white">{{ d.name | loc }}</span>
              </li>
            </ol>
          </nav>
        </div>
      </section>

      <div class="mx-auto -mt-20 max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div class="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div class="space-y-6">
            <!-- Identity card -->
            <article class="rounded-3xl bg-surface-raised shadow-lift p-6 ring-1 ring-slate-900/5 dark:ring-white/10 sm:p-8">
              <div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
                <site-doctor-avatar
                  class="w-40 shrink-0 rounded-3xl shadow-soft ring-4 ring-white sm:w-52 dark:ring-white/10"
                  ratio="portrait"
                  [priority]="true"
                  [id]="d.id"
                  [name]="d.name | loc"
                  [photoUrl]="d.photoUrl"
                  [size]="600"
                />
                <div class="min-w-0">
                  <p class="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    {{ d.departmentName | loc }}
                  </p>
                  <h1 class="font-display mt-3 text-3xl font-bold tracking-tight text-accent-950 sm:text-4xl dark:text-white">{{ d.name | loc }}</h1>
                  <p class="mt-1.5 text-lg font-semibold text-brand-600 dark:text-brand-400">{{ d.specialty | loc }}</p>
                  <p class="mt-1 text-sm text-surface-fg-muted">{{ d.designation | loc }}</p>
                  <p class="mt-2 text-sm font-medium text-surface-fg">{{ d.qualifications }}</p>
                </div>
              </div>

              <dl class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div class="rounded-2xl bg-tint p-4">
                  <dt class="text-xs text-surface-fg-muted">{{ 'doctor.experience' | t }}</dt>
                  <dd class="mt-1 text-lg font-bold text-accent-950 dark:text-white">{{ 'doctor.years' | t: { n: d.experienceYears } }}</dd>
                </div>
                <div class="rounded-2xl bg-tint p-4">
                  <dt class="text-xs text-surface-fg-muted">{{ 'doctor.fee' | t }}</dt>
                  <dd class="mt-1 text-lg font-bold text-accent-950 dark:text-white">৳{{ d.fee | num }}</dd>
                </div>
                <div class="rounded-2xl bg-tint p-4">
                  <dt class="text-xs text-surface-fg-muted">{{ 'doctor.room' | t }}</dt>
                  <dd class="mt-1 text-lg font-bold text-accent-950 dark:text-white">{{ d.room }}</dd>
                </div>
                <div class="rounded-2xl bg-tint p-4">
                  <dt class="text-xs text-surface-fg-muted">{{ 'doctor.languages' | t }}</dt>
                  <dd class="mt-1 text-sm font-semibold text-accent-950 dark:text-white">{{ d.languages | loc }}</dd>
                </div>
              </dl>
            </article>

            <section class="rounded-3xl bg-surface-raised shadow-soft p-6 ring-1 ring-slate-900/5 dark:ring-white/10 sm:p-8" aria-labelledby="about-heading">
              <h2 id="about-heading" class="text-lg font-semibold text-accent-950 dark:text-white">{{ 'doctor.about' | t }}</h2>
              <p class="mt-3 leading-relaxed text-surface-fg">{{ d.bio | loc }}</p>
            </section>

            <section class="rounded-3xl bg-surface-raised shadow-soft ring-1 ring-slate-900/5 dark:ring-white/10" aria-labelledby="schedule-heading">
              <h2 id="schedule-heading" class="px-6 pt-6 text-lg font-semibold text-accent-900 sm:px-8 dark:text-white">
                {{ 'doctor.schedule' | t }}
              </h2>
              <table class="mt-4 w-full text-sm">
                <caption class="sr-only-focusable">{{ 'doctor.schedule' | t }}</caption>
                <thead class="sr-only-focusable">
                  <tr>
                    <th scope="col">{{ 'doctor.day' | t }}</th>
                    <th scope="col">{{ 'doctor.time' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of schedule(); track row.weekday) {
                    <tr class="border-t border-surface-border">
                      <th scope="row" class="px-6 py-3.5 text-left font-medium text-surface-fg sm:px-8">{{ row.day }}</th>
                      <td class="px-6 py-3.5 text-right sm:px-8">
                        @if (row.time) {
                          <span class="font-semibold text-accent-950 dark:text-white">{{ row.time }}</span>
                        } @else {
                          <span class="text-surface-fg-muted">{{ 'doctor.off' | t }}</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </section>
          </div>

          <!-- Booking sidebar -->
          <aside class="lg:pt-0">
            <div class="sticky top-28 space-y-4">
              <div class="rounded-3xl bg-surface-raised shadow-soft p-6 ring-1 ring-slate-900/5 dark:ring-white/10">
                <h2 class="text-base font-semibold text-accent-950 dark:text-white">{{ 'doctor.bookTitle' | t }}</h2>
                <p class="mt-1 text-sm text-surface-fg-muted">{{ 'doctor.bookLead' | t }}</p>
                @if (upcoming().length > 0) {
                  <ul class="mt-4 grid grid-cols-2 gap-2">
                    @for (day of upcoming(); track day.iso) {
                      <li>
                        <a
                          routerLink="/book"
                          [queryParams]="{ doctor: d.id, date: day.iso }"
                          class="flex flex-col rounded-xl bg-surface-sunken px-3 py-2.5 text-sm ring-1 ring-transparent transition hover:bg-brand-50 hover:ring-brand-200 dark:hover:bg-brand-950 dark:hover:ring-brand-800"
                        >
                          <span class="font-semibold text-accent-950 dark:text-white">{{ day.label }}</span>
                          <span class="text-xs text-surface-fg-muted">{{ day.time }}</span>
                        </a>
                      </li>
                    }
                  </ul>
                }
                <a routerLink="/book" [queryParams]="{ doctor: d.id }" siteBtn size="lg" class="mt-5 w-full">
                  <hms-icon name="calendar" [size]="18" />
                  {{ 'cta.bookAppointment' | t }}
                </a>
                <p class="mt-3 text-center text-xs text-surface-fg-muted">{{ 'doctor.noLogin' | t }}</p>
              </div>

              <a
                [href]="'tel:' + config.hotline"
                class="flex items-center gap-3 rounded-card bg-brand-50 p-4 text-sm ring-1 ring-brand-100 dark:bg-brand-950 dark:ring-brand-900"
              >
                <span class="flex size-10 items-center justify-center rounded-full bg-brand-600 text-white">
                  <hms-icon name="phone" [size]="18" />
                </span>
                <span>
                  <span class="block text-surface-fg-muted">{{ 'doctor.callToBook' | t }}</span>
                  <span class="block text-base font-bold text-accent-950 dark:text-white">{{ config.hotline | num }}</span>
                </span>
              </a>
            </div>
          </aside>
        </div>

        @if (colleagues().length > 0) {
          <section class="mt-16" aria-labelledby="colleagues-heading">
            <h2 id="colleagues-heading" class="font-display text-xl font-bold text-accent-950 dark:text-white">
              {{ 'doctor.colleagues' | t: { department: (d.departmentName | loc) } }}
            </h2>
            <ul class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              @for (colleague of colleagues(); track colleague.id) {
                <li><site-doctor-card [doctor]="colleague" /></li>
              }
            </ul>
          </section>
        }
      </div>
    } @else if (doctor.error()) {
      <div class="mx-auto max-w-lg px-4 py-24">
        <hms-empty-state [title]="'doctor.notFound' | t" [description]="'doctor.notFoundText' | t">
          <a routerLink="/doctors" siteBtn="outline" size="sm">{{ 'home.doctors.all' | t }}</a>
        </hms-empty-state>
      </div>
    } @else {
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <hms-skeleton [lines]="8" [height]="20" [label]="'common.loading' | t" />
      </div>
    }
  `,
})
export class DoctorProfileComponent {
  private readonly site = inject(PublicSiteService);
  private readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  protected readonly config = SITE_CONFIG;

  /** Route param `:id`, bound by the router. */
  readonly id = input.required({ transform: (value: unknown) => numberAttribute(value, Number.NaN) });

  protected readonly doctor = this.site.doctorResource(() => this.id());

  private readonly sameDepartment = this.site.doctorsResource(() => {
    const d = this.doctor.value();
    return d === undefined ? undefined : { search: '', department: d.departmentSlug, day: '', gender: '', page: 1 };
  });

  protected readonly colleagues = computed(
    () => this.sameDepartment.value()?.items.filter((doctor) => doctor.id !== this.id()).slice(0, 3) ?? [],
  );

  protected readonly schedule = computed(() => {
    const d = this.doctor.value();
    const lang = this.i18n.lang();
    return [6, 0, 1, 2, 3, 4, 5].map((weekday) => {
      const time = d?.chamber.find((entry) => entry.weekday === weekday);
      return {
        weekday,
        day: weekdayLong(weekday, lang),
        time: time === undefined ? null : `${formatTime(time.startTime, lang)} – ${formatTime(time.endTime, lang)}`,
      };
    });
  });

  /** The next few dates this doctor actually sits, starting tomorrow-or-today. */
  protected readonly upcoming = computed(() => {
    const d = this.doctor.value();
    if (d === undefined) {
      return [];
    }
    const lang = this.i18n.lang();
    const days: { iso: string; label: string; time: string }[] = [];
    const cursor = new Date();
    for (let i = 0; i < 14 && days.length < UPCOMING_DAYS; i++) {
      const chamber = d.chamber.find((entry) => entry.weekday === cursor.getDay());
      if (chamber !== undefined) {
        const iso = toIsoDate(cursor);
        days.push({ iso, label: formatDate(iso, lang, 'short'), time: formatTime(chamber.startTime, lang) });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  });

  constructor() {
    effect(() => {
      if (this.doctor.error() !== undefined) {
        this.seo.notFound();
      }
    });
    effect(() => {
      const d = this.doctor.value();
      if (d === undefined) {
        return;
      }
      const name = this.i18n.pick(d.name);
      this.seo.set({
        title: `${name} — ${this.i18n.pick(d.specialty)}`,
        description: `${name}, ${this.i18n.pick(d.specialty)}. ${d.qualifications}. ${this.i18n.t('doctor.bookLead')}`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Physician',
          name: d.name.en,
          medicalSpecialty: d.specialty.en,
          description: d.bio.en,
          worksFor: { '@type': 'Hospital', name: SITE_CONFIG.name.en },
        },
      });
    });
  }
}
