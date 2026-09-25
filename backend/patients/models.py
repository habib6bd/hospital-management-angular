from django.db import models


class Ward(models.Model):
    class WardType(models.TextChoices):
        GENERAL = "general", "General"
        ICU = "icu", "ICU"
        MATERNITY = "maternity", "Maternity"
        PAEDIATRIC = "paediatric", "Paediatric"
        ISOLATION = "isolation", "Isolation"

    name = models.CharField(max_length=100)
    ward_type = models.CharField(max_length=20, choices=WardType.choices)
    floor = models.PositiveIntegerField()
    total_beds = models.PositiveIntegerField()

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.name

    @property
    def occupied_beds(self) -> int:
        """
        Computed live from bed status rather than a mutable counter the mock
        increments/decrements by hand on admit/discharge — same wire value,
        but can never drift out of sync with the beds table.
        """
        return self.beds.filter(status=Bed.Status.OCCUPIED).count()


class Bed(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        OCCUPIED = "occupied", "Occupied"
        CLEANING = "cleaning", "Cleaning"
        MAINTENANCE = "maintenance", "Maintenance"

    ward = models.ForeignKey(Ward, on_delete=models.CASCADE, related_name="beds")
    bed_number = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    patient = models.ForeignKey(
        "Patient", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.ward.name} / {self.bed_number}"


class Patient(models.Model):
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    class PatientType(models.TextChoices):
        OPD = "opd", "OPD"
        IPD = "ipd", "IPD"

    mrn = models.CharField(max_length=30, unique=True)
    full_name = models.CharField(max_length=150)
    gender = models.CharField(max_length=10, choices=Gender.choices, default=Gender.OTHER)
    date_of_birth = models.DateField()
    blood_group = models.CharField(max_length=5, null=True, blank=True)
    phone = models.CharField(max_length=20)
    email = models.EmailField(null=True, blank=True)
    nid = models.CharField(max_length=20, null=True, blank=True, unique=True)
    address = models.CharField(max_length=255, blank=True, default="")
    patient_type = models.CharField(
        max_length=10, choices=PatientType.choices, default=PatientType.OPD
    )
    emergency_contact_name = models.CharField(max_length=150, null=True, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, null=True, blank=True)
    allergies = models.JSONField(default=list, blank=True)
    registered_at = models.DateTimeField(auto_now_add=True)
    current_admission = models.ForeignKey(
        "Admission", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-registered_at"]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.mrn})"


class Admission(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="admissions")
    ward = models.ForeignKey(Ward, on_delete=models.PROTECT, related_name="admissions")
    bed = models.ForeignKey(Bed, on_delete=models.PROTECT, related_name="admissions")
    admitted_at = models.DateTimeField(auto_now_add=True)
    discharged_at = models.DateTimeField(null=True, blank=True)
    attending_doctor_name = models.CharField(max_length=150, default="Dr. On Duty")
    summary_report_id = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-admitted_at"]

    def __str__(self) -> str:
        return f"{self.patient.full_name} in {self.ward.name}/{self.bed.bed_number}"


class MedicalHistoryEntry(models.Model):
    class Category(models.TextChoices):
        DIAGNOSIS = "diagnosis", "Diagnosis"
        PROCEDURE = "procedure", "Procedure"
        ALLERGY = "allergy", "Allergy"
        MEDICATION = "medication", "Medication"
        NOTE = "note", "Note"

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="history")
    recorded_at = models.DateTimeField(auto_now_add=True)
    recorded_by_name = models.CharField(max_length=150, default="System")
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.NOTE)
    title = models.CharField(max_length=255)
    details = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-recorded_at"]

    def __str__(self) -> str:
        return f"{self.title} ({self.patient.full_name})"
