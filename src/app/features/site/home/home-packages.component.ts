import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PublicSiteService } from '../public-site.service';
import { RevealDirective } from '../ui/reveal.directive';
import { SectionHeadingComponent } from '../ui/section-heading.component';
import { SiteButtonDirective } from '../ui/site-button.directive';

@Component({
  selector: 'site-home-packages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, RevealDirective, SectionHeadingComponent, SiteButtonDirective, ...I18N_PIPES],
  host: { class: 'block' },
  template: `
    <section class="py-20 lg:py-28" aria-labelledby="packages-heading">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <site-section-heading
          headingId="packages-heading"
          [eyebrow]="'home.packages.eyebrow' | t"
          [title]="'home.packages.title' | t"
          [lead]="'home.packages.lead' | t"
        />
        <div class="mx-auto mt-14 grid max-w-6xl items-center gap-6 md:grid-cols-3" siteReveal="article">
          @for (pkg of site.packages(); track pkg.id) {
            <article
              class="relative flex flex-col rounded-3xl p-8"
              [class]="pkg.isPopular
                ? 'bg-linear-to-b from-brand-600 to-brand-800 text-white shadow-lift md:py-11'
                : 'bg-surface-raised shadow-soft ring-1 ring-slate-900/5 dark:ring-white/10'"
            >
              @if (pkg.isPopular) {
                <span class="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-brand-700 shadow-soft">
                  {{ 'home.packages.popular' | t }}
                </span>
              }
              <h3 class="font-display text-xl font-bold" [class]="pkg.isPopular ? '' : 'text-accent-950 dark:text-white'">
                {{ pkg.name | loc }}
              </h3>
              <p class="mt-4 flex items-baseline gap-1">
                <span class="font-display text-4xl font-extrabold tracking-tight">৳{{ pkg.price | num }}</span>
              </p>
              <ul class="mt-7 flex-1 space-y-3.5 text-sm">
                @for (test of pkg.tests; track $index) {
                  <li class="flex gap-3">
                    <span
                      class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                      [class]="pkg.isPopular ? 'bg-white/20 text-white' : 'bg-mint-50 text-mint-600'"
                    >
                      <hms-icon name="check" [size]="13" />
                    </span>
                    <span [class]="pkg.isPopular ? 'text-white/90' : 'text-slate-700 dark:text-surface-fg'">{{ test | loc }}</span>
                  </li>
                }
              </ul>
              <a
                routerLink="/contact"
                [queryParams]="{ subject: 'package' }"
                [siteBtn]="pkg.isPopular ? 'white' : 'outline'"
                class="mt-9 w-full"
              >
                {{ 'home.packages.enquire' | t }}
              </a>
            </article>
          }
        </div>
      </div>
    </section>
  `,
})
export class HomePackagesComponent {
  protected readonly site = inject(PublicSiteService);
}
