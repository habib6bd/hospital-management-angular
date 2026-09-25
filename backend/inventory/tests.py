from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from .models import Batch, InventoryItem, StockMovement, Supplier

pytestmark = pytest.mark.django_db

User = get_user_model()


def auth_client(role: str) -> APIClient:
    user = User.objects.create_user(username=f"inv_{role}", password="demo1234", role=role)
    client = APIClient()
    login = client.post("/api/token/", {"username": user.username, "password": "demo1234"}, format="json")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    return client


@pytest.fixture
def pharmacist_client():
    return auth_client("pharmacist")


@pytest.fixture
def doctor_client():
    return auth_client("doctor")


@pytest.fixture
def supplier():
    return Supplier.objects.create(name="ACME Pharma", contact_person="Karim", phone="01700000000")


@pytest.fixture
def item(supplier):
    return InventoryItem.objects.create(
        code="PARA500",
        name="Paracetamol 500mg",
        category="medicine",
        unit="tablet",
        quantity_in_stock=100,
        reorder_level=20,
        unit_price="2.50",
        supplier=supplier,
    )


class TestSuppliers:
    def test_list_and_create(self, pharmacist_client):
        response = pharmacist_client.post(
            "/api/suppliers/", {"name": "New Supplier"}, format="json"
        )
        assert response.status_code == 201
        assert response.data["is_active"] is True

        response = pharmacist_client.get("/api/suppliers/")
        assert response.data["count"] == 1

    def test_blank_name_rejected(self, pharmacist_client):
        response = pharmacist_client.post("/api/suppliers/", {"name": ""}, format="json")
        assert response.status_code == 400
        assert response.data == {"name": ["This field may not be blank."]}

    def test_wrong_role_403(self, doctor_client):
        response = doctor_client.get("/api/suppliers/")
        assert response.status_code == 403


class TestInventoryItems:
    def test_create_happy_path(self, pharmacist_client, supplier):
        response = pharmacist_client.post(
            "/api/inventory/",
            {
                "code": "AMOX250",
                "name": "Amoxicillin 250mg",
                "category": "medicine",
                "unit": "capsule",
                "reorder_level": 10,
                "unit_price": "5.5",
                "supplier": supplier.id,
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.data["quantity_in_stock"] == 0
        assert response.data["unit_price"] == "5.50"
        assert response.data["is_active"] is True

    def test_duplicate_code_rejected(self, pharmacist_client, item):
        response = pharmacist_client.post(
            "/api/inventory/",
            {"code": "PARA500", "name": "Dup", "reorder_level": 1, "unit_price": "1.00"},
            format="json",
        )
        assert response.status_code == 400
        assert response.data["code"] == ["An item with this code already exists."]

    def test_list_stock_status_low(self, pharmacist_client, item):
        item.quantity_in_stock = 5
        item.save()
        response = pharmacist_client.get("/api/inventory/?stock_status=low")
        assert response.data["count"] == 1

    def test_detail_404(self, pharmacist_client):
        response = pharmacist_client.get("/api/inventory/999999/")
        assert response.status_code == 404
        assert response.data["detail"] == "Item not found."

    def test_patch_supplier_only_changes_when_present(self, pharmacist_client, item, supplier):
        response = pharmacist_client.patch(
            f"/api/inventory/{item.id}/", {"name": "Renamed"}, format="json"
        )
        assert response.status_code == 200
        assert response.data["supplier"] == supplier.id  # not cleared, unlike the mock

    def test_patch_supplier_explicit_clear(self, pharmacist_client, item):
        response = pharmacist_client.patch(
            f"/api/inventory/{item.id}/", {"supplier": None}, format="json"
        )
        assert response.status_code == 200
        assert response.data["supplier"] is None

    def test_alerts_low_stock(self, pharmacist_client, item):
        item.quantity_in_stock = 5
        item.save()
        response = pharmacist_client.get("/api/inventory/alerts/")
        assert response.data["count"] == 1

    def test_alerts_expiring(self, pharmacist_client, item):
        Batch.objects.create(
            item=item, batch_number="B1", quantity=10, expiry_date=date.today() + timedelta(days=30)
        )
        item.recompute_nearest_expiry()
        response = pharmacist_client.get("/api/inventory/alerts/")
        assert response.data["count"] == 1


class TestStockMovements:
    def test_stock_in_creates_batch_and_updates_quantity(self, pharmacist_client, item):
        response = pharmacist_client.post(
            "/api/stock-movements/",
            {
                "item": item.id,
                "movement_type": "stock_in",
                "quantity": 50,
                "expiry_date": (date.today() + timedelta(days=180)).isoformat(),
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.data["balance_after"] == 150
        item.refresh_from_db()
        assert item.quantity_in_stock == 150
        assert Batch.objects.filter(item=item).count() == 1

    def test_stock_out_fefo_consumes_earliest_batch(self, pharmacist_client, item):
        Batch.objects.create(
            item=item, batch_number="EARLY", quantity=30, expiry_date=date.today() + timedelta(days=10)
        )
        Batch.objects.create(
            item=item, batch_number="LATE", quantity=30, expiry_date=date.today() + timedelta(days=100)
        )
        response = pharmacist_client.post(
            "/api/stock-movements/",
            {"item": item.id, "movement_type": "stock_out", "quantity": 20},
            format="json",
        )
        assert response.status_code == 201
        assert response.data["batch_number"] == "EARLY"
        early = Batch.objects.get(batch_number="EARLY")
        assert early.quantity == 10

    def test_insufficient_stock_400(self, pharmacist_client, item):
        response = pharmacist_client.post(
            "/api/stock-movements/",
            {"item": item.id, "movement_type": "stock_out", "quantity": 1000},
            format="json",
        )
        assert response.status_code == 400
        assert response.data["quantity"] == ["Only 100 tablet in stock; cannot remove 1000."]

    def test_adjustment_exempt_from_insufficient_stock_guard(self, pharmacist_client, item):
        response = pharmacist_client.post(
            "/api/stock-movements/",
            {"item": item.id, "movement_type": "adjustment", "quantity": 1000},
            format="json",
        )
        assert response.status_code == 201
        item.refresh_from_db()
        assert item.quantity_in_stock == 0

    def test_invalid_item_400(self, pharmacist_client):
        response = pharmacist_client.post(
            "/api/stock-movements/",
            {"item": 999999, "movement_type": "stock_in", "quantity": 10},
            format="json",
        )
        assert response.status_code == 400
        assert response.data["item"] == ["Select a valid item."]

    def test_list(self, pharmacist_client, item):
        StockMovement.objects.create(
            item=item, movement_type="stock_in", quantity=10, balance_after=110, performed_by_name="Test"
        )
        response = pharmacist_client.get("/api/stock-movements/")
        assert response.status_code == 200
        assert response.data["count"] == 1

    def test_wrong_role_403(self, doctor_client, item):
        response = doctor_client.post(
            "/api/stock-movements/",
            {"item": item.id, "movement_type": "stock_in", "quantity": 10},
            format="json",
        )
        assert response.status_code == 403
