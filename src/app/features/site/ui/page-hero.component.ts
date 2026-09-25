import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';

export interface Crumb {
  readonly label: string;
  readonly link?: string;
}

/** Banner at the top of every inner page: photo, breadcrumb, title and lead. */
@Component({
  selector: 'site-page-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RouterLink, IconComponent, ...I18N_PIPES],
  host: { class: 'block' },
  template: `
    <section class="relative isolate overflow-hidden bg-brand-950">
      <img [ngSrc]="image()" fill sizes="100vw" priority alt="" class="-z-20 object-cover opacity-70" />
      <div class="absolute inset-0 -z-10 bg-linear-to-r from-brand-950 via-brand-950/85 to-brand-900/40"></div>
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <nav aria-label="Breadcrumb" class="no-print">
          <ol class="flex flex-wrap items-center gap-1.5 text-sm text-white/65">
            <li>
              <a routerLink="/" class="transition-colors hover:text-white">{{ 'nav.home' | t }}</a>
            </li>
            @for (crumb of crumbs(); track crumb.label; let last = $last) {
              <li class="flex items-center gap-1.5">
                <hms-icon name="chevron-right" [size]="14" class="opacity-60" />
                @if (crumb.link && !last) {
                  <a [routerLink]="crumb.link" class="transition-colors hover:text-white">{{ crumb.label }}</a>
                } @else {
                  <span [attr.aria-current]="last ? 'page' : null" class="font-medium text-white">{{ crumb.label }}</span>
                }
              </li>
            }
          </ol>
        </nav>
        <h1 class="font-display mt-4 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">{{ title() }}</h1>
        @if (lead()) {
          <p class="mt-4 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">{{ lead() }}</p>
        }
        <ng-content />
      </div>
    </section>
  `,
})
export class PageHeroComponent {
  readonly title = input.required<string>();
  readonly lead = input('');
  readonly crumbs = input<readonly Crumb[]>([]);
  readonly image = input('/images/about/lobby.webp');
}
