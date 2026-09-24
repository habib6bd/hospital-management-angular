import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { PermissionService } from '../core/auth/permission.service';
import { ButtonComponent } from '../shared/ui/button/button.component';

/**
 * Shared 403/404 page. `code` and `message` come from route `data`, bound by
 * `withComponentInputBinding()`, so one component covers both routes.
 */
@Component({
  selector: 'hms-error-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <main class="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p class="text-5xl font-semibold text-brand-600">{{ code() }}</p>
      <h1 class="text-lg font-semibold text-surface-fg">{{ heading() }}</h1>
      <p class="max-w-md text-sm text-surface-fg-muted">{{ message() }}</p>
      <hms-button variant="secondary" (pressed)="goHome()">Go back</hms-button>
    </main>
  `,
})
export class ErrorPageComponent {
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionService);

  readonly code = input('404');
  readonly heading = input('Page not found');
  readonly message = input('The page you are looking for does not exist or has moved.');

  protected async goHome(): Promise<void> {
    await this.router.navigateByUrl(this.permissions.landingRoute());
  }
}
