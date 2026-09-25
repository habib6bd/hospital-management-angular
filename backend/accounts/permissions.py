"""
Server-side mirror of src/app/core/auth/permission.strategies.ts.

The mock API enforces no per-role checks on any business endpoint (only
"authenticated or not" — see backend/docs/API_CONTRACT.md §1 and §10.1). We
made a deliberate decision to close that gap in the real backend rather than
reproduce it: every business endpoint from Phase 3 onward is gated by one of
the permission classes below, built from this same role -> permission table.
This is a documented, intentional deviation from byte-for-byte mock parity
(see backend/README.md "Design decisions").
"""

from rest_framework.permissions import BasePermission

# Mirrors PERMISSIONS in src/app/core/auth/permission.model.ts.
PATIENTS_VIEW = "patients.view"
PATIENTS_MANAGE = "patients.manage"
PATIENTS_ADMIT = "patients.admit"
APPOINTMENTS_VIEW = "appointments.view"
APPOINTMENTS_MANAGE = "appointments.manage"
APPOINTMENTS_QUEUE = "appointments.queue"
INVENTORY_VIEW = "inventory.view"
INVENTORY_MANAGE = "inventory.manage"
LAB_VIEW = "lab.view"
LAB_ORDER = "lab.order"
LAB_RESULT = "lab.result"
BILLING_VIEW = "billing.view"
BILLING_MANAGE = "billing.manage"
DASHBOARD_VIEW = "dashboard.view"
PORTAL_VIEW = "portal.view"
NOTIFICATIONS_VIEW = "notifications.view"

# Mirrors ROLE_DEFINITIONS in permission.strategies.ts, transcribed exactly.
ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "admin": frozenset(
        {
            PATIENTS_VIEW,
            PATIENTS_MANAGE,
            PATIENTS_ADMIT,
            APPOINTMENTS_VIEW,
            APPOINTMENTS_MANAGE,
            APPOINTMENTS_QUEUE,
            INVENTORY_VIEW,
            INVENTORY_MANAGE,
            LAB_VIEW,
            LAB_ORDER,
            LAB_RESULT,
            BILLING_VIEW,
            BILLING_MANAGE,
            DASHBOARD_VIEW,
            NOTIFICATIONS_VIEW,
        }
    ),
    "doctor": frozenset(
        {
            PATIENTS_VIEW,
            PATIENTS_MANAGE,
            PATIENTS_ADMIT,
            APPOINTMENTS_VIEW,
            APPOINTMENTS_MANAGE,
            APPOINTMENTS_QUEUE,
            LAB_VIEW,
            LAB_ORDER,
            DASHBOARD_VIEW,
            NOTIFICATIONS_VIEW,
        }
    ),
    "nurse": frozenset(
        {
            PATIENTS_VIEW,
            PATIENTS_MANAGE,
            PATIENTS_ADMIT,
            APPOINTMENTS_VIEW,
            APPOINTMENTS_QUEUE,
            INVENTORY_VIEW,
            LAB_VIEW,
            DASHBOARD_VIEW,
            NOTIFICATIONS_VIEW,
        }
    ),
    "receptionist": frozenset(
        {
            PATIENTS_VIEW,
            PATIENTS_MANAGE,
            APPOINTMENTS_VIEW,
            APPOINTMENTS_MANAGE,
            APPOINTMENTS_QUEUE,
            BILLING_VIEW,
            BILLING_MANAGE,
            DASHBOARD_VIEW,
            NOTIFICATIONS_VIEW,
        }
    ),
    "lab_technician": frozenset(
        {
            PATIENTS_VIEW,
            LAB_VIEW,
            LAB_RESULT,
            DASHBOARD_VIEW,
            NOTIFICATIONS_VIEW,
        }
    ),
    "pharmacist": frozenset(
        {
            PATIENTS_VIEW,
            INVENTORY_VIEW,
            INVENTORY_MANAGE,
            BILLING_VIEW,
            DASHBOARD_VIEW,
            NOTIFICATIONS_VIEW,
        }
    ),
    "patient": frozenset({PORTAL_VIEW, NOTIFICATIONS_VIEW}),
}


def role_has_permission(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, frozenset())


class HasRolePermission(BasePermission):
    """
    Base class for a single required permission. Subclass via `require()`
    rather than setting `required_permission` directly in views, so call
    sites read as `permission_classes = [require(PATIENTS_MANAGE)]`.
    """

    required_permission: str = ""

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False
        return role_has_permission(user.role, self.required_permission)


_CLASS_CACHE: dict[str, type[HasRolePermission]] = {}


def require(permission: str) -> type[HasRolePermission]:
    """Returns (and caches) a DRF permission class requiring `permission`."""
    if permission not in _CLASS_CACHE:
        suffix = permission.replace(".", "_")
        _CLASS_CACHE[permission] = type(
            f"Require_{suffix}",
            (HasRolePermission,),
            {"required_permission": permission},
        )
    return _CLASS_CACHE[permission]
