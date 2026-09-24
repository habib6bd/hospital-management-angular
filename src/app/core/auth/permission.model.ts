import type { Role } from './auth.model';

/** Every guarded capability in the system. Guards and UI both reference these. */
export const PERMISSIONS = [
  'patients.view',
  'patients.manage',
  'patients.admit',
  'appointments.view',
  'appointments.manage',
  'appointments.queue',
  'inventory.view',
  'inventory.manage',
  'lab.view',
  'lab.order',
  'lab.result',
  'billing.view',
  'billing.manage',
  'dashboard.view',
  'portal.view',
  'notifications.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface NavItem {
  readonly label: string;
  readonly route: string;
  readonly icon: NavIcon;
  /** Optional badge signal key resolved by the sidebar (e.g. low-stock count). */
  readonly badgeKey?: 'lowStock' | 'queue' | 'unreadReports';
}

export type NavIcon =
  | 'dashboard'
  | 'patients'
  | 'calendar'
  | 'inventory'
  | 'lab'
  | 'billing'
  | 'reports'
  | 'bell'
  | 'settings';

export type DashboardWidgetKey =
  | 'patient-inflow'
  | 'bed-occupancy'
  | 'revenue'
  | 'inventory-alerts'
  | 'opd-queue'
  | 'pending-lab-orders'
  | 'my-appointments';

/**
 * Strategy contract. One implementation per role; `PermissionService` selects
 * the right one, so no `switch (role)` ever appears outside this folder.
 */
export interface PermissionStrategy {
  readonly role: Role;
  can(permission: Permission): boolean;
  navItems(): readonly NavItem[];
  dashboardWidgets(): readonly DashboardWidgetKey[];
  /** Route to land on immediately after sign-in. */
  landingRoute(): string;
}
