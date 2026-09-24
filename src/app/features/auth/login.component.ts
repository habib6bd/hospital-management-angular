import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormField, form, required, schema, submit } from '@angular/forms/signals';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/auth/permission.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { DEMO_ACCOUNTS } from '../../core/mock/db';
import { ROLE_LABELS, isRole } from '../../core/auth/auth.model';
import { fieldError } from '../../core/http/api-error';

interface LoginModel {
  username: string;
  password: string;
}

const loginSchema = schema<LoginModel>((path) => {
  required(path.username, { message: 'Username is required.' });
  required(path.password, { message: 'Password is required.' });
});

@Component({
  selector: 'hms-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, ButtonComponent, FormFieldComponent],
  template: `
    <main class="flex min-h-dvh items-center justify-center bg-surface-sunken px-4 py-10">
      <div class="w-full max-w-sm">
        <div class="mb-8 text-center">
          <div
            class="mx-auto mb-4 flex size-12 items-center justify-center rounded-card bg-brand-600 text-white"
            aria-hidden="true"
          >
            <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
          </div>
          <h1 class="text-xl font-semibold text-surface-fg">Hospital Management System</h1>
          <p class="mt-1 text-sm text-surface-fg-muted">Sign in to continue</p>
        </div>

        <form
          class="rounded-card bg-surface-raised p-6 shadow-sm ring-1 ring-surface-border"
          (submit)="onSubmit($event)"
        >
          <div class="flex flex-col gap-4">
            <hms-form-field
              label="Username"
              controlId="login-username"
              [field]="loginForm.username"
              [required]="true"
              [serverError]="serverError('username')"
            >
              <input
                id="login-username"
                type="text"
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
                class="h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border placeholder:text-surface-fg-muted focus:ring-2 focus:ring-brand-500"
                [formField]="loginForm.username"
              />
            </hms-form-field>

            <hms-form-field
              label="Password"
              controlId="login-password"
              [field]="loginForm.password"
              [required]="true"
              [serverError]="serverError('password')"
            >
              <input
                id="login-password"
                type="password"
                autocomplete="current-password"
                class="h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border placeholder:text-surface-fg-muted focus:ring-2 focus:ring-brand-500"
                [formField]="loginForm.password"
              />
            </hms-form-field>

            @if (generalError() !== null) {
              <p
                class="rounded-control bg-status-critical-soft px-3 py-2 text-xs text-status-critical-strong"
                role="alert"
              >
                {{ generalError() }}
              </p>
            }

            <hms-button
              type="submit"
              [fullWidth]="true"
              [loading]="auth.isAuthenticating()"
              [disabled]="auth.isAuthenticating()"
            >
              Sign in
            </hms-button>
          </div>
        </form>

        <!-- Mock-backend affordance: removed once Django is wired up. -->
        @if (demoAccounts.length > 0) {
          <section class="mt-6 rounded-card bg-surface-raised p-4 ring-1 ring-surface-border">
            <h2 class="text-xs font-semibold text-surface-fg">Demo accounts</h2>
            <p class="mt-0.5 text-xs text-surface-fg-muted">
              All use the password <code class="font-mono">demo1234</code>.
            </p>
            <ul class="mt-3 grid grid-cols-2 gap-1.5">
              @for (account of demoAccounts; track account.username) {
                <li>
                  <button
                    type="button"
                    class="w-full rounded-control px-2 py-1.5 text-left text-xs text-surface-fg-muted transition-colors hover:bg-surface-sunken hover:text-surface-fg"
                    (click)="useDemoAccount(account.username, account.password)"
                  >
                    <span class="block font-medium text-surface-fg">{{ roleLabel(account.role) }}</span>
                    <span class="font-mono">{{ account.username }}</span>
                  </button>
                </li>
              }
            </ul>
          </section>
        }
      </div>
    </main>
  `,
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly model = signal<LoginModel>({ username: '', password: '' });
  protected readonly loginForm = form(this.model, loginSchema);

  protected readonly demoAccounts = DEMO_ACCOUNTS;

  protected readonly generalError = computed(() => {
    const error = this.auth.error();
    if (error === null) {
      return null;
    }
    // Field-specific messages render on the field itself.
    return Object.keys(error.fieldErrors).length === 0 ? error.message : null;
  });

  protected serverError(field: string): string | null {
    return fieldError(this.auth.error(), field);
  }

  protected roleLabel(role: string): string {
    return isRole(role) ? ROLE_LABELS[role] : role;
  }

  protected useDemoAccount(username: string, password: string): void {
    this.model.set({ username, password });
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();

    await submit(this.loginForm, async () => {
      const success = await this.auth.login(this.model());
      if (!success) {
        // The error is already on `auth.error()`; returning it here keeps the
        // form in an invalid state rather than clearing the fields.
        return { kind: 'credentials', message: 'Sign in failed.' };
      }

      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      await this.router.navigateByUrl(returnUrl ?? this.permissions.landingRoute());
      return null;
    });
  }
}
