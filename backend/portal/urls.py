from django.urls import path

from . import views

app_name = "portal"

urlpatterns = [
    path("profile/", views.PortalProfileView.as_view(), name="profile"),
    path("appointments/", views.PortalAppointmentsView.as_view(), name="appointments"),
    path("reports/", views.PortalReportsView.as_view(), name="reports"),
    path(
        "reports/<int:pk>/download-url/",
        views.PortalReportDownloadUrlView.as_view(),
        name="report-download-url",
    ),
    path(
        "reports/<int:pk>/downloads/",
        views.PortalReportDownloadsView.as_view(),
        name="report-downloads",
    ),
]
