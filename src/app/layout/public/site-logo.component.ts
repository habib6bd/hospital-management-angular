import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_CONFIG } from '../../core/config/site-config';
import { I18N_PIPES } from '../../core/i18n/i18n.pipes';

@Component({
  selector: 'site-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ...I18N_PIPES],
  template: `
    <a routerLink="/" class="flex min-w-0 items-center gap-2.5" [attr.aria-label]="site.name | loc">
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-sm lg:size-11"
        aria-hidden="true"
      >
        <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <span class="min-w-0 leading-tight" aria-hidden="true">
        <span class="font-display block truncate text-base font-extrabold tracking-tight lg:text-lg" [class]="inverse() ? 'text-white' : 'text-accent-900 dark:text-white'">
          {{ site.name | loc }}
        </span>
        @if (!compact()) {
          <span class="hidden truncate text-xs sm:block" [class]="inverse() ? 'text-white/70' : 'text-surface-fg-muted'">
            {{ site.tagline | loc }}
          </span>
        }
      </span>
    </a>
  `,
})
export class SiteLogoComponent {
  readonly compact = input(false);
  /** For use on the navy footer. */
  readonly inverse = input(false);

  protected readonly site = SITE_CONFIG;
}
