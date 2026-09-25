import type { Role } from './auth.model';
import type {
  DashboardWidgetKey,
  NavItem,
  Permission,
  PermissionStrategy,
} from './permission.model';

const NAV = {
  dashboard: { label: 'Dashboard', route: '/app/dashboard', icon: 'dashboard' },
  patients: { label: 'Patients', route: '/app/patients', icon: 'patients' },
  appointments: { label: 'Appointments', route: '/app/appointments', icon: 'calendar' },
  queue: { label: 'OPD Queue', route: '/app/appointments/queue', icon: 'calendar', badgeKey: 'queue' },
  inventory: {
    label: 'Inventory',
    route: '/app/inventory',
    icon: 'inventory',
    badgeKey: 'lowStock',
  },
  beds: { label: 'Ward & Beds', route: '/app/patients/beds', icon: 'patients' },
  lab: { label: 'Lab & Diagnostics', route: '/app/lab', icon: 'lab' },
  billing: { label: 'Billing', route: '/app/billing', icon: 'billing' },
  myReports: {
    label: 'My Reports',
    route: '/patient/reports',
    icon: 'reports',
    badgeKey: 'unreadReports',
  },
  myAppointments: { label: 'My Appointments', route: '/patient/appointments', icon: 'calendar' },
  myBills: { label: 'My Bills', route: '/patient/billing', icon: 'billing' },
} as const satisfies Record<string, NavItem>;

/**
 * Declarative strategy definition. Building the objects from this table keeps
 * the role matrix readable and reviewable in one place — which is the point of
 * using a strategy per role rather than scattered `if (role === ...)` checks.
 */
interface RoleDefinition {
  readonly permissions: readonly Permission[];
  readonly nav: readonly NavItem[];
  readonly widgets: readonly DashboardWidgetKey[];
  readonly landing: string;
}

const ROLE_DEFINITIONS: Readonly<Record<Role, RoleDefinition>> = {
  admin: {
    permissions: [
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
      'notifications.view',
    ],
    nav: [
      NAV.dashboard,
      NAV.patients,
      NAV.beds,
      NAV.appointments,
      NAV.inventory,
      NAV.lab,
      NAV.billing,
    ],
    widgets: ['patient-inflow', 'bed-occupancy', 'revenue', 'inventory-alerts', 'opd-queue'],
    landing: '/app/dashboard',
  },

  doctor: {
    permissions: [
      'patients.view',
      'patients.manage',
      'patients.admit',
      'appointments.view',
      'appointments.manage',
      'appointments.queue',
      'lab.view',
      'lab.order',
      'dashboard.view',
      'notifications.view',
    ],
    nav: [NAV.dashboard, NAV.patients, NAV.beds, NAV.appointments, NAV.queue, NAV.lab],
    widgets: ['my-appointments', 'opd-queue', 'pending-lab-orders', 'bed-occupancy'],
    landing: '/app/dashboard',
  },

  nurse: {
    permissions: [
      'patients.view',
      'patients.manage',
      'patients.admit',
      'appointments.view',
      'appointments.queue',
      'inventory.view',
      'lab.view',
      'dashboard.view',
      'notifications.view',
    ],
    nav: [NAV.dashboard, NAV.patients, NAV.beds, NAV.queue, NAV.inventory, NAV.lab],
    widgets: ['bed-occupancy', 'opd-queue', 'inventory-alerts'],
    landing: '/app/patients',
  },

  receptionist: {
    permissions: [
      'patients.view',
      'patients.manage',
      'appointments.view',
      'appointments.manage',
      'appointments.queue',
      'billing.view',
      'billing.manage',
      'dashboard.view',
      'notifications.view',
    ],
    nav: [
      NAV.dashboard,
      NAV.patients,
      NAV.appointments,
      NAV.queue,
      NAV.billing,
    ],
    widgets: ['opd-queue', 'patient-inflow', 'my-appointments'],
    landing: '/app/appointments',
  },

  lab_technician: {
    permissions: [
      'patients.view',
      'lab.view',
      'lab.result',
      'dashboard.view',
      'notifications.view',
    ],
    nav: [NAV.dashboard, NAV.lab, NAV.patients],
    widgets: ['pending-lab-orders'],
    landing: '/app/lab',
  },

  pharmacist: {
    permissions: [
      'patients.view',
      'inventory.view',
      'inventory.manage',
      'billing.view',
      'dashboard.view',
      'notifications.view',
    ],
    nav: [NAV.dashboard, NAV.inventory, NAV.billing],
    widgets: ['inventory-alerts', 'revenue'],
    landing: '/app/inventory',
  },

  patient: {
    permissions: ['portal.view', 'notifications.view'],
    nav: [NAV.myReports, NAV.myAppointments, NAV.myBills],
    widgets: [],
    landing: '/patient',
  },
};

class TableDrivenStrategy implements PermissionStrategy {
  private readonly granted: ReadonlySet<Permission>;

  constructor(
    readonly role: Role,
    private readonly definition: RoleDefinition,
  ) {
    this.granted = new Set(definition.permissions);
  }

  can(permission: Permission): boolean {
    return this.granted.has(permission);
  }

  navItems(): readonly NavItem[] {
    return this.definition.nav;
  }

  dashboardWidgets(): readonly DashboardWidgetKey[] {
    return this.definition.widgets;
  }

  landingRoute(): string {
    return this.definition.landing;
  }
}

/** Strategy used when there is no session — denies everything. */
export const ANONYMOUS_STRATEGY: PermissionStrategy = {
  role: 'patient',
  can: () => false,
  navItems: () => [],
  dashboardWidgets: () => [],
  landingRoute: () => '/',
};

function buildStrategies(): Record<Role, PermissionStrategy> {
  const entries = Object.entries(ROLE_DEFINITIONS) as [Role, RoleDefinition][];
  const strategies = {} as Record<Role, PermissionStrategy>;
  for (const [role, definition] of entries) {
    strategies[role] = new TableDrivenStrategy(role, definition);
  }
  return strategies;
}

export const PERMISSION_STRATEGIES: Readonly<Record<Role, PermissionStrategy>> = Object.freeze(
  buildStrategies(),
);
