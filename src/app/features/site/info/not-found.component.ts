import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SeoService } from '../../../core/seo/seo.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SiteButtonDirective } from '../ui/site-button.directive';

@Component({
  selector: 'site-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SiteButtonDirective, ...I18N_PIPES],
  template: `
    <div class="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p class="text-7xl font-extrabold tracking-tight text-brand-600">{{ '404' | num }}</p>
      <h1 class="font-display mt-4 text-2xl font-bold text-accent-950 dark:text-white">{{ 'notFound.title' | t }}</h1>
      <p class="mt-2 text-surface-fg-muted">{{ 'notFound.text' | t }}</p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <a routerLink="/" siteBtn>{{ 'notFound.home' | t }}</a>
        <a routerLink="/doctors" siteBtn="outline">
          <hms-icon name="search" [size]="16" />
          {{ 'home.quick.find' | t }}
        </a>
      </div>
    </div>
  `,
})
export class NotFoundComponent {
  constructor() {
    const i18n = inject(I18nService);
    const seo = inject(SeoService);
    seo.notFound();
    effect(() => seo.set({ title: i18n.t('notFound.title') }));
  }
}
