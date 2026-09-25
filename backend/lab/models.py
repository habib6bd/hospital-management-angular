from django.conf import settings
from django.db import models


class LabTest(models.Model):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=150)
    specimen = models.CharField(max_length=100)
    unit = models.CharField(max_length=30)
    reference_low = models.CharField(max_length=30, null=True, blank=True)
    reference_high = models.CharField(max_length=30, null=True, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    turnaround_hours = models.PositiveIntegerField(default=24)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class ReportDocument(models.Model):
    class Kind(models.TextChoices):
        LAB_REPORT = "lab_report", "Lab report"
        PRESCRIPTION = "prescription", "Prescription"
        DISCHARGE_SUMMARY = "discharge_summary", "Discharge summary"
        INVOICE = "invoice", "Invoice"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        READY = "ready", "Ready"
        DOWNLOADED = "downloaded", "Downloaded"

    patient_id = models.PositiveIntegerField(db_index=True)
    kind = models.CharField(max_length=30, choices=Kind.choices)
    title = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    issued_at = models.DateTimeField(null=True, blank=True)
    downloaded_at = models.DateTimeField(null=True, blank=True)
    size_bytes = models.PositiveIntegerField(null=True, blank=True)
    related_order_number = models.CharField(max_length=30, null=True, blank=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self) -> str:
        return self.title


class LabOrderStatus(models.TextChoices):
    ORDERED = "ordered", "Ordered"
    SAMPLE_COLLECTED = "sample_collected", "Sample collected"
    IN_PROGRESS = "in_progress", "In progress"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class LabOrder(models.Model):
    class Priority(models.TextChoices):
        URGENT = "urgent", "Urgent"
        ROUTINE = "routine", "Routine"

    order_number = models.CharField(max_length=30, unique=True)

    # Plain integer, not a FK, for the same reason as appointments.Appointment.patient_id.
    patient_id = models.PositiveIntegerField(db_index=True)
    patient_name = models.CharField(max_length=150)
    patient_mrn = models.CharField(max_length=30)

    ordered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="lab_orders")
    status = models.CharField(max_length=20, choices=LabOrderStatus.choices, default=LabOrderStatus.ORDERED)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.ROUTINE)
    tests = models.ManyToManyField(LabTest, related_name="orders")

    ordered_at = models.DateTimeField(auto_now_add=True)
    sample_collected_at = models.DateTimeField(null=True, blank=True)
    sample_id = models.CharField(max_length=30, null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    clinical_notes = models.TextField(blank=True, default="")
    report = models.OneToOneField(
        ReportDocument, null=True, blank=True, on_delete=models.SET_NULL, related_name="lab_order"
    )

    class Meta:
        ordering = ["-ordered_at"]

    def __str__(self) -> str:
        return self.order_number

    @property
    def ordered_by_name(self) -> str:
        return f"{self.ordered_by.first_name} {self.ordered_by.last_name}".strip()


class LabResult(models.Model):
    order = models.ForeignKey(LabOrder, on_delete=models.CASCADE, related_name="results")
    test = models.ForeignKey(LabTest, on_delete=models.PROTECT, related_name="+")
    value = models.CharField(max_length=100)
    notes = models.CharField(max_length=255, blank=True, default="")
    # Snapshotted from the test definition at result-entry time, matching the mock.
    reference_low = models.CharField(max_length=30, null=True, blank=True)
    reference_high = models.CharField(max_length=30, null=True, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.test.name} = {self.value}"
