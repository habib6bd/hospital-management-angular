from django.urls import path

from . import views

app_name = "appointments"

urlpatterns = [
    path("doctors/", views.DoctorListView.as_view(), name="doctor-list"),
    path("doctors/<int:pk>/slots/", views.DoctorSlotsView.as_view(), name="doctor-slots"),
    path("schedules/", views.ScheduleListView.as_view(), name="schedule-list"),
    path("schedules/<int:pk>/", views.ScheduleUpdateView.as_view(), name="schedule-update"),
    path("appointments/", views.AppointmentListCreateView.as_view(), name="appointment-list-create"),
    path("appointments/<int:pk>/", views.AppointmentDetailView.as_view(), name="appointment-detail"),
    path(
        "appointments/<int:pk>/<str:action>/",
        views.AppointmentTransitionView.as_view(),
        name="appointment-transition",
    ),
]
