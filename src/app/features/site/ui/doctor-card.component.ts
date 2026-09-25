import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { DoctorAvatarComponent } from './doctor-avatar.component';
import { SiteButtonDirective } from './site-button.directive';
import { weekdayShort } from '../site-format';
import type { PublicDoctor } from '../../../shared/models/public.model';

@Component({
  selector: 'site-doctor-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, DoctorAvatarComponent, SiteButtonDirective, ...I18N_PIPES],
  host: { class: 'block h-full' },
  template: `
    @let d = doctor();
    <article class="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-surface-raised shadow-soft ring-1 ring-slate-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-lift dark:ring-white/10">
      <div class="relative overflow-hidden bg-brand-50 dark:bg-brand-950">
        <site-doctor-avatar
          class="transition-transform duration-500 group-hover:scale-[1.04]"
          ratio="card"
          [id]="d.id"
          [name]="d.name | loc"
          [photoUrl]="d.photoUrl"
          [size]="600"
        />
        <span class="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand-700 shadow-sm backdrop-blur">
          {{ d.departmentName | loc }}
        </span>
      </div>

      <div class="flex flex-1 flex-col p-5">
        <h3 class="font-display text-lg font-bold leading-snug text-accent-950 dark:text-white">
          <a [routerLink]="['/doctors', d.id]" class="after:absolute after:inset-0 focus:outline-none">{{ d.name | loc }}</a>
        </h3>
        <p class="mt-0.5 text-sm font-semibold text-brand-600 dark:text-brand-400">{{ d.specialty | loc }}</p>
        <p class="mt-1.5 line-clamp-1 text-xs text-slate-500 dark:text-surface-fg-muted">{{ d.qualifications }}</p>

        <div class="mt-4 flex items-center gap-4 text-xs text-slate-600 dark:text-surface-fg-muted">
          <span class="flex items-center gap-1.5">
            <hms-icon name="award" [size]="15" class="text-brand-500" />
            {{ 'doctor.years' | t: { n: d.experienceYears } }}
          </span>
          <span class="flex items-center gap-1.5">
            <hms-icon name="billing" [size]="15" class="text-brand-500" />
            ৳{{ d.fee | num }}
          </span>
        </div>
        <p class="mt-2 flex items-center gap-1.5 text-xs text-slate-600 dark:text-surface-fg-muted">
          <hms-icon name="calendar" [size]="15" class="shrink-0 text-brand-500" />
          <span class="sr-only-focusable">{{ 'doctor.chamberDays' | t }}:</span>
          {{ days() }}
        </p>

        <div class="relative z-10 mt-auto flex gap-2 pt-5">
          <a [routerLink]="['/doctors', d.id]" siteBtn="outline" size="sm" class="flex-1">{{ 'doctor.viewProfile' | t }}</a>
          <a routerLink="/book" [queryParams]="{ doctor: d.id }" siteBtn size="sm" class="flex-1">{{ 'cta.book' | t }}</a>
        </div>
      </div>
    </article>
  `,
})
export class DoctorCardComponent {
  private readonly i18n = inject(I18nService);

  readonly doctor = input.required<PublicDoctor>();

  /** Saturday-first week, as clinics in Bangladesh lay it out. */
  protected readonly days = computed(() => {
    const working = new Set(this.doctor().chamber.map((time) => time.weekday));
    const lang = this.i18n.lang();
    return [6, 0, 1, 2, 3, 4, 5]
      .filter((weekday) => working.has(weekday))
      .map((weekday) => weekdayShort(weekday, lang))
      .join(' · ');
  });
}
