import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';

/**
 * Authenticated application frame. Two sidebar behaviours:
 *  - desktop (lg+): a persistent rail that collapses to icons;
 *  - mobile: an overlay drawer that closes on navigation.
 */
@Component({
  selector: 'hms-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <div class="flex h-dvh overflow-hidden bg-surface-sunken">
      <a
        href="#main-content"
        class="sr-only-focusable absolute left-4 top-4 z-50 rounded-control bg-brand-600 px-3 py-2 text-sm text-white"
      >
        Skip to main content
      </a>

      <!-- Desktop rail -->
      <aside
        class="hidden shrink-0 transition-[width] duration-200 lg:block"
        [class]="collapsed() ? 'w-16' : 'w-60'"
      >
        <hms-sidebar [collapsed]="collapsed()" (collapseToggled)="toggleCollapsed()" />
      </aside>

      <!-- Mobile drawer -->
      @if (drawerOpen()) {
        <div class="fixed inset-0 z-40 lg:hidden">
          <div
            class="absolute inset-0 bg-black/40"
            aria-hidden="true"
            (click)="drawerOpen.set(false)"
          ></div>
          <div class="absolute inset-y-0 left-0 w-60" role="dialog" aria-modal="true" aria-label="Navigation">
            <hms-sidebar (navigated)="drawerOpen.set(false)" />
          </div>
        </div>
      }

      <div class="flex min-w-0 flex-1 flex-col">
        <hms-topbar (menuToggled)="drawerOpen.set(true)" />
        <main
          id="main-content"
          class="hms-scrollbar flex-1 overflow-y-auto p-4 sm:p-6"
          tabindex="-1"
        >
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  protected readonly collapsed = signal(false);
  protected readonly drawerOpen = signal(false);

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }
}
