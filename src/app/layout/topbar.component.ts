import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { LoadingService } from '../core/services/loading.service';
import { ROLE_LABELS } from '../core/auth/auth.model';
import { IconComponent } from '../shared/ui/icon/icon.component';

@Component({
  selector: 'hms-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <header
      class="relative flex h-14 items-center gap-2 border-b border-surface-border bg-surface-raised px-3 sm:px-4"
    >
      <!-- Global progress bar, fed by the loading interceptor. -->
      @if (isLoading()) {
        <div
          class="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-brand-100 dark:bg-brand-950"
          role="status"
          aria-label="Loading"
        >
          <div class="h-full w-1/3 animate-pulse bg-brand-500"></div>
        </div>
      }

      <button
        type="button"
        class="rounded-control p-2 text-surface-fg-muted transition-colors hover:bg-surface-sunken hover:text-surface-fg lg:hidden"
        aria-label="Open navigation menu"
        (click)="menuToggled.emit()"
      >
        <hms-icon name="menu" />
      </button>

      <div class="flex-1"></div>

      <button
        type="button"
        class="rounded-control p-2 text-surface-fg-muted transition-colors hover:bg-surface-sunken hover:text-surface-fg"
        [attr.aria-label]="'Switch to ' + (theme.resolved() === 'dark' ? 'light' : 'dark') + ' theme'"
        (click)="theme.toggle()"
      >
        <hms-icon [name]="theme.resolved() === 'dark' ? 'sun' : 'moon'" />
      </button>

      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-2 rounded-control p-1.5 pr-2 transition-colors hover:bg-surface-sunken"
          [attr.aria-expanded]="menuOpen()"
          aria-haspopup="menu"
          [attr.aria-label]="'Account menu for ' + (user()?.fullName ?? '')"
          (click)="toggleMenu()"
        >
          <span
            class="flex size-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white"
            aria-hidden="true"
          >
            {{ initials() }}
          </span>
          <span class="hidden text-left sm:block">
            <span class="block text-xs font-medium leading-tight text-surface-fg">
              {{ user()?.fullName }}
            </span>
            <span class="block text-[11px] leading-tight text-surface-fg-muted">
              {{ roleLabel() }}
            </span>
          </span>
        </button>

        @if (menuOpen()) {
          <!-- Click-away backdrop; keyboard users close with Escape on the menu. -->
          <div class="fixed inset-0 z-10" aria-hidden="true" (click)="menuOpen.set(false)"></div>
          <div
            class="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-card bg-surface-raised py-1 shadow-lg ring-1 ring-surface-border"
            role="menu"
            (keydown.escape)="menuOpen.set(false)"
          >
            <div class="border-b border-surface-border px-3 py-2">
              <p class="truncate text-xs font-medium text-surface-fg">{{ user()?.fullName }}</p>
              <p class="truncate text-[11px] text-surface-fg-muted">{{ user()?.email }}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-surface-fg-muted transition-colors hover:bg-surface-sunken hover:text-surface-fg"
              (click)="signOut()"
            >
              <hms-icon name="logout" [size]="16" />
              Sign out
            </button>
          </div>
        }
      </div>
    </header>
  `,
})
export class TopbarComponent {
  private readonly auth = inject(AuthService);
  private readonly loading = inject(LoadingService);
  protected readonly theme = inject(ThemeService);

  readonly menuToggled = output<void>();

  protected readonly user = this.auth.user;
  protected readonly isLoading = this.loading.isLoading;
  protected readonly menuOpen = signal(false);

  protected readonly roleLabel = computed(() => {
    const role = this.auth.role();
    return role === null ? '' : ROLE_LABELS[role];
  });

  protected readonly initials = computed(() => {
    const current = this.user();
    if (current === null) {
      return '?';
    }
    const first = current.firstName.charAt(0);
    const last = current.lastName.charAt(0);
    const combined = `${first}${last}`.trim();
    return combined === '' ? current.username.charAt(0).toUpperCase() : combined.toUpperCase();
  });

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected async signOut(): Promise<void> {
    this.menuOpen.set(false);
    await this.auth.logout();
  }
}
