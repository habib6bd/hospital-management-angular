from rest_framework import serializers

from appointments.models import Doctor

from .constants import LANGUAGES_SPOKEN, department_slug_for, specialty_label
from .models import ContactMessage, Department, GuestBooking, HealthPackage, HospitalService, Testimonial


class DepartmentSerializer(serializers.ModelSerializer):
    doctor_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ["slug", "name", "summary", "description", "icon", "image", "services", "doctor_count"]

    def get_doctor_count(self, obj: Department) -> int:
        return sum(1 for d in Doctor.objects.only("specialty") if department_slug_for(d.specialty) == obj.slug)


class PublicDoctorSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    specialty = serializers.SerializerMethodField()
    department_slug = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    languages = serializers.SerializerMethodField()
    chamber = serializers.SerializerMethodField()

    class Meta:
        model = Doctor
        fields = [
            "id",
            "name",
            "specialty",
            "department_slug",
            "department_name",
            "designation",
            "qualifications",
            "experience_years",
            "consultation_fee",
            "room_number",
            "gender",
            "languages",
            "bio",
            "photo_url",
            "chamber",
        ]

    def get_name(self, obj: Doctor) -> dict:
        return {"en": obj.full_name, "bn": obj.name_bn}

    def get_specialty(self, obj: Doctor) -> dict:
        return specialty_label(obj.specialty)

    def get_department_slug(self, obj: Doctor) -> str | None:
        return department_slug_for(obj.specialty)

    def get_department_name(self, obj: Doctor) -> dict | None:
        slug = department_slug_for(obj.specialty)
        department = Department.objects.filter(slug=slug).first() if slug else None
        return department.name if department else None

    def get_languages(self, obj: Doctor) -> dict:
        return LANGUAGES_SPOKEN

    def get_chamber(self, obj: Doctor) -> list[dict]:
        return [
            {
                "weekday": schedule.weekday,
                "start_time": schedule.start_time.strftime("%H:%M"),
                "end_time": schedule.end_time.strftime("%H:%M"),
            }
            for schedule in obj.schedules.filter(is_active=True).order_by("weekday")
        ]


class HospitalServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = HospitalService
        fields = ["slug", "name", "summary", "description", "icon", "image", "category", "features", "is_emergency"]


class HealthPackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthPackage
        fields = ["id", "name", "price", "tests", "is_popular"]


class TestimonialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Testimonial
        fields = ["id", "name", "location", "quote"]
