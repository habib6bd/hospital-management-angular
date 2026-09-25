from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/", include("accounts.urls")),
    path("api/public/", include("public_site.urls")),
    path("api/", include("patients.urls")),
    path("api/", include("appointments.urls")),
    path("api/", include("inventory.urls")),
    path("api/", include("lab.urls")),
    path("api/", include("billing.urls")),
    path("api/portal/", include("portal.urls")),
]
