from django.urls import path

from . import views

app_name = "public_site"

urlpatterns = [
    path("departments/", views.DepartmentListView.as_view(), name="department-list"),
    path("departments/<slug:slug>/", views.DepartmentDetailView.as_view(), name="department-detail"),
    path("doctors/", views.PublicDoctorListView.as_view(), name="doctor-list"),
    path("doctors/<int:pk>/slots/", views.PublicDoctorSlotsView.as_view(), name="doctor-slots"),
    path("doctors/<int:pk>/", views.PublicDoctorDetailView.as_view(), name="doctor-detail"),
    path("services/", views.HospitalServiceListView.as_view(), name="service-list"),
    path("services/<slug:slug>/", views.HospitalServiceDetailView.as_view(), name="service-detail"),
    path("packages/", views.HealthPackageListView.as_view(), name="package-list"),
    path("testimonials/", views.TestimonialListView.as_view(), name="testimonial-list"),
    path("appointments/", views.GuestBookingCreateView.as_view(), name="guest-booking-create"),
    path("appointments/lookup/", views.GuestBookingLookupView.as_view(), name="guest-booking-lookup"),
    path("contact/", views.ContactCreateView.as_view(), name="contact-create"),
]
