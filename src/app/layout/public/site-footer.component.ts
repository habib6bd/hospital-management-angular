import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_CONFIG } from '../../core/config/site-config';
import { I18N_PIPES } from '../../core/i18n/i18n.pipes';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PublicSiteService } from '../../features/site/public-site.service';
import { SiteLogoComponent } from './site-logo.component';

@Component({
  selector: 'site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SiteLogoComponent, ...I18N_PIPES],
  host: { class: 'block' },
  template: `
    <footer class="no-print bg-brand-950 text-white/70" aria-labelledby="footer-heading">
      <h2 id="footer-heading" class="sr-only-focusable">{{ 'footer.heading' | t }}</h2>
      <div class="mx-auto max-w-7xl px-4 pb-8 pt-14 sm:px-6 lg:px-8">
        <div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
          <div class="lg:col-span-4">
            <site-logo [inverse]="true" />
            <p class="mt-4 max-w-sm text-sm leading-relaxed">{{ 'footer.about' | t: { year: site.established } }}</p>
            <ul class="mt-5 flex gap-2">
              @for (link of site.social; track link.url) {
                <li>
                  <a
                    [href]="link.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-brand-500"
                    [attr.aria-label]="link.label"
                  >
                    <hms-icon [name]="link.icon" [size]="16" />
                  </a>
                </li>
              }
            </ul>
          </div>

          <div class="lg:col-span-2">
            <h3 class="text-sm font-semibold text-white">{{ 'footer.quickLinks' | t }}</h3>
            <ul class="mt-4 space-y-2.5 text-sm">
              <li><a routerLink="/doctors" class="hover:text-white">{{ 'nav.doctors' | t }}</a></li>
              <li><a routerLink="/book" class="hover:text-white">{{ 'cta.bookAppointment' | t }}</a></li>
              <li><a routerLink="/patient/reports" class="hover:text-white">{{ 'nav.reports' | t }}</a></li>
              <li><a routerLink="/services/health-checkup" class="hover:text-white">{{ 'footer.packages' | t }}</a></li>
              <li><a routerLink="/about" class="hover:text-white">{{ 'nav.about' | t }}</a></li>
              <li><a routerLink="/contact" class="hover:text-white">{{ 'nav.contact' | t }}</a></li>
            </ul>
          </div>

          <div class="lg:col-span-3">
            <h3 class="text-sm font-semibold text-white">{{ 'nav.departments' | t }}</h3>
            <ul class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm lg:grid-cols-1">
              @for (department of departments(); track department.slug) {
                <li>
                  <a [routerLink]="['/departments', department.slug]" class="hover:text-white">{{ department.name | loc }}</a>
                </li>
              }
            </ul>
          </div>

          <div class="lg:col-span-3">
            <h3 class="text-sm font-semibold text-white">{{ 'footer.contact' | t }}</h3>
            <ul class="mt-4 space-y-3 text-sm">
              <li class="flex gap-3">
                <hms-icon name="map-pin" [size]="18" class="mt-0.5 shrink-0 text-brand-400" />
                <a [href]="site.mapLink" target="_blank" rel="noopener noreferrer" class="hover:text-white">{{ site.address | loc }}</a>
              </li>
              <li class="flex gap-3">
                <hms-icon name="phone" [size]="18" class="mt-0.5 shrink-0 text-brand-400" />
                <span>
                  <a [href]="'tel:' + site.hotline" class="hover:text-white">{{ 'top.hotline' | t }}: {{ site.hotline | num }}</a><br />
                  <a [href]="'tel:' + site.emergency" class="font-semibold text-white hover:underline">
                    {{ 'top.emergency' | t }}: {{ site.emergency | num }}
                  </a>
                </span>
              </li>
              <li class="flex gap-3">
                <hms-icon name="mail" [size]="18" class="mt-0.5 shrink-0 text-brand-400" />
                <a [href]="'mailto:' + site.email" class="break-all hover:text-white">{{ site.email }}</a>
              </li>
              <li class="flex gap-3">
                <hms-icon name="clock" [size]="18" class="mt-0.5 shrink-0 text-brand-400" />
                <span>{{ site.opdHours | loc }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {{ year | num }} {{ site.name | loc }}. {{ 'footer.rights' | t }}</p>
          <a routerLink="/login" class="text-white/50 hover:text-white">{{ 'nav.login' | t }}</a>
        </div>
      </div>
    </footer>
  `,
})
export class SiteFooterComponent {
  private readonly siteData = inject(PublicSiteService);

  protected readonly site = SITE_CONFIG;
  protected readonly year = new Date().getFullYear();
  protected readonly departments = computed(() => this.siteData.departments());
}
