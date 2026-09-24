import { inject } from '@angular/core';
import { Router, type CanActivateFn, type CanMatchFn, type UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { PermissionService } from './permission.service';
import type { Role } from './auth.model';
import type { Permission } from './permission.model';

/**
 * Guards are defence in depth. Django remains the security boundary — every
 * endpoint re-checks the caller's role server-side. These only keep the UI honest.
 */

async function ensureSessionResolved(auth: AuthService): Promise<void> {
  if (auth.isInitialising()) {
    await auth.restoreSession();
  }
}

/** Requires any authenticated session; otherwise bounces to login with a returnUrl. */
export const authGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await ensureSessionResolved(auth);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};

/** Blocks signed-in users from the login page, sending them to their landing route. */
export const guestGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const permissions = inject(PermissionService);
  const router = inject(Router);

  await ensureSessionResolved(auth);

  if (!auth.isAuthenticated()) {
    return true;
  }
  return router.parseUrl(permissions.landingRoute());
};

/**
 * Role gate for a whole lazy feature. Used on `canMatch` so the chunk is never
 * even fetched for a role that cannot use it.
 */
export function roleGuard(...roles: readonly Role[]): CanMatchFn {
  return async (): Promise<boolean | UrlTree> => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await ensureSessionResolved(auth);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth/login']);
    }

    const role = auth.role();
    if (role !== null && roles.includes(role)) {
      return true;
    }
    return router.createUrlTree(['/forbidden']);
  };
}

/** Finer-grained gate for individual routes inside an already-permitted feature. */
export function permissionGuard(...permissions: readonly Permission[]): CanActivateFn {
  return async (): Promise<boolean | UrlTree> => {
    const auth = inject(AuthService);
    const permissionService = inject(PermissionService);
    const router = inject(Router);

    await ensureSessionResolved(auth);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth/login']);
    }
    if (permissionService.canAll(permissions)) {
      return true;
    }
    return router.createUrlTree(['/forbidden']);
  };
}
