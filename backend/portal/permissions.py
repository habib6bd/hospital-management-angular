from rest_framework.permissions import BasePermission


class IsPatientPortalUser(BasePermission):
    """
    Every /api/portal/** route requires role == 'patient' with a linked
    patient — see API_CONTRACT.md §9. The message matches the mock exactly.
    """

    message = "Only patients can access the portal."

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False
        return user.role == "patient" and user.patient_id is not None
