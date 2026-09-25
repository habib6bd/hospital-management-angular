import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import type { TranslationKey } from '../../../core/i18n/dictionaries/en';
import { IconComponent, type IconName } from '../../../shared/ui/icon/icon.component';

interface AreaTab {
  readonly route: string;
  readonly label: TranslationKey;
  readonly icon: IconName;
  readonly exact: boolean;
}

/**
 * Frame for the signed-in patient's pages. The pages themselves are the
 * existing portal components; this adds the account header and tab bar so
 * they sit naturally inside the public site.
 */
@Component({
  selector: 'site-patient-area',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, ...I18N_PIPES],
  template: `
    <div class="border-b border-surface-border bg-surface-raised">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-wrap items-center justify-between gap-4 py-6">
          <div class="flex items-center gap-3">
            <span class="flex size-12 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white" aria-hidden="true">
              {{ (auth.user()?.firstName ?? '?').charAt(0) }}
            </span>
            <div>
              <p class="text-xs text-surface-fg-muted">{{ 'patient.welcome' | t }}</p>
              <h1 class="font-display text-lg font-bold text-accent-950 dark:text-white">{{ auth.user()?.fullName }}</h1>
            </div>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-surface-fg-muted ring-1 ring-slate-900/5 dark:ring-white/10 hover:bg-surface-sunken hover:text-surface-fg"
            (click)="signOut()"
          >
            <hms-icon name="logout" [size]="16" />
            {{ 'patient.signOut' | t }}
          </button>
        </div>
        <nav class="no-scrollbar -mb-px flex gap-1 overflow-x-auto" [attr.aria-label]="'patient.nav' | t">
          @for (tab of tabs; track tab.route) {
            <a
              [routerLink]="tab.route"
              routerLinkActive="border-brand-600! text-brand-700! dark:text-brand-300!"
              [routerLinkActiveOptions]="{ exact: tab.exact }"
              ariaCurrentWhenActive="page"
              class="flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-surface-fg-muted hover:text-surface-fg"
            >
              <hms-icon [name]="tab.icon" [size]="16" />
              {{ tab.label | t }}
            </a>
          }
        </nav>
      </div>
    </div>
    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <router-outlet />
    </div>
  `,
})
export class PatientAreaComponent {
  protected readonly auth = inject(AuthService);

  protected readonly tabs: readonly AreaTab[] = [
    { route: '/patient', label: 'patient.overview', icon: 'dashboard', exact: true },
    { route: '/patient/reports', label: 'patient.reports', icon: 'reports', exact: false },
    { route: '/patient/appointments', label: 'patient.appointments', icon: 'calendar', exact: false },
    { route: '/patient/billing', label: 'patient.bills', icon: 'billing', exact: false },
  ];

  protected async signOut(): Promise<void> {
    await this.auth.logout('/');
  }
}
