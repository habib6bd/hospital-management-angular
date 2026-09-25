from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    """Mirrors src/app/core/auth/auth.model.ts ROLES exactly — snake_case on the wire."""

    ADMIN = "admin", "Administrator"
    DOCTOR = "doctor", "Doctor"
    NURSE = "nurse", "Nurse"
    RECEPTIONIST = "receptionist", "Receptionist"
    LAB_TECHNICIAN = "lab_technician", "Lab Technician"
    PHARMACIST = "pharmacist", "Pharmacist"
    PATIENT = "patient", "Patient"


class User(AbstractUser):
    """
    Custom user model, defined before the first migration per the project brief.

    AuthUserDto (src/app/core/auth/auth.model.ts) is the wire contract this
    model's serializer must produce. `patient` and `doctor` are FKs to
    patients.Patient and appointments.Doctor respectively; Django's
    FK-plus-`_id` convention means `user.patient_id`/`user.doctor_id` already
    read the raw id with no extra join, matching AuthUserDto's `patient_id`/
    `doctor_id` fields exactly.
    """

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PATIENT)
    staff_id = models.CharField(max_length=20, null=True, blank=True, unique=True)
    patient = models.ForeignKey(
        "patients.Patient", null=True, blank=True, on_delete=models.SET_NULL, related_name="user_account"
    )
    doctor = models.ForeignKey(
        "appointments.Doctor", null=True, blank=True, on_delete=models.SET_NULL, related_name="user_account"
    )
    avatar_url = models.URLField(null=True, blank=True)

    def __str__(self) -> str:
        return self.username
