import { ROLES, type Role } from './auth.model';
import { ANONYMOUS_STRATEGY, PERMISSION_STRATEGIES } from './permission.strategies';
import type { Permission } from './permission.model';

/**
 * The role matrix is the security-relevant part of the frontend, so it is
 * tested directly against the strategy table rather than through the UI.
 */
describe('permission strategies', () => {
  it('defines a strategy for every role', () => {
    for (const role of ROLES) {
      expect(PERMISSION_STRATEGIES[role]).toBeDefined();
      expect(PERMISSION_STRATEGIES[role].role).toBe(role);
    }
  });

  it('gives a patient the portal and nothing else', () => {
    const patient = PERMISSION_STRATEGIES['patient'];
    expect(patient.can('portal.view')).toBe(true);

    const forbidden: readonly Permission[] = [
      'patients.view',
      'patients.manage',
      'billing.manage',
      'inventory.manage',
      'lab.result',
      'dashboard.view',
    ];
    for (const permission of forbidden) {
      expect(patient.can(permission)).toBe(false);
    }
  });

  it('keeps the portal exclusive to patients', () => {
    const staffRoles = ROLES.filter((role): role is Role => role !== 'patient');
    for (const role of staffRoles) {
      expect(PERMISSION_STRATEGIES[role].can('portal.view')).toBe(false);
    }
  });

  it('only lets clinical roles order labs and only technicians enter results', () => {
    expect(PERMISSION_STRATEGIES['doctor'].can('lab.order')).toBe(true);
    expect(PERMISSION_STRATEGIES['admin'].can('lab.order')).toBe(true);
    expect(PERMISSION_STRATEGIES['nurse'].can('lab.order')).toBe(false);
    expect(PERMISSION_STRATEGIES['receptionist'].can('lab.order')).toBe(false);

    expect(PERMISSION_STRATEGIES['lab_technician'].can('lab.result')).toBe(true);
    expect(PERMISSION_STRATEGIES['doctor'].can('lab.result')).toBe(false);
  });

  it('restricts inventory writes to admin and pharmacist', () => {
    const canManage = ROLES.filter((role) => PERMISSION_STRATEGIES[role].can('inventory.manage'));
    expect([...canManage].sort()).toEqual(['admin', 'pharmacist']);
  });

  it('gives every role a landing route it is allowed to reach', () => {
    for (const role of ROLES) {
      const strategy = PERMISSION_STRATEGIES[role];
      const landing = strategy.landingRoute();
      expect(landing.startsWith('/')).toBe(true);

      // The landing route must be reachable from the role's own navigation,
      // otherwise sign-in drops the user somewhere their sidebar cannot return to.
      const reachable = strategy
        .navItems()
        .some((item) => item.route === landing || item.route.startsWith(`${landing}/`));
      expect(reachable).toBe(true);
    }
  });

  it('denies everything when there is no session', () => {
    expect(ANONYMOUS_STRATEGY.can('patients.view')).toBe(false);
    expect(ANONYMOUS_STRATEGY.navItems()).toEqual([]);
    expect(ANONYMOUS_STRATEGY.dashboardWidgets()).toEqual([]);
    expect(ANONYMOUS_STRATEGY.landingRoute()).toBe('/auth/login');
  });
});
