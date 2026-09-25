import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormField, form, schema, submit, validate } from '@angular/forms/signals';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/auth/permission.service';
import { ROLE_LABELS, isRole } from '../../../core/auth/auth.model';
import { APP_CONFIG } from '../../../core/config/app-config';
import { SITE_CONFIG } from '../../../core/config/site-config';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SeoService } from '../../../core/seo/seo.service';
import { fieldError } from '../../../core/http/api-error';
import { DEMO_ACCOUNTS } from '../../../core/mock/db';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { SiteButtonDirective } from '../ui/site-button.directive';

interface LoginModel {
  username: string;
  password: string;
}

const INPUT_CLASS =
  'h-12 w-full rounded-xl bg-surface px-4 text-sm text-surface-fg ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 dark:ring-white/15';

/** Only same-site paths are honoured, so `returnUrl` cannot bounce a visitor off-site. */
function safeReturnUrl(value: string | undefined): string | null {
  return value !== undefined && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

/**
 * The one sign-in page, for staff and patients alike. After signing in, each
 * role lands on its own dashboard (see `permission.strategies.ts`) unless a
 * guard sent them here with a `returnUrl`.
 */
@Component({
  selector: 'site-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RouterLink, FormField, IconComponent, FormFieldComponent, SiteButtonDirective, ...I18N_PIPES],
  template: `
    <div class="bg-tint">
      <div class="mx-auto grid min-h-[calc(100dvh-8rem)] max-w-7xl items-stretch gap-0 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-16">
        <!-- Photo panel -->
        <div class="relative isolate hidden overflow-hidden rounded-[2rem] lg:flex lg:flex-col lg:justify-end">
          <img ngSrc="/images/about/reception.webp" fill sizes="50vw" priority alt="" class="-z-20 object-cover" />
          <div class="absolute inset-0 -z-10 bg-linear-to-t from-brand-950 via-brand-950/50 to-brand-950/10"></div>
          <div class="p-10 text-white">
            <p class="font-display text-3xl font-bold leading-tight">{{ 'login.panelTitle' | t }}</p>
            <ul class="mt-6 space-y-3">
              @for (point of points; track point.text) {
                <li class="flex items-center gap-3 text-sm text-white/85">
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                    <hms-icon [name]="point.icon" [size]="18" />
                  </span>
                  {{ point.text | t }}
                </li>
              }
            </ul>
          </div>
        </div>

        <!-- Form -->
        <div class="flex items-center justify-center">
          <div class="w-full max-w-md">
            <form class="rounded-[2rem] bg-surface-raised p-7 shadow-lift ring-1 ring-slate-900/5 sm:p-10 dark:ring-white/10" novalidate (submit)="onSubmit($event)">
              <span class="flex size-13 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-[0_8px_20px_-6px] shadow-brand-600/60">
                <hms-icon name="lock" [size]="24" />
              </span>
              <h1 class="font-display mt-6 text-3xl font-bold tracking-tight text-accent-950 dark:text-white">{{ 'login.title' | t }}</h1>
              <p class="mt-2 text-sm text-slate-500 dark:text-surface-fg-muted">{{ 'login.lead' | t }}</p>

              <div class="mt-8 space-y-5">
                <hms-form-field [label]="'login.username' | t" controlId="login-username" [field]="loginForm.username" [required]="true" [serverError]="serverError('username')">
                  <input id="login-username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" [class]="inputClass" [formField]="loginForm.username" />
                </hms-form-field>
                <hms-form-field [label]="'login.password' | t" controlId="login-password" [field]="loginForm.password" [required]="true" [serverError]="serverError('password')">
                  <div class="relative">
                    <input
                      id="login-password"
                      [type]="showPassword() ? 'text' : 'password'"
                      autocomplete="current-password"
                      [class]="inputClass + ' pr-20'"
                      [formField]="loginForm.password"
                    />
                    <button
                      type="button"
                      class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950"
                      [attr.aria-pressed]="showPassword()"
                      (click)="showPassword.set(!showPassword())"
                    >
                      {{ (showPassword() ? 'login.hide' : 'login.show') | t }}
                    </button>
                  </div>
                </hms-form-field>

                @if (message(); as text) {
                  <p class="flex gap-2 rounded-xl bg-emergency-soft px-4 py-3 text-sm text-emergency-strong" role="alert">
                    <hms-icon name="info" [size]="18" class="mt-0.5 shrink-0" />
                    {{ text }}
                  </p>
                }

                <button type="submit" siteBtn size="lg" class="w-full" [disabled]="auth.isAuthenticating()">
                  @if (auth.isAuthenticating()) {
                    <svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                    </svg>
                  }
                  {{ 'login.submit' | t }}
                </button>
              </div>

              <p class="mt-6 text-center text-sm text-slate-500 dark:text-surface-fg-muted">
                {{ 'login.noAccount' | t }}
                <a [href]="'tel:' + site.hotline" class="font-semibold text-brand-600 hover:underline">{{ site.hotline | num }}</a>
              </p>
            </form>

            <!-- Mock-backend affordance: removed once Django is wired up. -->
            @if (showDemo) {
              <details class="group mt-5 rounded-2xl bg-surface-raised p-4 ring-1 ring-slate-900/5 dark:ring-white/10">
                <summary class="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-accent-950 dark:text-white">
                  {{ 'login.demo' | t }}
                  <hms-icon name="chevron-down" [size]="16" class="transition-transform group-open:rotate-180" />
                </summary>
                <p class="mt-2 text-xs text-slate-500">{{ 'login.demoHint' | t }} <code class="font-mono">demo1234</code></p>
                <ul class="mt-3 grid grid-cols-2 gap-1.5">
                  @for (account of demoAccounts; track account.username) {
                    <li>
                      <button
                        type="button"
                        class="w-full rounded-xl px-3 py-2 text-left text-xs ring-1 ring-slate-100 transition hover:bg-tint hover:ring-brand-200 dark:ring-white/10"
                        (click)="useDemo(account.username, account.password)"
                      >
                        <span class="block font-semibold text-accent-950 dark:text-white">{{ roleLabel(account.role) }}</span>
                        <span class="font-mono text-slate-500">{{ account.username }}</span>
                      </button>
                    </li>
                  }
                </ul>
              </details>
            }

            <p class="mt-6 text-center">
              <a routerLink="/" class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600">
                <hms-icon name="chevron-left" [size]="16" />
                {{ 'login.back' | t }}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly site = SITE_CONFIG;
  protected readonly inputClass = INPUT_CLASS;
  protected readonly showDemo = inject(APP_CONFIG).useMockApi;
  protected readonly demoAccounts = DEMO_ACCOUNTS;
  protected readonly showPassword = signal(false);
  protected readonly points = [
    { icon: 'download' as const, text: 'login.point1' as const },
    { icon: 'calendar' as const, text: 'login.point2' as const },
    { icon: 'dashboard' as const, text: 'login.point3' as const },
  ];

  /** `?returnUrl=`, set by the guards when a protected page needed a session. */
  readonly returnUrl = input<string | undefined>(undefined);

  private readonly model = signal<LoginModel>({ username: '', password: '' });
  protected readonly loginForm = form(
    this.model,
    schema<LoginModel>((path) => {
      validate(path.username, ({ value }) =>
        value().trim() === '' ? { kind: 'required', message: this.i18n.t('login.errUsername') } : null,
      );
      validate(path.password, ({ value }) =>
        value() === '' ? { kind: 'required', message: this.i18n.t('login.errPassword') } : null,
      );
    }),
  );

  protected readonly message = computed(() => {
    const error = this.auth.error();
    if (error === null || Object.keys(error.fieldErrors).length > 0) {
      return null;
    }
    return error.status === 401 || error.status === 400 ? this.i18n.t('login.invalid') : error.message;
  });

  constructor() {
    const seo = inject(SeoService);
    effect(() => seo.set({ title: this.i18n.t('login.title'), description: this.i18n.t('login.lead') }));
  }

  protected serverError(field: string): string | null {
    return fieldError(this.auth.error(), field);
  }

  protected roleLabel(role: string): string {
    return isRole(role) ? ROLE_LABELS[role] : role;
  }

  protected useDemo(username: string, password: string): void {
    this.model.set({ username, password });
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.loginForm, async () => {
      const success = await this.auth.login(this.model());
      if (!success) {
        // The error is on `auth.error()`; returning one keeps the form invalid.
        return { kind: 'credentials', message: 'Sign in failed.' };
      }
      // Each role has its own landing page: doctors their dashboard,
      // reception the appointment book, patients their portal, and so on.
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? this.permissions.landingRoute());
      return null;
    });
  }
}
