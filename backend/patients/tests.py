import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from .models import Bed, MedicalHistoryEntry, Patient, Ward

pytestmark = pytest.mark.django_db

User = get_user_model()


def auth_client(role: str) -> APIClient:
    user = User.objects.create_user(username=f"user_{role}", password="demo1234", role=role)
    client = APIClient()
    login = client.post("/api/token/", {"username": user.username, "password": "demo1234"}, format="json")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    return client


@pytest.fixture
def nurse_client():
    return auth_client("nurse")


@pytest.fixture
def patient_role_client():
    return auth_client("patient")


@pytest.fixture
def ward():
    return Ward.objects.create(name="General Ward A", ward_type="general", floor=2, total_beds=10)


@pytest.fixture
def bed(ward):
    return Bed.objects.create(ward=ward, bed_number="A-01", status="available")


@pytest.fixture
def patient(db):
    return Patient.objects.create(
        mrn="HMS-2026-0001",
        full_name="Rafiqul Islam",
        gender="male",
        date_of_birth="1985-01-01",
        phone="01712345678",
        address="Dhaka",
    )


class TestPatientList:
    def test_happy_path(self, nurse_client, patient):
        response = nurse_client.get("/api/patients/")
        assert response.status_code == 200
        assert response.data["count"] == 1

    def test_anonymous_401(self):
        response = APIClient().get("/api/patients/")
        assert response.status_code == 401

    def test_wrong_role_403(self, patient_role_client):
        response = patient_role_client.get("/api/patients/")
        assert response.status_code == 403


class TestPatientCreate:
    def test_happy_path(self, nurse_client):
        response = nurse_client.post(
            "/api/patients/",
            {
                "full_name": "New Patient",
                "gender": "female",
                "date_of_birth": "1990-05-05",
                "phone": "01812345678",
                "address": "Chattogram",
                "patient_type": "opd",
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.data["mrn"].startswith("HMS-")
        assert response.data["current_admission"] is None

    def test_validation_error_shape(self, nurse_client):
        response = nurse_client.post(
            "/api/patients/",
            {"full_name": "", "date_of_birth": "", "phone": "bad"},
            format="json",
        )
        assert response.status_code == 400
        assert set(response.data.keys()) >= {"full_name", "date_of_birth", "phone"}

    def test_future_dob_rejected(self, nurse_client):
        response = nurse_client.post(
            "/api/patients/",
            {"full_name": "X", "date_of_birth": "2099-01-01", "phone": "01712345678"},
            format="json",
        )
        assert response.status_code == 400
        assert response.data["date_of_birth"] == ["Date of birth cannot be in the future."]

    def test_duplicate_nid_rejected(self, nurse_client, patient):
        patient.nid = "1234567890"
        patient.save()
        response = nurse_client.post(
            "/api/patients/",
            {
                "full_name": "Y",
                "date_of_birth": "1990-01-01",
                "phone": "01712345678",
                "nid": "1234567890",
            },
            format="json",
        )
        assert response.status_code == 400
        assert response.data["nid"] == ["A patient with this NID already exists."]


class TestPatientDetail:
    def test_happy_path(self, nurse_client, patient):
        response = nurse_client.get(f"/api/patients/{patient.id}/")
        assert response.status_code == 200
        assert response.data["mrn"] == patient.mrn

    def test_404(self, nurse_client):
        response = nurse_client.get("/api/patients/999999/")
        assert response.status_code == 404
        assert response.data["detail"] == "Patient not found."

    def test_full_replace_resets_omitted_fields(self, nurse_client, patient):
        patient.blood_group = "O+"
        patient.save()
        response = nurse_client.patch(
            f"/api/patients/{patient.id}/",
            {
                "full_name": "Rafiqul Islam",
                "date_of_birth": "1985-01-01",
                "phone": "01712345678",
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data["blood_group"] is None

    def test_mrn_immutable(self, nurse_client, patient):
        response = nurse_client.patch(
            f"/api/patients/{patient.id}/",
            {"full_name": "Renamed", "date_of_birth": "1985-01-01", "phone": "01712345678"},
            format="json",
        )
        assert response.data["mrn"] == patient.mrn


class TestPatientHistory:
    def test_create_and_list(self, nurse_client, patient):
        response = nurse_client.post(
            f"/api/patients/{patient.id}/history/", {"title": "Flu"}, format="json"
        )
        assert response.status_code == 201
        assert response.data["category"] == "note"

        response = nurse_client.get(f"/api/patients/{patient.id}/history/")
        assert response.data["count"] == 1

    def test_blank_title_rejected(self, nurse_client, patient):
        response = nurse_client.post(
            f"/api/patients/{patient.id}/history/", {"title": ""}, format="json"
        )
        assert response.status_code == 400
        assert response.data == {"title": ["This field may not be blank."]}


class TestAdmitDischarge:
    def test_admit_happy_path(self, nurse_client, patient, bed):
        response = nurse_client.post(
            f"/api/patients/{patient.id}/admit/", {"bed": bed.id}, format="json"
        )
        assert response.status_code == 201
        assert response.data["patient_type"] == "ipd"
        assert response.data["current_admission"]["bed_number"] == "A-01"
        bed.refresh_from_db()
        assert bed.status == "occupied"

    def test_admit_invalid_bed(self, nurse_client, patient):
        response = nurse_client.post(
            f"/api/patients/{patient.id}/admit/", {"bed": 999999}, format="json"
        )
        assert response.status_code == 400
        assert response.data == {"bed": ["Select a valid bed."]}

    def test_admit_bed_not_available(self, nurse_client, patient, bed):
        bed.status = "occupied"
        bed.save()
        response = nurse_client.post(
            f"/api/patients/{patient.id}/admit/", {"bed": bed.id}, format="json"
        )
        assert response.status_code == 400
        assert response.data == {"bed": ["That bed is no longer available."]}

    def test_double_admit_conflict(self, nurse_client, patient, bed, ward):
        nurse_client.post(f"/api/patients/{patient.id}/admit/", {"bed": bed.id}, format="json")
        other_bed = Bed.objects.create(ward=ward, bed_number="A-02", status="available")
        response = nurse_client.post(
            f"/api/patients/{patient.id}/admit/", {"bed": other_bed.id}, format="json"
        )
        assert response.status_code == 409
        assert response.data["detail"] == "This patient is already admitted."

    def test_discharge_happy_path(self, nurse_client, patient, bed):
        nurse_client.post(f"/api/patients/{patient.id}/admit/", {"bed": bed.id}, format="json")
        response = nurse_client.post(f"/api/patients/{patient.id}/discharge/")
        assert response.status_code == 200
        assert response.data["patient_type"] == "opd"
        bed.refresh_from_db()
        assert bed.status == "cleaning"

    def test_discharge_without_admission_conflict(self, nurse_client, patient):
        response = nurse_client.post(f"/api/patients/{patient.id}/discharge/")
        assert response.status_code == 409
        assert response.data["detail"] == "This patient is not currently admitted."


class TestWardsAndBeds:
    def test_ward_list(self, nurse_client, ward):
        response = nurse_client.get("/api/wards/")
        assert response.status_code == 200
        assert response.data["results"][0]["occupied_beds"] == 0

    def test_ward_beds(self, nurse_client, ward, bed):
        response = nurse_client.get(f"/api/wards/{ward.id}/beds/")
        assert response.status_code == 200
        assert response.data["count"] == 1

    def test_bed_release(self, nurse_client, ward, bed):
        bed.status = "cleaning"
        bed.save()
        response = nurse_client.post(f"/api/wards/{ward.id}/beds/{bed.id}/release/")
        assert response.status_code == 204
        bed.refresh_from_db()
        assert bed.status == "available"

    def test_bed_release_404(self, nurse_client, ward):
        response = nurse_client.post(f"/api/wards/{ward.id}/beds/999999/release/")
        assert response.status_code == 404
        assert response.data["detail"] == "Bed not found."
