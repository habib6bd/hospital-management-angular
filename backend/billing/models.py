from decimal import Decimal

from django.db import models

STICKY_STATUSES = {"draft", "cancelled", "refunded"}


class Invoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        UNPAID = "unpaid", "Unpaid"
        PARTIAL = "partial", "Partial"
        PAID = "paid", "Paid"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"

    invoice_number = models.CharField(max_length=30, unique=True)

    # Plain integer, not a FK, for the same reason as appointments.Appointment.patient_id.
    patient_id = models.PositiveIntegerField(db_index=True)
    patient_name = models.CharField(max_length=150)
    patient_mrn = models.CharField(max_length=30)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNPAID)
    tax_rate = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("0.0500"))
    issued_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField()
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-issued_at"]

    def __str__(self) -> str:
        return self.invoice_number


class InvoiceLineItem(models.Model):
    class Source(models.TextChoices):
        CONSULTATION = "consultation", "Consultation"
        ADMISSION = "admission", "Admission"
        PHARMACY = "pharmacy", "Pharmacy"
        LAB = "lab", "Lab"
        PROCEDURE = "procedure", "Procedure"

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.CONSULTATION)
    description = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    reference = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.description


class Payment(models.Model):
    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        CARD = "card", "Card"
        BKASH = "bkash", "bKash"
        NAGAD = "nagad", "Nagad"
        BANK_TRANSFER = "bank_transfer", "Bank transfer"
        INSURANCE = "insurance", "Insurance"

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.CASH)
    reference = models.CharField(max_length=100, null=True, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    received_by_name = models.CharField(max_length=150, default="System")

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.invoice.invoice_number} — {self.amount}"
