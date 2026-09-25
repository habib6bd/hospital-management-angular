import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SITE_CONFIG } from '../../core/config/site-config';
import { I18N_PIPES } from '../../core/i18n/i18n.pipes';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';

/**
 * Frame for the public website and the patient area. Anyone can see it; the
 * patient routes inside it carry their own guards.
 */
@Component({
  selector: 'site-public-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, IconComponent, SiteHeaderComponent, SiteFooterComponent, ...I18N_PIPES],
  template: `
    <a
      href="#main"
      class="sr-only-focusable fixed left-4 top-4 z-50 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
    >
      {{ 'nav.skip' | t }}
    </a>

    <div class="flex min-h-dvh flex-col bg-surface">
      <site-header />
      <!-- Bottom padding on mobile keeps the action bar from covering content. -->
      <main id="main" tabindex="-1" class="flex-1 pb-16 focus:outline-none lg:pb-0">
        <router-outlet />
      </main>
      <site-footer class="pb-16 lg:pb-0" />
    </div>

    <!-- Mobile action bar: call and book are the two things a phone visitor
         most often came to do, so they stay one tap away. -->
    <nav
      class="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-surface-border bg-surface-raised/95 backdrop-blur lg:hidden"
      [attr.aria-label]="'nav.quick' | t"
    >
      <a [href]="'tel:' + site.emergency" class="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-emergency">
        <hms-icon name="siren" [size]="20" />
        {{ 'top.emergency' | t }}
      </a>
      <a routerLink="/book" class="flex flex-col items-center gap-0.5 bg-brand-600 py-2 text-[11px] font-semibold text-white">
        <hms-icon name="calendar" [size]="20" />
        {{ 'cta.book' | t }}
      </a>
      <a routerLink="/patient/reports" class="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-surface-fg">
        <hms-icon name="download" [size]="20" />
        {{ 'nav.reportsShort' | t }}
      </a>
    </nav>

    <a
      [href]="'https://wa.me/' + site.whatsapp"
      target="_blank"
      rel="noopener noreferrer"
      class="no-print fixed bottom-6 right-6 z-30 hidden size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition-transform hover:scale-105 lg:flex"
      [attr.aria-label]="'top.whatsapp' | t"
    >
      <hms-icon name="whatsapp" [size]="26" />
    </a>
  `,
})
export class PublicShellComponent {
  protected readonly site = SITE_CONFIG;
}
