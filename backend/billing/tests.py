from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from patients.models import Patient

from .models import Invoice, InvoiceLineItem

pytestmark = pytest.mark.django_db

User = get_user_model()


def auth_client(role: str, **extra) -> tuple[APIClient, "User"]:
    user = User.objects.create_user(username=f"bill_{role}_{extra.get('patient_id', 'x')}", password="demo1234", role=role, **extra)
    client = APIClient()
    login = client.post("/api/token/", {"username": user.username, "password": "demo1234"}, format="json")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    return client, user


@pytest.fixture
def receptionist_client():
    return auth_client("receptionist")


@pytest.fixture
def doctor_client():
    return auth_client("doctor")


@pytest.fixture
def patient(db):
    return Patient.objects.create(
        mrn="HMS-2026-0001", full_name="Rafiqul Islam", gender="male", date_of_birth="1985-01-01", phone="01712345678"
    )


@pytest.fixture
def patient_client(patient):
    return auth_client("patient", patient_id=patient.id)


@pytest.fixture
def other_patient(db):
    return Patient.objects.create(
        mrn="HMS-2026-0002", full_name="Someone Else", gender="female", date_of_birth="1990-01-01", phone="01812345678"
    )


@pytest.fixture
def invoice(patient):
    inv = Invoice.objects.create(
        invoice_number="INV-2026-00001",
        patient_id=patient.id,
        patient_name=patient.full_name,
        patient_mrn=patient.mrn,
        status="unpaid",
        due_date=date.today() + timedelta(days=14),
    )
    InvoiceLineItem.objects.create(
        invoice=inv, source="consultation", description="Consultation fee", quantity=1, unit_price="1000.00"
    )
    return inv


class TestInvoiceCreate:
    def test_happy_path(self, receptionist_client, patient):
        client, _ = receptionist_client
        response = client.post(
            "/api/invoices/",
            {
                "patient": patient.id,
                "items": [{"description": "Consultation", "quantity": 1, "unit_price": 1200}],
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.data["invoice_number"].startswith("INV-")
        assert response.data["status"] == "unpaid"

    def test_validation_errors(self, receptionist_client):
        client, _ = receptionist_client
        response = client.post(
            "/api/invoices/", {"patient": 999999, "items": []}, format="json"
        )
        assert response.status_code == 400
        assert response.data["patient"] == ["Select a valid patient."]
        assert response.data["items"] == ["An invoice needs at least one line item."]

    def test_discount_exceeds_line_total(self, receptionist_client, patient):
        client, _ = receptionist_client
        response = client.post(
            "/api/invoices/",
            {
                "patient": patient.id,
                "items": [
                    {"description": "X", "quantity": 1, "unit_price": 100, "discount": 200}
                ],
            },
            format="json",
        )
        assert response.status_code == 400
        assert response.data["items.0.discount"] == ["Discount cannot exceed the line total."]

    def test_patient_cannot_create(self, patient_client, patient):
        client, _ = patient_client
        response = client.post(
            "/api/invoices/",
            {"patient": patient.id, "items": [{"description": "X", "quantity": 1, "unit_price": 10}]},
            format="json",
        )
        assert response.status_code == 403


class TestInvoiceListAndDetail:
    def test_staff_list(self, receptionist_client, invoice):
        client, _ = receptionist_client
        response = client.get("/api/invoices/")
        assert response.status_code == 200
        assert response.data["count"] == 1

    def test_patient_sees_only_own(self, patient_client, invoice, other_patient):
        other_invoice = Invoice.objects.create(
            invoice_number="INV-2026-00002",
            patient_id=other_patient.id,
            patient_name=other_patient.full_name,
            patient_mrn=other_patient.mrn,
            status="unpaid",
            due_date=date.today() + timedelta(days=14),
        )
        client, _ = patient_client
        response = client.get("/api/invoices/")
        assert response.status_code == 200
        assert response.data["count"] == 1
        assert response.data["results"][0]["id"] == invoice.id

    def test_patient_cannot_see_others_detail_404(self, patient_client, other_patient):
        other_invoice = Invoice.objects.create(
            invoice_number="INV-2026-00003",
            patient_id=other_patient.id,
            patient_name=other_patient.full_name,
            patient_mrn=other_patient.mrn,
            status="unpaid",
            due_date=date.today() + timedelta(days=14),
        )
        client, _ = patient_client
        response = client.get(f"/api/invoices/{other_invoice.id}/")
        assert response.status_code == 404
        assert response.data["detail"] == "Invoice not found."

    def test_patient_can_see_own_detail(self, patient_client, invoice):
        client, _ = patient_client
        response = client.get(f"/api/invoices/{invoice.id}/")
        assert response.status_code == 200
        assert response.data["id"] == invoice.id

    def test_lab_technician_cannot_view_billing(self, invoice):
        client, _ = auth_client("lab_technician")
        response = client.get("/api/invoices/")
        assert response.status_code == 403


class TestPayments:
    def test_happy_path_marks_paid(self, receptionist_client, invoice):
        client, _ = receptionist_client
        response = client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": 1050}, format="json")
        assert response.status_code == 200
        assert response.data["status"] == "paid"

    def test_partial_payment(self, receptionist_client, invoice):
        client, _ = receptionist_client
        response = client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": 500}, format="json")
        assert response.status_code == 200
        assert response.data["status"] == "partial"

    def test_overpayment_rejected(self, receptionist_client, invoice):
        client, _ = receptionist_client
        response = client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": 999999}, format="json")
        assert response.status_code == 400
        assert response.data["amount"][0].startswith("The outstanding balance is ৳")

    def test_patient_cannot_pay(self, patient_client, invoice):
        client, _ = patient_client
        response = client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": 100}, format="json")
        assert response.status_code == 403
        assert response.data["detail"] == "Payments are recorded by hospital staff."

    def test_cancelled_invoice_rejects_payment(self, receptionist_client, invoice):
        client, _ = receptionist_client
        invoice.status = "cancelled"
        invoice.save()
        response = client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": 100}, format="json")
        assert response.status_code == 409
        assert response.data["detail"] == "A cancelled invoice cannot take payments."


class TestCancel:
    def test_happy_path(self, receptionist_client, invoice):
        client, _ = receptionist_client
        response = client.post(f"/api/invoices/{invoice.id}/cancel/")
        assert response.status_code == 200
        assert response.data["status"] == "cancelled"

    def test_with_payments_is_409(self, receptionist_client, invoice):
        client, _ = receptionist_client
        client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": 100}, format="json")
        response = client.post(f"/api/invoices/{invoice.id}/cancel/")
        assert response.status_code == 409
        assert response.data["detail"] == "An invoice with payments must be refunded, not cancelled."

    def test_patient_cannot_cancel(self, patient_client, invoice):
        client, _ = patient_client
        response = client.post(f"/api/invoices/{invoice.id}/cancel/")
        assert response.status_code == 403
        assert response.data["detail"] == "Only hospital staff can cancel an invoice."


class TestSummary:
    def test_staff_can_view(self, receptionist_client, invoice):
        client, _ = receptionist_client
        response = client.get("/api/invoices/summary/")
        assert response.status_code == 200
        assert response.data["total_billed"] == "1050.00"

    def test_patient_cannot_view(self, patient_client):
        client, _ = patient_client
        response = client.get("/api/invoices/summary/")
        assert response.status_code == 403


class TestDownloadUrl:
    def test_happy_path(self, receptionist_client, invoice):
        client, _ = receptionist_client
        response = client.get(f"/api/invoices/{invoice.id}/download-url/")
        assert response.status_code == 200
        assert response.data["filename"] == f"{invoice.invoice_number}.pdf"

    def test_patient_other_invoice_404(self, patient_client, other_patient):
        other_invoice = Invoice.objects.create(
            invoice_number="INV-2026-00004",
            patient_id=other_patient.id,
            patient_name=other_patient.full_name,
            patient_mrn=other_patient.mrn,
            status="unpaid",
            due_date=date.today() + timedelta(days=14),
        )
        client, _ = patient_client
        response = client.get(f"/api/invoices/{other_invoice.id}/download-url/")
        assert response.status_code == 404
