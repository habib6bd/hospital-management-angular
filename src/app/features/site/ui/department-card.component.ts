import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import type { Department } from '../../../shared/models/public.model';

@Component({
  selector: 'site-department-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RouterLink, IconComponent, ...I18N_PIPES],
  host: { class: 'block h-full' },
  template: `
    @let d = department();
    <a
      [routerLink]="['/departments', d.slug]"
      class="group flex h-full flex-col overflow-hidden rounded-3xl bg-surface-raised shadow-soft ring-1 ring-slate-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-lift dark:ring-white/10"
    >
      <div class="relative aspect-[16/10] overflow-hidden">
        <img
          [ngSrc]="d.image"
          width="800"
          height="600"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          alt=""
          class="size-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div class="absolute inset-0 bg-linear-to-t from-brand-950/40 to-transparent"></div>
      </div>
      <div class="relative flex flex-1 flex-col px-5 pb-5 pt-9">
        <span
          class="absolute -top-6 left-5 flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-[0_8px_20px_-6px] shadow-brand-600/60 ring-4 ring-surface-raised transition-transform duration-300 group-hover:-translate-y-0.5"
          aria-hidden="true"
        >
          <hms-icon [name]="d.icon" [size]="22" />
        </span>
        <h3 class="font-display text-lg font-bold text-accent-950 dark:text-white">{{ d.name | loc }}</h3>
        <p class="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-surface-fg-muted">{{ d.summary | loc }}</p>
        <span class="mt-auto flex items-center justify-between pt-4 text-sm font-semibold text-brand-600 dark:text-brand-400">
          {{ 'department.doctorCount' | t: { n: d.doctorCount } }}
          <span class="flex size-8 items-center justify-center rounded-full bg-brand-50 transition-colors group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-950">
            <hms-icon name="arrow-right" [size]="16" />
          </span>
        </span>
      </div>
    </a>
  `,
})
export class DepartmentCardComponent {
  readonly department = input.required<Department>();
}
