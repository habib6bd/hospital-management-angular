from datetime import date as date_cls
from datetime import datetime, timedelta

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from appointments.models import AppointmentStatus, Doctor
from appointments.services import compute_slots, next_token_number

from .constants import BD_PHONE_REGEX, BOOKING_WINDOW_DAYS, normalize_bd_phone, specialty_label
from config.pagination import EnvelopeAllPagination

from .models import ContactMessage, Department, GuestBooking, HealthPackage, HospitalService, Testimonial
from .pagination import PublicDoctorPagination
from .serializers import (
    DepartmentSerializer,
    HealthPackageSerializer,
    HospitalServiceSerializer,
    PublicDoctorSerializer,
    TestimonialSerializer,
)

import re


class DepartmentListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    pagination_class = EnvelopeAllPagination
    serializer_class = DepartmentSerializer
    queryset = Department.objects.all()


class DepartmentDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = DepartmentSerializer
    queryset = Department.objects.all()
    lookup_field = "slug"

    def get_object(self):
        return get_object_or_404(Department, slug=self.kwargs["slug"])

    def handle_exception(self, exc):
        from django.http import Http404

        if isinstance(exc, Http404):
            return Response({"detail": "Department not found."}, status=404)
        return super().handle_exception(exc)


class PublicDoctorListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicDoctorSerializer
    pagination_class = PublicDoctorPagination

    def get_queryset(self):
        queryset = Doctor.objects.all().order_by("-experience_years")
        params = self.request.query_params

        department = params.get("department")
        if department:
            from .constants import SPECIALTY_TO_DEPARTMENT

            specialties = [s for s, slug in SPECIALTY_TO_DEPARTMENT.items() if slug == department]
            queryset = queryset.filter(specialty__in=specialties)

        day = params.get("day")
        if day not in (None, ""):
            try:
                weekday = int(day)
                queryset = queryset.filter(schedules__weekday=weekday, schedules__is_active=True).distinct()
            except ValueError:
                pass

        gender = params.get("gender")
        if gender in ("male", "female"):
            queryset = queryset.filter(gender=gender)

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search)
                | Q(name_bn__icontains=search)
                | Q(specialty__icontains=search)
            )

        return queryset


class PublicDoctorDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicDoctorSerializer
    queryset = Doctor.objects.all()

    def handle_exception(self, exc):
        from django.http import Http404

        if isinstance(exc, Http404):
            return Response({"detail": "Doctor not found."}, status=404)
        return super().handle_exception(exc)


class PublicDoctorSlotsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk: int):
        date_param = request.query_params.get("date")
        if not date_param:
            return Response({"date": ["This query parameter is required."]}, status=400)

        doctor = get_object_or_404(Doctor, pk=pk)
        for_date = datetime.strptime(date_param, "%Y-%m-%d").date()
        slots = compute_slots(doctor, for_date, expose_identity=False)
        return Response(
            {
                "results": [
                    {
                        "start_time": s.start_time.strftime("%H:%M"),
                        "end_time": s.end_time.strftime("%H:%M"),
                        "is_available": s.is_available,
                    }
                    for s in slots
                ]
            }
        )

    def handle_exception(self, exc):
        from django.http import Http404

        if isinstance(exc, Http404):
            return Response({"detail": "Doctor not found."}, status=404)
        return super().handle_exception(exc)


class HospitalServiceListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    pagination_class = EnvelopeAllPagination
    serializer_class = HospitalServiceSerializer
    queryset = HospitalService.objects.all()


class HospitalServiceDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = HospitalServiceSerializer
    queryset = HospitalService.objects.all()
    lookup_field = "slug"

    def handle_exception(self, exc):
        from django.http import Http404

        if isinstance(exc, Http404):
            return Response({"detail": "Service not found."}, status=404)
        return super().handle_exception(exc)


class HealthPackageListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    pagination_class = EnvelopeAllPagination
    serializer_class = HealthPackageSerializer
    queryset = HealthPackage.objects.all()


class TestimonialListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    pagination_class = EnvelopeAllPagination
    serializer_class = TestimonialSerializer
    queryset = Testimonial.objects.all()


def _booking_confirmation(appointment, guest_booking) -> dict:
    doctor = appointment.doctor
    return {
        "reference": guest_booking.reference,
        "serial_no": appointment.token_number,
        "doctor": doctor.id,
        "doctor_name": {"en": doctor.full_name, "bn": doctor.name_bn},
        "specialty": specialty_label(doctor.specialty),
        "date": appointment.date.isoformat(),
        "start_time": appointment.start_time.strftime("%H:%M"),
        "end_time": appointment.end_time.strftime("%H:%M"),
        "room_number": doctor.room_number,
        "consultation_fee": str(doctor.consultation_fee),
        "patient_name": appointment.patient_name,
        "phone": guest_booking.phone,
    }


class GuestBookingCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from appointments.models import Appointment

        body = request.data
        errors: dict[str, list[str]] = {}

        doctor = None
        doctor_id = body.get("doctor")
        try:
            doctor = Doctor.objects.get(pk=int(doctor_id))
        except (Doctor.DoesNotExist, TypeError, ValueError):
            errors["doctor"] = ["Select a valid doctor."]

        date_str = body.get("date")
        for_date = None
        if not isinstance(date_str, str) or not date_str:
            errors["date"] = ["Choose a date within the next 14 days."]
        else:
            try:
                for_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                today = date_cls.today()
                if not (today <= for_date <= today + timedelta(days=BOOKING_WINDOW_DAYS)):
                    errors["date"] = ["Choose a date within the next 14 days."]
            except ValueError:
                errors["date"] = ["Choose a date within the next 14 days."]

        start_time_str = body.get("start_time")
        if not isinstance(start_time_str, str) or not start_time_str:
            errors["start_time"] = ["Choose a time slot."]

        name = body.get("name")
        if not isinstance(name, str) or len(name.strip()) < 2:
            errors["name"] = ["Enter the patient’s full name."]

        phone_raw = body.get("phone")
        phone = normalize_bd_phone(phone_raw) if isinstance(phone_raw, str) else ""
        if not re.match(BD_PHONE_REGEX, phone):
            errors["phone"] = ["Enter a valid Bangladeshi mobile number, e.g. 01712345678."]

        age = body.get("age")
        if not isinstance(age, int) or isinstance(age, bool) or not (0 <= age <= 120):
            errors["age"] = ["Enter an age between 0 and 120."]

        gender = body.get("gender")
        if gender not in ("male", "female"):
            errors["gender"] = ["Select a gender."]

        if errors:
            return Response(errors, status=400)

        slots = compute_slots(doctor, for_date, expose_identity=False)
        matching = next((s for s in slots if s.start_time.strftime("%H:%M") == start_time_str), None)
        if matching is None:
            return Response(
                {"start_time": ["That time is outside the doctor’s chamber hours."]}, status=400
            )
        if not matching.is_available:
            return Response(
                {"start_time": ["That slot has just been taken. Please pick another."]}, status=400
            )

        token = next_token_number(doctor, for_date)
        appointment = Appointment.objects.create(
            patient_id=0,
            patient_name=name.strip(),
            patient_mrn="GUEST",
            doctor=doctor,
            doctor_name=doctor.full_name,
            specialty=doctor.specialty,
            date=for_date,
            start_time=matching.start_time,
            end_time=matching.end_time,
            status=AppointmentStatus.BOOKED,
            token_number=token,
            reason=body.get("reason") if isinstance(body.get("reason"), str) else "",
        )
        reference = f"CW-{for_date.isoformat()[2:].replace('-', '')}-{appointment.id:04d}"
        guest_booking = GuestBooking.objects.create(
            reference=reference, appointment=appointment, phone=phone, age=age, gender=gender
        )
        return Response(_booking_confirmation(appointment, guest_booking), status=201)


class GuestBookingLookupView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        reference = (request.query_params.get("reference") or "").strip().upper()
        phone = normalize_bd_phone(request.query_params.get("phone") or "")

        guest_booking = (
            GuestBooking.objects.select_related("appointment", "appointment__doctor")
            .filter(reference__iexact=reference, phone=phone)
            .first()
        )
        if guest_booking is None:
            return Response(
                {"detail": "No booking matches that reference and phone number."}, status=404
            )
        return Response(_booking_confirmation(guest_booking.appointment, guest_booking))


class ContactCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        body = request.data
        errors: dict[str, list[str]] = {}

        name = body.get("name")
        if not isinstance(name, str) or not name.strip():
            errors["name"] = ["This field is required."]

        phone_raw = body.get("phone")
        phone = normalize_bd_phone(phone_raw) if isinstance(phone_raw, str) else ""
        if not re.match(BD_PHONE_REGEX, phone):
            errors["phone"] = ["Enter a valid Bangladeshi mobile number, e.g. 01712345678."]

        message = body.get("message")
        if not isinstance(message, str) or len(message.strip()) < 10:
            errors["message"] = ["Please write at least 10 characters."]

        if errors:
            return Response(errors, status=400)

        contact = ContactMessage.objects.create(
            name=name.strip(),
            phone=phone,
            email=body.get("email") if isinstance(body.get("email"), str) else None,
            subject=body.get("subject") if isinstance(body.get("subject"), str) else "",
            message=message.strip(),
        )
        return Response({"id": contact.id}, status=201)
