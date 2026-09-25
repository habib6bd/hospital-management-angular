import re
from datetime import date

from rest_framework import serializers

from .models import Admission, Bed, MedicalHistoryEntry, Patient, Ward

BD_PHONE_REGEX = r"^01[3-9]\d{8}$"


class AdmissionSerializer(serializers.ModelSerializer):
    ward_name = serializers.CharField(source="ward.name", read_only=True)
    bed_number = serializers.CharField(source="bed.bed_number", read_only=True)
    summary_report = serializers.IntegerField(source="summary_report_id", read_only=True)

    class Meta:
        model = Admission
        fields = [
            "id",
            "ward",
            "ward_name",
            "bed",
            "bed_number",
            "admitted_at",
            "discharged_at",
            "attending_doctor_name",
            "summary_report",
        ]


class WardSerializer(serializers.ModelSerializer):
    occupied_beds = serializers.IntegerField(read_only=True)

    class Meta:
        model = Ward
        fields = ["id", "name", "ward_type", "floor", "total_beds", "occupied_beds"]


class BedSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True, default=None)

    class Meta:
        model = Bed
        fields = ["id", "ward", "bed_number", "status", "patient", "patient_name"]


class MedicalHistoryEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalHistoryEntry
        fields = ["id", "patient", "recorded_at", "recorded_by_name", "category", "title", "details"]
        read_only_fields = ["patient", "recorded_at", "recorded_by_name"]


class PatientSerializer(serializers.ModelSerializer):
    current_admission = AdmissionSerializer(read_only=True)

    class Meta:
        model = Patient
        fields = [
            "id",
            "mrn",
            "full_name",
            "gender",
            "date_of_birth",
            "blood_group",
            "phone",
            "email",
            "nid",
            "address",
            "patient_type",
            "emergency_contact_name",
            "emergency_contact_phone",
            "allergies",
            "registered_at",
            "current_admission",
        ]
        read_only_fields = ["mrn", "registered_at", "current_admission"]


class PatientWriteSerializer(serializers.Serializer):
    """
    Full-replace semantics on purpose (see backend/README.md "Design
    decisions"): an omitted field resets to its create-time default, exactly
    like the mock's `buildPatient()`, because the frontend's edit form always
    submits the complete object.
    """

    full_name = serializers.CharField(required=False, allow_blank=True, default="")
    gender = serializers.CharField(required=False, allow_blank=True, default="")
    date_of_birth = serializers.CharField(required=False, allow_blank=True, default="")
    blood_group = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    phone = serializers.CharField(required=False, allow_blank=True, default="")
    email = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    nid = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    address = serializers.CharField(required=False, allow_blank=True, default="")
    patient_type = serializers.CharField(required=False, allow_blank=True, default="opd")
    emergency_contact_name = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, default=None
    )
    emergency_contact_phone = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, default=None
    )
    allergies = serializers.ListField(child=serializers.CharField(), required=False, default=list)

    def validate(self, attrs):
        errors: dict[str, list[str]] = {}

        if not attrs.get("full_name", "").strip():
            errors["full_name"] = ["This field may not be blank."]

        dob_raw = attrs.get("date_of_birth", "")
        if not dob_raw:
            errors["date_of_birth"] = ["This field is required."]
        else:
            try:
                dob = date.fromisoformat(dob_raw)
                if dob > date.today():
                    errors["date_of_birth"] = ["Date of birth cannot be in the future."]
            except ValueError:
                errors["date_of_birth"] = ["This field is required."]

        if not re.match(BD_PHONE_REGEX, attrs.get("phone", "") or ""):
            errors["phone"] = ["Enter a valid Bangladeshi mobile number."]

        nid = attrs.get("nid")
        if nid:
            if not re.match(r"^\d{10}$|^\d{13}$|^\d{17}$", nid):
                errors["nid"] = ["Enter a valid NID (10, 13 or 17 digits)."]
            else:
                existing = self.context.get("existing_nid")
                clashing = Patient.objects.filter(nid=nid).exclude(
                    pk=self.context.get("instance_pk")
                )
                if nid != existing and clashing.exists():
                    errors["nid"] = ["A patient with this NID already exists."]

        if errors:
            raise serializers.ValidationError(errors)
        return attrs
