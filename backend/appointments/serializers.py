from rest_framework import serializers

from .models import Appointment, Doctor, DoctorSchedule


class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = ["id", "full_name", "specialty", "department", "consultation_fee", "room_number"]


class DoctorScheduleSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)

    class Meta:
        model = DoctorSchedule
        fields = ["id", "doctor", "doctor_name", "weekday", "start_time", "end_time", "slot_minutes", "is_active"]


class AppointmentSerializer(serializers.ModelSerializer):
    # Model field is `patient_id` (plain int, not yet a FK — see models.py);
    # wire field is `patient`, matching AppointmentDto exactly.
    patient = serializers.IntegerField(source="patient_id")

    class Meta:
        model = Appointment
        fields = [
            "id",
            "patient",
            "patient_name",
            "patient_mrn",
            "doctor",
            "doctor_name",
            "specialty",
            "date",
            "start_time",
            "end_time",
            "status",
            "token_number",
            "reason",
            "checked_in_at",
            "created_at",
        ]
