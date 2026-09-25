from django.db import models


class Doctor(models.Model):
    """
    Operational + public-profile fields live on one model (mirrors db.ts, where
    DOCTOR_SEED holds the operational row and DOCTOR_PROFILES only adds the
    public-site extras keyed by the same id — one table, not two).
    """

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"

    full_name = models.CharField(max_length=150)
    name_bn = models.CharField(max_length=150, blank=True, default="")
    specialty = models.CharField(max_length=100)
    department = models.CharField(max_length=100)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2)
    room_number = models.CharField(max_length=20)

    # Public-site profile fields (src/app/core/mock/seeds/public.seed.ts DOCTOR_PROFILES).
    designation = models.JSONField(default=dict, blank=True)
    qualifications = models.CharField(max_length=255, blank=True, default="")
    experience_years = models.PositiveIntegerField(default=0)
    gender = models.CharField(max_length=10, choices=Gender.choices, default=Gender.MALE)
    bio = models.JSONField(default=dict, blank=True)
    photo_url = models.URLField(null=True, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.full_name


class DoctorSchedule(models.Model):
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name="schedules")
    weekday = models.PositiveSmallIntegerField()  # 0=Sunday .. 6=Saturday, per JS Date.getDay()
    start_time = models.TimeField()
    end_time = models.TimeField()
    slot_minutes = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["weekday", "start_time"]
        indexes = [models.Index(fields=["doctor", "weekday"])]

    def __str__(self) -> str:
        return f"{self.doctor.full_name} — weekday {self.weekday}"


class AppointmentStatus(models.TextChoices):
    BOOKED = "booked", "Booked"
    CHECKED_IN = "checked_in", "Checked in"
    IN_CONSULTATION = "in_consultation", "In consultation"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"
    NO_SHOW = "no_show", "No show"


# Statuses that hold a slot as unavailable for further booking.
SLOT_HOLDING_STATUSES = {
    AppointmentStatus.BOOKED,
    AppointmentStatus.CHECKED_IN,
    AppointmentStatus.IN_CONSULTATION,
    AppointmentStatus.COMPLETED,
}


class Appointment(models.Model):
    """
    `patient_id` is a plain integer, not yet a FK (see accounts.User.patient_id
    for the same reasoning — patients.Patient does not exist until Phase 4).
    Guest bookings (src/app/core/mock/handlers/public.handler.ts) use the
    sentinel `patient_id=0` with `patient_mrn="GUEST"` and no real patient
    record, exactly like the mock, so this can't be a NOT NULL FK anyway.
    `patient_name`/`patient_mrn`/`doctor_name`/`specialty` are snapshotted at
    creation time (not live-joined), matching the mock exactly.
    """

    patient_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    patient_name = models.CharField(max_length=150)
    patient_mrn = models.CharField(max_length=30)

    doctor = models.ForeignKey(Doctor, on_delete=models.PROTECT, related_name="appointments")
    doctor_name = models.CharField(max_length=150)
    specialty = models.CharField(max_length=100)

    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(
        max_length=20, choices=AppointmentStatus.choices, default=AppointmentStatus.BOOKED
    )
    token_number = models.PositiveIntegerField(null=True, blank=True)
    reason = models.CharField(max_length=255, blank=True, default="")
    checked_in_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["start_time"]
        indexes = [
            models.Index(fields=["doctor", "date"]),
            models.Index(fields=["patient_id"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient_name} with {self.doctor_name} on {self.date}"
