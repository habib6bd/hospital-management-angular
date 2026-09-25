import pytest
from django.contrib.auth import get_user_model
from rest_framework.response import Response
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from .permissions import PATIENTS_MANAGE, PORTAL_VIEW, ROLE_PERMISSIONS, require, role_has_permission

pytestmark = pytest.mark.django_db

User = get_user_model()


def test_user_model_has_hospital_fields():
    user = User.objects.create_user(username="demo", password="demo1234", role="doctor")
    assert user.role == "doctor"
    assert user.staff_id is None
    assert user.patient_id is None
    assert user.avatar_url is None


@pytest.fixture
def doctor(db):
    return User.objects.create_user(
        username="doctor",
        password="demo1234",
        role="doctor",
        first_name="Imran",
        last_name="Hossain",
        email="doctor@hms.example",
    )


class TestTokenObtain:
    def test_happy_path_returns_access_and_refresh(self, doctor):
        response = APIClient().post(
            "/api/token/", {"username": "doctor", "password": "demo1234"}, format="json"
        )
        assert response.status_code == 200
        assert set(response.data.keys()) == {"access", "refresh"}

    def test_bad_credentials_matches_mock_message(self, doctor):
        response = APIClient().post(
            "/api/token/", {"username": "doctor", "password": "wrong"}, format="json"
        )
        assert response.status_code == 401
        assert response.data["detail"] == "No active account found with the given credentials"


class TestTokenRefresh:
    def test_happy_path(self, doctor):
        client = APIClient()
        login = client.post(
            "/api/token/", {"username": "doctor", "password": "demo1234"}, format="json"
        )
        response = client.post(
            "/api/token/refresh/", {"refresh": login.data["refresh"]}, format="json"
        )
        assert response.status_code == 200
        assert set(response.data.keys()) == {"access"}

    def test_invalid_token_matches_mock_message(self):
        response = APIClient().post(
            "/api/token/refresh/", {"refresh": "not-a-token"}, format="json"
        )
        assert response.status_code == 401
        assert response.data["detail"] == "Token is invalid or expired"


class TestTokenBlacklist:
    def test_happy_path_returns_empty_body(self, doctor):
        client = APIClient()
        login = client.post(
            "/api/token/", {"username": "doctor", "password": "demo1234"}, format="json"
        )
        response = client.post(
            "/api/token/blacklist/", {"refresh": login.data["refresh"]}, format="json"
        )
        assert response.status_code == 200
        assert response.data == {}


class TestAuthMe:
    def test_happy_path_matches_auth_user_dto_shape(self, doctor):
        client = APIClient()
        login = client.post(
            "/api/token/", {"username": "doctor", "password": "demo1234"}, format="json"
        )
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = client.get("/api/auth/me/")
        assert response.status_code == 200
        assert response.data == {
            "id": doctor.id,
            "username": "doctor",
            "email": "doctor@hms.example",
            "first_name": "Imran",
            "last_name": "Hossain",
            "role": "doctor",
            "staff_id": None,
            "patient_id": None,
            "avatar_url": None,
        }

    def test_anonymous_returns_401(self):
        response = APIClient().get("/api/auth/me/")
        assert response.status_code == 401
        assert response.data["detail"] == "Authentication credentials were not provided."


class TestRolePermissionMatrix:
    """
    Transcribes src/app/core/auth/permission.strategies.ts ROLE_DEFINITIONS as a
    guard: if the frontend's role matrix ever changes, this test should be
    updated in lockstep so the backend's enforcement stays in sync.
    """

    def test_admin_has_everything_except_portal(self):
        assert PORTAL_VIEW not in ROLE_PERMISSIONS["admin"]
        assert role_has_permission("admin", PATIENTS_MANAGE)

    def test_patient_only_has_portal_and_notifications(self):
        assert ROLE_PERMISSIONS["patient"] == {"portal.view", "notifications.view"}

    def test_lab_technician_cannot_manage_patients(self):
        assert not role_has_permission("lab_technician", PATIENTS_MANAGE)

    def test_receptionist_can_manage_billing_but_not_inventory(self):
        assert role_has_permission("receptionist", "billing.manage")
        assert not role_has_permission("receptionist", "inventory.view")

    def test_unknown_role_has_no_permissions(self):
        assert not role_has_permission("nobody", PATIENTS_MANAGE)


class _PatientsManageOnlyView(APIView):
    permission_classes = [require(PATIENTS_MANAGE)]

    def get(self, request):
        return Response({"ok": True})


class TestRequirePermissionDecorator:
    """Exercises `require()` end-to-end against a throwaway view."""

    def test_role_with_permission_gets_200(self, db):
        receptionist = User.objects.create_user(
            username="reception2", password="demo1234", role="receptionist"
        )
        request = APIRequestFactory().get("/whatever/")
        force_authenticate(request, user=receptionist)
        response = _PatientsManageOnlyView.as_view()(request)
        assert response.status_code == 200

    def test_role_without_permission_gets_403(self, db):
        lab_tech = User.objects.create_user(
            username="lab2", password="demo1234", role="lab_technician"
        )
        request = APIRequestFactory().get("/whatever/")
        force_authenticate(request, user=lab_tech)
        response = _PatientsManageOnlyView.as_view()(request)
        assert response.status_code == 403

    def test_anonymous_gets_401(self):
        request = APIRequestFactory().get("/whatever/")
        response = _PatientsManageOnlyView.as_view()(request)
        assert response.status_code == 401
