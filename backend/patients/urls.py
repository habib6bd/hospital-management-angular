from django.urls import path

from . import views

app_name = "patients"

urlpatterns = [
    path("wards/", views.WardListView.as_view(), name="ward-list"),
    path("wards/<int:ward_id>/beds/", views.WardBedsView.as_view(), name="ward-beds"),
    path(
        "wards/<int:ward_id>/beds/<int:bed_id>/release/",
        views.BedReleaseView.as_view(),
        name="bed-release",
    ),
    path("patients/", views.PatientListCreateView.as_view(), name="patient-list-create"),
    path("patients/<int:pk>/", views.PatientDetailView.as_view(), name="patient-detail"),
    path("patients/<int:pk>/history/", views.PatientHistoryView.as_view(), name="patient-history"),
    path(
        "patients/<int:pk>/admissions/",
        views.PatientAdmissionsView.as_view(),
        name="patient-admissions",
    ),
    path("patients/<int:pk>/admit/", views.PatientAdmitView.as_view(), name="patient-admit"),
    path(
        "patients/<int:pk>/discharge/", views.PatientDischargeView.as_view(), name="patient-discharge"
    ),
]
