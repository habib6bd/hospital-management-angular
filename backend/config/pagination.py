from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """DRF PageNumberPagination with page_size=20, matching core/http/paginated.ts."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200


class EnvelopeAllPagination(PageNumberPagination):
    """
    For endpoints the mock never actually paginates (departments, services,
    packages, testimonials, wards, doctor schedules, ...) but still wraps in
    the same {count, next, previous, results} envelope — see
    backend/docs/API_CONTRACT.md's "not paginated" call-outs. `next`/
    `previous` end up always null since everything fits on page 1.
    """

    page_size = 1_000_000
    page_size_query_param = None
