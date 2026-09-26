import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from patients.models import Patient

from .models import LabOrder, LabTest

pytestmark = pytest.mark.django_db

User = get_user_model()


def auth_client(role: str) -> APIClient:
    user = User.objects.create_user(username=f"lab_{role}", password="demo1234", role=role)
    client = APIClient()
    login = client.post("/api/token/", {"username": user.username, "password": "demo1234"}, format="json")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    return client, user


@pytest.fixture
def doctor_client():
    return auth_client("doctor")


@pytest.fixture
def lab_client():
    return auth_client("lab_technician")


@pytest.fixture
def pharmacist_client():
    return auth_client("pharmacist")


@pytest.fixture
def patient(db):
    return Patient.objects.create(
        mrn="HMS-2026-0001", full_name="Rafiqul Islam", gender="male", date_of_birth="1985-01-01", phone="01712345678"
    )


@pytest.fixture
def cbc_test():
    return LabTest.objects.create(
        code="CBC", name="Complete Blood Count", specimen="Blood", unit="cells/uL", price="500.00", turnaround_hours=24
    )


@pytest.fixture
def order(doctor_client, patient, cbc_test):
    client, user = doctor_client
    response = client.post(
        "/api/lab-orders/", {"patient": patient.id, "tests": [cbc_test.id]}, format="json"
    )
    return LabOrder.objects.get(pk=response.data["id"])


class TestLabTests:
    def test_list(self, doctor_client, cbc_test):
        client, _ = doctor_client
        response = client.get("/api/lab-tests/")
        assert response.status_code == 200
        assert response.data["count"] == 1


class TestLabOrderCreate:
    def test_happy_path(self, doctor_client, patient, cbc_test):
        client, _ = doctor_client
        response = client.post(
            "/api/lab-orders/", {"patient": patient.id, "tests": [cbc_test.id]}, format="json"
        )
        assert response.status_code == 201
        assert response.data["order_number"].startswith("LAB-")
        assert response.data["status"] == "ordered"
        assert response.data["priority"] == "routine"

    def test_validation_errors(self, doctor_client):
        client, _ = doctor_client
        response = client.post("/api/lab-orders/", {"patient": 999999, "tests": []}, format="json")
        assert response.status_code == 400
        assert response.data["patient"] == ["Select a valid patient."]
        assert response.data["tests"] == ["Select at least one test."]

    def test_wrong_role_403(self, pharmacist_client, patient, cbc_test):
        client, _ = pharmacist_client
        response = client.post(
            "/api/lab-orders/", {"patient": patient.id, "tests": [cbc_test.id]}, format="json"
        )
        assert response.status_code == 403


class TestLabOrderDetail:
    def test_happy_path(self, doctor_client, order):
        client, _ = doctor_client
        response = client.get(f"/api/lab-orders/{order.id}/")
        assert response.status_code == 200
        assert response.data["patient"] == order.patient_id

    def test_404(self, doctor_client):
        client, _ = doctor_client
        response = client.get("/api/lab-orders/999999/")
        assert response.status_code == 404
        assert response.data["detail"] == "Order not found."


class TestLabOrderStateMachine:
    def test_full_happy_path(self, lab_client, order, cbc_test):
        client, _ = lab_client
        r1 = client.post(f"/api/lab-orders/{order.id}/collect-sample/")
        assert r1.status_code == 200
        assert r1.data["status"] == "sample_collected"
        assert r1.data["sample_id"].startswith("S-")

        r2 = client.post(f"/api/lab-orders/{order.id}/start/")
        assert r2.status_code == 200
        assert r2.data["status"] == "in_progress"

        r3 = client.post(
            f"/api/lab-orders/{order.id}/results/",
            {"results": [{"test": cbc_test.id, "value": "5.2"}]},
            format="json",
        )
        assert r3.status_code == 200
        assert r3.data["status"] == "completed"
        assert r3.data["report"] is not None
        assert len(r3.data["results"]) == 1

    def test_collect_sample_twice_is_409(self, lab_client, order):
        client, _ = lab_client
        client.post(f"/api/lab-orders/{order.id}/collect-sample/")
        response = client.post(f"/api/lab-orders/{order.id}/collect-sample/")
        assert response.status_code == 409
        assert response.data["detail"] == "A sample has already been collected for this order."

    def test_start_before_collect_is_409(self, lab_client, order):
        client, _ = lab_client
        response = client.post(f"/api/lab-orders/{order.id}/start/")
        assert response.status_code == 409
        assert response.data["detail"] == "The sample must be collected before analysis can start."

    def test_cancel_completed_is_409(self, doctor_client, lab_client, order, cbc_test):
        lab, _ = lab_client
        lab.post(f"/api/lab-orders/{order.id}/collect-sample/")
        lab.post(f"/api/lab-orders/{order.id}/start/")
        lab.post(
            f"/api/lab-orders/{order.id}/results/",
            {"results": [{"test": cbc_test.id, "value": "5.2"}]},
            format="json",
        )
        client, _ = doctor_client
        response = client.post(f"/api/lab-orders/{order.id}/cancel/")
        assert response.status_code == 409
        assert response.data["detail"] == "A completed order cannot be cancelled."

    def test_cancel_happy_path(self, doctor_client, order):
        client, _ = doctor_client
        response = client.post(f"/api/lab-orders/{order.id}/cancel/")
        assert response.status_code == 200
        assert response.data["status"] == "cancelled"

    def test_results_on_cancelled_order_409(self, doctor_client, lab_client, order, cbc_test):
        cancel_client, _ = doctor_client
        cancel_client.post(f"/api/lab-orders/{order.id}/cancel/")
        client, _ = lab_client
        response = client.post(
            f"/api/lab-orders/{order.id}/results/",
            {"results": [{"test": cbc_test.id, "value": "5.2"}]},
            format="json",
        )
        assert response.status_code == 409
        assert response.data["detail"] == "Results cannot be entered on a cancelled order."

    def test_results_before_sample_collected_409(self, lab_client, order, cbc_test):
        client, _ = lab_client
        response = client.post(
            f"/api/lab-orders/{order.id}/results/",
            {"results": [{"test": cbc_test.id, "value": "5.2"}]},
            format="json",
        )
        assert response.status_code == 409
        assert response.data["detail"] == "The sample has not been collected yet."

    def test_results_missing_value_400(self, lab_client, order, cbc_test):
        client, _ = lab_client
        client.post(f"/api/lab-orders/{order.id}/collect-sample/")
        response = client.post(
            f"/api/lab-orders/{order.id}/results/", {"results": []}, format="json"
        )
        assert response.status_code == 400
        assert response.data == {f"results.{cbc_test.id}": ["A result value is required."]}

    def test_not_found_404(self, lab_client):
        client, _ = lab_client
        response = client.post("/api/lab-orders/999999/collect-sample/")
        assert response.status_code == 404
        assert response.data["detail"] == "Order not found."


class TestReports:
    def test_list_by_patient(self, doctor_client, lab_client, order, cbc_test, patient):
        client, _ = lab_client
        client.post(f"/api/lab-orders/{order.id}/collect-sample/")
        client.post(f"/api/lab-orders/{order.id}/start/")
        client.post(
            f"/api/lab-orders/{order.id}/results/",
            {"results": [{"test": cbc_test.id, "value": "5.2"}]},
            format="json",
        )
        view_client, _ = doctor_client
        response = view_client.get(f"/api/reports/?patient={patient.id}")
        assert response.status_code == 200
        assert response.data["count"] == 1


class TestReportPdf:
    """render_report_pdf is exercised end-to-end via portal/tests.py's
    TestPortalReportFile; this covers the structured-results branch directly."""

    def test_renders_lab_results_table(self, lab_client, order, cbc_test):
        from .pdf import render_report_pdf

        client, _ = lab_client
        client.post(f"/api/lab-orders/{order.id}/collect-sample/")
        client.post(f"/api/lab-orders/{order.id}/start/")
        client.post(
            f"/api/lab-orders/{order.id}/results/",
            {"results": [{"test": cbc_test.id, "value": "5.2"}]},
            format="json",
        )
        order.refresh_from_db()
        pdf_bytes = render_report_pdf(order.report)
        assert pdf_bytes.startswith(b"%PDF")
        assert len(pdf_bytes) > 500
