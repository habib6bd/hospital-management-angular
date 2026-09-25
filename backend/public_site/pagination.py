from config.pagination import DefaultPagination


class PublicDoctorPagination(DefaultPagination):
    """GET /api/public/doctors/ defaults to page_size=12 (API_CONTRACT.md §3)."""

    page_size = 12
