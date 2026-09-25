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

    `patient_id` is a plain integer (not yet a FK) because the `patients` app's
    `Patient` model does not exist until Phase 4 — it is upgraded to a real
    ForeignKey once that model lands, to avoid a premature cross-app migration
    dependency. AuthUserDto (src/app/core/auth/auth.model.ts) is the wire
    contract this model's serializer must produce.
    """

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PATIENT)
    staff_id = models.CharField(max_length=20, null=True, blank=True, unique=True)
    patient_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    avatar_url = models.URLField(null=True, blank=True)

    def __str__(self) -> str:
        return self.username
