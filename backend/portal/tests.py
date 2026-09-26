from datetime import date, time, timedelta

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from appointments.models import Appointment, AppointmentStatus, Doctor
from lab.models import ReportDocument
from patients.models import Patient

pytestmark = pytest.mark.django_db

User = get_user_model()


def auth_client(role: str, **extra) -> APIClient:
    user = User.objects.create_user(username=f"portal_{role}", password="demo1234", role=role, **extra)
    client = APIClient()
    login = client.post("/api/token/", {"username": user.username, "password": "demo1234"}, format="json")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    return client


@pytest.fixture
def patient(db):
    return Patient.objects.create(
        mrn="HMS-2026-0001", full_name="Rafiqul Islam", gender="male", date_of_birth="1985-01-01", phone="01712345678"
    )


@pytest.fixture
def other_patient(db):
    return Patient.objects.create(
        mrn="HMS-2026-0002", full_name="Someone Else", gender="female", date_of_birth="1990-01-01", phone="01812345678"
    )


@pytest.fixture
def patient_client(patient):
    return auth_client("patient", patient_id=patient.id)


@pytest.fixture
def patient_no_link_client():
    return auth_client("patient")


@pytest.fixture
def doctor_client():
    return auth_client("doctor")


@pytest.fixture
def report(patient):
    return ReportDocument.objects.create(
        patient_id=patient.id, kind="lab_report", title="CBC", status="ready", issued_at="2026-01-01T00:00:00Z"
    )


@pytest.fixture
def other_report(other_patient):
    return ReportDocument.objects.create(
        patient_id=other_patient.id, kind="lab_report", title="CBC", status="ready"
    )


class TestPortalAccessControl:
    def test_non_patient_role_403(self, doctor_client):
        response = doctor_client.get("/api/portal/profile/")
        assert response.status_code == 403
        assert response.data["detail"] == "Only patients can access the portal."

    def test_patient_without_link_403(self, patient_no_link_client):
        response = patient_no_link_client.get("/api/portal/profile/")
        assert response.status_code == 403

    def test_anonymous_401(self):
        response = APIClient().get("/api/portal/profile/")
        assert response.status_code == 401


class TestPortalProfile:
    def test_happy_path(self, patient_client, patient):
        response = patient_client.get("/api/portal/profile/")
        assert response.status_code == 200
        assert response.data["mrn"] == patient.mrn


class TestPortalAppointments:
    def test_only_own_appointments(self, patient_client, patient, other_patient):
        doctor = Doctor.objects.create(
            full_name="Dr. X", specialty="Cardiology", department="Medicine", consultation_fee="100.00", room_number="C-1"
        )
        Appointment.objects.create(
            patient_id=patient.id, patient_name=patient.full_name, patient_mrn=patient.mrn,
            doctor=doctor, doctor_name=doctor.full_name, specialty=doctor.specialty,
            date=date.today(), start_time=time(9, 0), end_time=time(9, 20), status=AppointmentStatus.BOOKED,
        )
        Appointment.objects.create(
            patient_id=other_patient.id, patient_name=other_patient.full_name, patient_mrn=other_patient.mrn,
            doctor=doctor, doctor_name=doctor.full_name, specialty=doctor.specialty,
            date=date.today(), start_time=time(10, 0), end_time=time(10, 20), status=AppointmentStatus.BOOKED,
        )
        response = patient_client.get("/api/portal/appointments/")
        assert response.status_code == 200
        assert response.data["count"] == 1


class TestPortalReports:
    def test_only_own_reports(self, patient_client, report, other_report):
        response = patient_client.get("/api/portal/reports/")
        assert response.status_code == 200
        assert response.data["count"] == 1
        assert response.data["results"][0]["id"] == report.id

    def test_download_url_happy_path(self, patient_client, report):
        response = patient_client.get(f"/api/portal/reports/{report.id}/download-url/")
        assert response.status_code == 200
        assert response.data["filename"] == f"lab_report-{report.id}.pdf"

    def test_download_url_pending_409(self, patient_client, patient):
        pending = ReportDocument.objects.create(patient_id=patient.id, kind="lab_report", title="X", status="pending")
        response = patient_client.get(f"/api/portal/reports/{pending.id}/download-url/")
        assert response.status_code == 409
        assert response.data["detail"] == "This report is not ready yet."

    def test_download_url_other_patient_404(self, patient_client, other_report):
        response = patient_client.get(f"/api/portal/reports/{other_report.id}/download-url/")
        assert response.status_code == 404
        assert response.data["detail"] == "Report not found."

    def test_downloads_marks_downloaded(self, patient_client, report):
        response = patient_client.post(f"/api/portal/reports/{report.id}/downloads/")
        assert response.status_code == 201
        assert response.data["status"] == "downloaded"
        report.refresh_from_db()
        assert report.status == "downloaded"
        assert report.downloads.count() == 1

    def test_downloads_other_patient_404(self, patient_client, other_report):
        response = patient_client.post(f"/api/portal/reports/{other_report.id}/downloads/")
        assert response.status_code == 404


class TestPortalReportFile:
    def test_signed_link_serves_a_real_pdf(self, patient_client, report):
        download_url = patient_client.get(f"/api/portal/reports/{report.id}/download-url/").data["url"]
        response = patient_client.get(download_url)
        assert response.status_code == 200
        assert response["Content-Type"] == "application/pdf"
        assert response.content.startswith(b"%PDF")

    def test_no_signature_is_403(self, patient_client, report):
        response = patient_client.get(f"/api/portal/reports/{report.id}/file/")
        assert response.status_code == 403

    def test_signature_for_a_different_report_is_rejected(self, patient_client, report, other_report):
        token = patient_client.get(
            f"/api/portal/reports/{report.id}/download-url/"
        ).data["url"].split("sig=")[1]
        response = patient_client.get(f"/api/portal/reports/{other_report.id}/file/?sig={token}")
        assert response.status_code == 403

    def test_anonymous_can_use_a_valid_signed_link(self, patient_client, report):
        download_url = patient_client.get(f"/api/portal/reports/{report.id}/download-url/").data["url"]
        response = APIClient().get(download_url)
        assert response.status_code == 200
        assert response["Content-Type"] == "application/pdf"
