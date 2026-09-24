import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { ANONYMOUS_STRATEGY, PERMISSION_STRATEGIES } from './permission.strategies';
import type {
  DashboardWidgetKey,
  NavItem,
  Permission,
  PermissionStrategy,
} from './permission.model';

/**
 * Selects the strategy for the current role and exposes it as signals. Guards,
 * the sidebar and the dashboard all read from here, so role logic lives in
 * exactly one place (`permission.strategies.ts`).
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  readonly strategy = computed<PermissionStrategy>(() => {
    const role = this.auth.role();
    return role === null ? ANONYMOUS_STRATEGY : PERMISSION_STRATEGIES[role];
  });

  readonly navItems = computed<readonly NavItem[]>(() => this.strategy().navItems());

  readonly dashboardWidgets = computed<readonly DashboardWidgetKey[]>(() =>
    this.strategy().dashboardWidgets(),
  );

  readonly landingRoute = computed<string>(() => this.strategy().landingRoute());

  can(permission: Permission): boolean {
    return this.strategy().can(permission);
  }

  canAny(permissions: readonly Permission[]): boolean {
    const strategy = this.strategy();
    return permissions.some((permission) => strategy.can(permission));
  }

  canAll(permissions: readonly Permission[]): boolean {
    const strategy = this.strategy();
    return permissions.every((permission) => strategy.can(permission));
  }

  /** Signal-friendly variant for templates: `@if (canSignal('patients.manage')()) { ... }`. */
  hasPermission(permission: Permission) {
    return computed(() => this.strategy().can(permission));
  }
}
