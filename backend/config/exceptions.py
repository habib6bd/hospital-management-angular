from rest_framework.views import exception_handler


def hms_exception_handler(exc, context):
    """
    DRF's default handler already produces the three shapes the frontend expects
    (`{"detail": ...}`, `{"field": [...]}`, `{"non_field_errors": [...]}` —
    see src/app/core/http/api-error.ts), so this only exists as the single
    place to extend later (e.g. mapping a domain exception to 409) without
    touching every view.
    """
    return exception_handler(exc, context)
