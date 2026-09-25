import pytest
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.django_db


def test_user_model_has_hospital_fields():
    User = get_user_model()
    user = User.objects.create_user(username="demo", password="demo1234", role="doctor")
    assert user.role == "doctor"
    assert user.staff_id is None
    assert user.patient_id is None
    assert user.avatar_url is None
