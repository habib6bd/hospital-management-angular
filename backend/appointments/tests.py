from datetime import date, time, timedelta

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from patients.models import Patient

from .models import Appointment, AppointmentStatus, Doctor, DoctorSchedule

pytestmark = pytest.mark.django_db

User = get_user_model()


def auth_client(role: str) -> APIClient:
    user = User.objects.create_user(username=f"appt_{role}", password="demo1234", role=role)
    client = APIClient()
    login = client.post("/api/token/", {"username": user.username, "password": "demo1234"}, format="json")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    return client


@pytest.fixture
def doctor_client():
    return auth_client("doctor")


@pytest.fixture
def lab_client():
    return auth_client("lab_technician")


@pytest.fixture
def doctor():
    doc = Doctor.objects.create(
        full_name="Dr. Imran Hossain",
        specialty="Cardiology",
        department="Medicine",
        consultation_fee="1200.00",
        room_number="C-201",
    )
    for offset in (0, 1):
        weekday = (date.today() + timedelta(days=offset)).isoweekday() % 7
        DoctorSchedule.objects.create(
            doctor=doc, weekday=weekday, start_time=time(9, 0), end_time=time(13, 0), slot_minutes=20
        )
    return doc


@pytest.fixture
def booking_date():
    return date.today() + timedelta(days=1)


@pytest.fixture
def patient(db):
    return Patient.objects.create(
        mrn="HMS-2026-0001",
        full_name="Rafiqul Islam",
        gender="male",
        date_of_birth="1985-01-01",
        phone="01712345678",
    )


@pytest.fixture
def booked_appointment(doctor, patient, booking_date):
    return Appointment.objects.create(
        patient_id=patient.id,
        patient_name=patient.full_name,
        patient_mrn=patient.mrn,
        doctor=doctor,
        doctor_name=doctor.full_name,
        specialty=doctor.specialty,
        date=booking_date,
        start_time=time(9, 0),
        end_time=time(9, 20),
        status=AppointmentStatus.BOOKED,
        token_number=1,
    )


class TestDoctorsAndSchedules:
    def test_doctor_list(self, doctor_client, doctor):
        response = doctor_client.get("/api/doctors/")
        assert response.status_code == 200
        assert response.data["count"] == 1

    def test_slots_missing_date_400(self, doctor_client, doctor):
        response = doctor_client.get(f"/api/doctors/{doctor.id}/slots/")
        assert response.status_code == 400

    def test_slots_exposes_taken_by(self, doctor_client, doctor, booked_appointment, booking_date):
        response = doctor_client.get(f"/api/doctors/{doctor.id}/slots/?date={booking_date.isoformat()}")
        assert response.status_code == 200
        taken = next(s for s in response.data["results"] if s["start_time"] == "09:00")
        assert taken["is_available"] is False
        assert taken["taken_by"] == "Rafiqul Islam"

    def test_schedule_list_filter_by_doctor(self, doctor_client, doctor):
        response = doctor_client.get(f"/api/schedules/?doctor={doctor.id}")
        assert response.status_code == 200
        assert response.data["count"] == 2

    def test_schedule_patch(self, doctor_client, doctor):
        schedule = doctor.schedules.first()
        response = doctor_client.patch(
            f"/api/schedules/{schedule.id}/", {"is_active": False}, format="json"
        )
        assert response.status_code == 200
        assert response.data["is_active"] is False

    def test_schedule_patch_404(self, doctor_client):
        response = doctor_client.patch("/api/schedules/999999/", {"is_active": False}, format="json")
        assert response.status_code == 404
        assert response.data["detail"] == "Schedule not found."


class TestAppointmentCreate:
    def test_happy_path(self, doctor_client, doctor, patient, booking_date):
        response = doctor_client.post(
            "/api/appointments/",
            {
                "patient": patient.id,
                "doctor": doctor.id,
                "date": booking_date.isoformat(),
                "start_time": "09:00",
                "reason": "Follow-up",
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.data["status"] == "booked"
        assert response.data["token_number"] == 1

    def test_validation_errors_merge(self, doctor_client):
        response = doctor_client.post(
            "/api/appointments/",
            {"patient": 999999, "doctor": 999999, "date": "", "start_time": ""},
            format="json",
        )
        assert response.status_code == 400
        for field in ("patient", "doctor", "date", "start_time"):
            assert field in response.data

    def test_outside_clinic_hours(self, doctor_client, doctor, patient, booking_date):
        response = doctor_client.post(
            "/api/appointments/",
            {"patient": patient.id, "doctor": doctor.id, "date": booking_date.isoformat(), "start_time": "23:00"},
            format="json",
        )
        assert response.status_code == 400
        assert response.data == {"start_time": ["That time is outside the doctor's clinic hours."]}

    def test_slot_taken(self, doctor_client, doctor, patient, booking_date, booked_appointment):
        response = doctor_client.post(
            "/api/appointments/",
            {"patient": patient.id, "doctor": doctor.id, "date": booking_date.isoformat(), "start_time": "09:00"},
            format="json",
        )
        assert response.status_code == 400
        assert response.data == {"start_time": ["That slot has just been taken."]}

    def test_wrong_role_403(self, lab_client, doctor, patient, booking_date):
        response = lab_client.post(
            "/api/appointments/",
            {"patient": patient.id, "doctor": doctor.id, "date": booking_date.isoformat(), "start_time": "09:00"},
            format="json",
        )
        assert response.status_code == 403


class TestAppointmentDetail:
    def test_happy_path(self, doctor_client, booked_appointment):
        response = doctor_client.get(f"/api/appointments/{booked_appointment.id}/")
        assert response.status_code == 200
        assert response.data["patient"] == booked_appointment.patient_id

    def test_times_are_hh_mm(self, doctor_client, booked_appointment):
        response = doctor_client.get(f"/api/appointments/{booked_appointment.id}/")
        assert response.data["start_time"] == "09:00"
        assert response.data["end_time"] == "09:20"

    def test_404(self, doctor_client):
        response = doctor_client.get("/api/appointments/999999/")
        assert response.status_code == 404
        assert response.data["detail"] == "Appointment not found."


class TestAppointmentTransitions:
    def test_check_in_happy_path(self, doctor_client, booked_appointment):
        response = doctor_client.post(f"/api/appointments/{booked_appointment.id}/check-in/")
        assert response.status_code == 200
        assert response.data["status"] == "checked_in"
        assert response.data["checked_in_at"] is not None

    def test_full_happy_path_flow(self, doctor_client, booked_appointment):
        pk = booked_appointment.id
        assert doctor_client.post(f"/api/appointments/{pk}/check-in/").status_code == 200
        assert doctor_client.post(f"/api/appointments/{pk}/start/").status_code == 200
        response = doctor_client.post(f"/api/appointments/{pk}/complete/")
        assert response.status_code == 200
        assert response.data["status"] == "completed"

    def test_invalid_transition_409(self, doctor_client, booked_appointment):
        response = doctor_client.post(f"/api/appointments/{booked_appointment.id}/complete/")
        assert response.status_code == 409
        assert response.data["detail"] == "Cannot complete an appointment that is booked."

    def test_cancel_from_booked(self, doctor_client, booked_appointment):
        response = doctor_client.post(f"/api/appointments/{booked_appointment.id}/cancel/")
        assert response.status_code == 200
        assert response.data["status"] == "cancelled"

    def test_cancel_completed_is_409(self, doctor_client, booked_appointment):
        pk = booked_appointment.id
        doctor_client.post(f"/api/appointments/{pk}/check-in/")
        doctor_client.post(f"/api/appointments/{pk}/start/")
        doctor_client.post(f"/api/appointments/{pk}/complete/")
        response = doctor_client.post(f"/api/appointments/{pk}/cancel/")
        assert response.status_code == 409
        assert response.data["detail"] == "Cannot cancel an appointment that is completed."

    def test_no_show_from_booked(self, doctor_client, booked_appointment):
        response = doctor_client.post(f"/api/appointments/{booked_appointment.id}/no-show/")
        assert response.status_code == 200
        assert response.data["status"] == "no_show"

    def test_unknown_action_404(self, doctor_client, booked_appointment):
        response = doctor_client.post(f"/api/appointments/{booked_appointment.id}/frobnicate/")
        assert response.status_code == 404
        assert response.data["detail"] == "Unknown action."

    def test_appointment_not_found_404(self, doctor_client):
        response = doctor_client.post("/api/appointments/999999/check-in/")
        assert response.status_code == 404
        assert response.data["detail"] == "Appointment not found."

    def test_wrong_role_403(self, lab_client, booked_appointment):
        response = lab_client.post(f"/api/appointments/{booked_appointment.id}/check-in/")
        assert response.status_code == 403
