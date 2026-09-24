import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PermissionService } from '../core/auth/permission.service';
import { IconComponent } from '../shared/ui/icon/icon.component';

/**
 * Role-aware navigation. The item list comes straight from
 * `PermissionService.navItems()` — the sidebar has no role knowledge of its own,
 * so adding a role is a one-line change in `permission.strategies.ts`.
 */
@Component({
  selector: 'hms-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <nav
      class="flex h-full flex-col bg-surface-raised ring-1 ring-surface-border"
      aria-label="Main navigation"
    >
      <div class="flex h-14 items-center gap-2.5 border-b border-surface-border px-4">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-control bg-brand-600 text-white"
          aria-hidden="true"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
        </span>
        @if (!collapsed()) {
          <span class="truncate text-sm font-semibold text-surface-fg">HMS</span>
        }
      </div>

      <ul class="hms-scrollbar flex-1 space-y-0.5 overflow-y-auto p-2">
        @for (item of navItems(); track item.route) {
          <li>
            <a
              [routerLink]="item.route"
              routerLinkActive="bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
              [routerLinkActiveOptions]="{ exact: false }"
              #link="routerLinkActive"
              [attr.aria-current]="link.isActive ? 'page' : null"
              [attr.title]="collapsed() ? item.label : null"
              class="flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium text-surface-fg-muted transition-colors hover:bg-surface-sunken hover:text-surface-fg"
              (click)="navigated.emit()"
            >
              <hms-icon [name]="item.icon" [size]="18" />
              @if (!collapsed()) {
                <span class="truncate">{{ item.label }}</span>
              } @else {
                <span class="sr-only-focusable">{{ item.label }}</span>
              }
            </a>
          </li>
        }
      </ul>

      <div class="border-t border-surface-border p-2">
        <button
          type="button"
          class="hidden w-full items-center gap-3 rounded-control px-3 py-2 text-sm text-surface-fg-muted transition-colors hover:bg-surface-sunken hover:text-surface-fg lg:flex"
          [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
          [attr.aria-expanded]="!collapsed()"
          (click)="collapseToggled.emit()"
        >
          <span class="transition-transform" [class.rotate-180]="collapsed()">
            <hms-icon name="chevron-left" [size]="18" />
          </span>
          @if (!collapsed()) {
            <span>Collapse</span>
          }
        </button>
      </div>
    </nav>
  `,
})
export class SidebarComponent {
  private readonly permissions = inject(PermissionService);

  readonly collapsed = input(false);
  readonly collapseToggled = output<void>();
  /** Lets the shell close the mobile drawer after a navigation. */
  readonly navigated = output<void>();

  protected readonly navItems = this.permissions.navItems;
}
