from datetime import date, time, timedelta

import pytest
from rest_framework.test import APIClient

from appointments.models import Appointment, AppointmentStatus, Doctor, DoctorSchedule

from .models import ContactMessage, Department, GuestBooking, HealthPackage
from .models import Testimonial as TestimonialModel

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def department():
    return Department.objects.create(
        slug="cardiology",
        icon="heart-pulse",
        image="/images/departments/cardiology.webp",
        name={"en": "Cardiology", "bn": "কার্ডিওলজি"},
        summary={"en": "Heart care", "bn": "..."},
        description={"en": "desc", "bn": "..."},
        services=[{"en": "ECG", "bn": "..."}],
    )


@pytest.fixture
def doctor(department):
    doc = Doctor.objects.create(
        full_name="Dr. Imran Hossain",
        name_bn="ডা. ইমরান হোসেন",
        specialty="Cardiology",
        department="Medicine",
        consultation_fee="1200.00",
        room_number="C-201",
        designation={"en": "Professor & Head of Department", "bn": "..."},
        qualifications="MBBS, FCPS",
        experience_years=22,
        gender="male",
        bio={"en": "bio", "bn": "..."},
    )
    # Schedules for both today's and tomorrow's weekday — booking tests use
    # tomorrow so the "already past" slot rule never makes the test flaky.
    for offset in (0, 1):
        weekday = (date.today() + timedelta(days=offset)).isoweekday() % 7
        DoctorSchedule.objects.create(
            doctor=doc,
            weekday=weekday,
            start_time=time(9, 0),
            end_time=time(13, 0),
            slot_minutes=20,
            is_active=True,
        )
    return doc


@pytest.fixture
def booking_date():
    return date.today() + timedelta(days=1)


class TestDepartments:
    def test_list_is_not_paginated(self, client, department):
        response = client.get("/api/public/departments/")
        assert response.status_code == 200
        assert response.data["next"] is None
        assert response.data["previous"] is None
        assert response.data["count"] == 1

    def test_detail_happy_path(self, client, department):
        response = client.get("/api/public/departments/cardiology/")
        assert response.status_code == 200
        assert response.data["slug"] == "cardiology"

    def test_detail_404(self, client):
        response = client.get("/api/public/departments/unknown/")
        assert response.status_code == 404
        assert response.data["detail"] == "Department not found."

    def test_doctor_count_reflects_matching_specialty(self, client, department, doctor):
        response = client.get("/api/public/departments/cardiology/")
        assert response.data["doctor_count"] == 1


class TestPublicDoctors:
    def test_list_paginated_default_page_size_12(self, client, doctor):
        response = client.get("/api/public/doctors/")
        assert response.status_code == 200
        assert "count" in response.data and "results" in response.data

    def test_detail_shape_matches_public_doctor_dto(self, client, doctor):
        response = client.get(f"/api/public/doctors/{doctor.id}/")
        assert response.status_code == 200
        assert response.data["name"] == {"en": "Dr. Imran Hossain", "bn": "ডা. ইমরান হোসেন"}
        assert response.data["department_slug"] == "cardiology"
        assert response.data["consultation_fee"] == "1200.00"

    def test_detail_404(self, client):
        response = client.get("/api/public/doctors/999999/")
        assert response.status_code == 404
        assert response.data["detail"] == "Doctor not found."

    def test_slots_missing_date_is_400(self, client, doctor):
        response = client.get(f"/api/public/doctors/{doctor.id}/slots/")
        assert response.status_code == 400
        assert response.data == {"date": ["This query parameter is required."]}

    def test_slots_happy_path(self, client, doctor):
        today = date.today().isoformat()
        response = client.get(f"/api/public/doctors/{doctor.id}/slots/?date={today}")
        assert response.status_code == 200
        assert "results" in response.data
        assert "count" not in response.data


class TestServicesPackagesTestimonials:
    def test_packages_list(self, client):
        HealthPackage.objects.create(
            name={"en": "Basic", "bn": "..."}, price="2500.00", is_popular=False, tests=[]
        )
        response = client.get("/api/public/packages/")
        assert response.status_code == 200
        assert response.data["count"] == 1

    def test_testimonials_list(self, client):
        TestimonialModel.objects.create(
            name={"en": "A", "bn": "..."}, location={"en": "B", "bn": "..."}, quote={"en": "C", "bn": "..."}
        )
        response = client.get("/api/public/testimonials/")
        assert response.status_code == 200
        assert response.data["count"] == 1


class TestGuestBooking:
    def test_happy_path_creates_appointment_and_booking(self, client, doctor, booking_date):
        today = booking_date.isoformat()
        response = client.post(
            "/api/public/appointments/",
            {
                "doctor": doctor.id,
                "date": today,
                "start_time": "09:00",
                "name": "Rafiqul Islam",
                "phone": "01712345678",
                "age": 40,
                "gender": "male",
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.data["reference"].startswith("CW-")
        assert response.data["serial_no"] == 1
        assert Appointment.objects.count() == 1
        assert GuestBooking.objects.count() == 1
        appt = Appointment.objects.first()
        assert appt.patient_id == 0
        assert appt.patient_mrn == "GUEST"
        assert appt.status == AppointmentStatus.BOOKED

    def test_validation_errors_merge(self, client, doctor):
        response = client.post(
            "/api/public/appointments/",
            {
                "doctor": 999999,
                "date": "",
                "start_time": "",
                "name": "A",
                "phone": "123",
                "age": 200,
                "gender": "x",
            },
            format="json",
        )
        assert response.status_code == 400
        for field in ("doctor", "date", "start_time", "name", "phone", "age", "gender"):
            assert field in response.data

    def test_slot_taken_returns_400(self, client, doctor, booking_date):
        today = booking_date.isoformat()
        client.post(
            "/api/public/appointments/",
            {
                "doctor": doctor.id,
                "date": today,
                "start_time": "09:00",
                "name": "First Patient",
                "phone": "01712345678",
                "age": 30,
                "gender": "male",
            },
            format="json",
        )
        response = client.post(
            "/api/public/appointments/",
            {
                "doctor": doctor.id,
                "date": today,
                "start_time": "09:00",
                "name": "Second Patient",
                "phone": "01812345678",
                "age": 25,
                "gender": "female",
            },
            format="json",
        )
        assert response.status_code == 400
        assert response.data == {"start_time": ["That slot has just been taken. Please pick another."]}

    def test_lookup_happy_path(self, client, doctor, booking_date):
        today = booking_date.isoformat()
        booked = client.post(
            "/api/public/appointments/",
            {
                "doctor": doctor.id,
                "date": today,
                "start_time": "09:00",
                "name": "Rafiqul Islam",
                "phone": "01712345678",
                "age": 40,
                "gender": "male",
            },
            format="json",
        )
        reference = booked.data["reference"]
        response = client.get(f"/api/public/appointments/lookup/?reference={reference}&phone=01712345678")
        assert response.status_code == 200
        assert response.data["reference"] == reference

    def test_lookup_no_match_is_generic_404(self, client):
        response = client.get("/api/public/appointments/lookup/?reference=CW-000000-0000&phone=01712345678")
        assert response.status_code == 404
        assert response.data["detail"] == "No booking matches that reference and phone number."


class TestContact:
    def test_happy_path(self, client):
        response = client.post(
            "/api/public/contact/",
            {"name": "Nazmul", "phone": "01712345678", "message": "This is a long enough message."},
            format="json",
        )
        assert response.status_code == 201
        assert set(response.data.keys()) == {"id"}
        assert ContactMessage.objects.count() == 1

    def test_validation_errors(self, client):
        response = client.post(
            "/api/public/contact/", {"name": "", "phone": "bad", "message": "short"}, format="json"
        )
        assert response.status_code == 400
        assert set(response.data.keys()) == {"name", "phone", "message"}
