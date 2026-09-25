from django.db import models


class Department(models.Model):
    slug = models.SlugField(primary_key=True, max_length=50)
    icon = models.CharField(max_length=50)
    image = models.CharField(max_length=255)
    name = models.JSONField()
    summary = models.JSONField()
    description = models.JSONField()
    services = models.JSONField(default=list, blank=True)  # list[Localized]

    class Meta:
        ordering = ["slug"]

    def __str__(self) -> str:
        return self.slug


class HospitalService(models.Model):
    class Category(models.TextChoices):
        CLINICAL = "clinical", "Clinical"
        DIAGNOSTIC = "diagnostic", "Diagnostic"
        SUPPORT = "support", "Support"

    slug = models.SlugField(primary_key=True, max_length=50)
    icon = models.CharField(max_length=50)
    image = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=Category.choices)
    is_emergency = models.BooleanField(default=False)
    name = models.JSONField()
    summary = models.JSONField()
    description = models.JSONField()
    features = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["slug"]

    def __str__(self) -> str:
        return self.slug


class HealthPackage(models.Model):
    name = models.JSONField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_popular = models.BooleanField(default=False)
    tests = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["id"]


class Testimonial(models.Model):
    name = models.JSONField()
    location = models.JSONField()
    quote = models.JSONField()

    class Meta:
        ordering = ["id"]


class GuestBooking(models.Model):
    """Contact details for an appointment booked without an account."""

    reference = models.CharField(max_length=30, unique=True)
    appointment = models.OneToOneField(
        "appointments.Appointment", on_delete=models.CASCADE, related_name="guest_booking"
    )
    phone = models.CharField(max_length=20)
    age = models.PositiveIntegerField()
    gender = models.CharField(max_length=10)

    def __str__(self) -> str:
        return self.reference


class ContactMessage(models.Model):
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    email = models.EmailField(null=True, blank=True)
    subject = models.CharField(max_length=255, blank=True, default="")
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
