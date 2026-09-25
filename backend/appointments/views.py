from datetime import datetime

from django.db.models import Q
from django.utils import timezone
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import APPOINTMENTS_MANAGE, APPOINTMENTS_QUEUE, APPOINTMENTS_VIEW, require
from config.pagination import DefaultPagination, EnvelopeAllPagination

from .models import Appointment, AppointmentStatus, Doctor, DoctorSchedule
from .serializers import AppointmentSerializer, DoctorScheduleSerializer, DoctorSerializer
from .services import compute_slots, next_token_number


class DoctorListView(generics.ListAPIView):
    permission_classes = [require(APPOINTMENTS_VIEW)]
    serializer_class = DoctorSerializer
    pagination_class = EnvelopeAllPagination

    def get_queryset(self):
        queryset = Doctor.objects.all()
        params = self.request.query_params

        department = params.get("department")
        if department:
            queryset = queryset.filter(department=department)

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search)
                | Q(specialty__icontains=search)
                | Q(department__icontains=search)
            )
        return queryset


class DoctorSlotsView(APIView):
    permission_classes = [require(APPOINTMENTS_VIEW)]

    def get(self, request, pk: int):
        date_param = request.query_params.get("date")
        if not date_param:
            return Response({"date": ["This query parameter is required."]}, status=400)

        doctor = Doctor.objects.filter(pk=pk).first()
        if doctor is None:
            return Response({"detail": "Doctor not found."}, status=404)

        for_date = datetime.strptime(date_param, "%Y-%m-%d").date()
        slots = compute_slots(doctor, for_date, expose_identity=True)
        return Response(
            {
                "results": [
                    {
                        "start_time": s.start_time.strftime("%H:%M"),
                        "end_time": s.end_time.strftime("%H:%M"),
                        "is_available": s.is_available,
                        "taken_by": s.taken_by,
                    }
                    for s in slots
                ]
            }
        )


class ScheduleListView(generics.ListAPIView):
    permission_classes = [require(APPOINTMENTS_VIEW)]
    serializer_class = DoctorScheduleSerializer
    pagination_class = EnvelopeAllPagination

    def get_queryset(self):
        queryset = DoctorSchedule.objects.all()
        doctor = self.request.query_params.get("doctor")
        if doctor:
            queryset = queryset.filter(doctor_id=doctor)
        return queryset


class ScheduleUpdateView(APIView):
    permission_classes = [require(APPOINTMENTS_MANAGE)]

    def patch(self, request, pk: int):
        schedule = DoctorSchedule.objects.filter(pk=pk).first()
        if schedule is None:
            return Response({"detail": "Schedule not found."}, status=404)

        body = request.data
        if isinstance(body.get("is_active"), bool):
            schedule.is_active = body["is_active"]
        if isinstance(body.get("start_time"), str):
            schedule.start_time = body["start_time"]
        if isinstance(body.get("end_time"), str):
            schedule.end_time = body["end_time"]
        if isinstance(body.get("slot_minutes"), int):
            schedule.slot_minutes = body["slot_minutes"]
        schedule.save()
        return Response(DoctorScheduleSerializer(schedule).data)


class AppointmentListCreateView(generics.ListCreateAPIView):
    serializer_class = AppointmentSerializer
    pagination_class = DefaultPagination

    def get_permissions(self):
        permission = APPOINTMENTS_VIEW if self.request.method == "GET" else APPOINTMENTS_MANAGE
        return [require(permission)()]

    def get_queryset(self):
        queryset = Appointment.objects.all()
        params = self.request.query_params

        date_param = params.get("date")
        if date_param:
            queryset = queryset.filter(date=date_param)
        date_after = params.get("date_after")
        if date_after:
            queryset = queryset.filter(date__gte=date_after)
        date_before = params.get("date_before")
        if date_before:
            queryset = queryset.filter(date__lte=date_before)

        doctor = params.get("doctor")
        if doctor:
            queryset = queryset.filter(doctor_id=doctor)
        patient = params.get("patient")
        if patient:
            queryset = queryset.filter(patient_id=patient)

        status_in = params.get("status__in")
        if status_in:
            queryset = queryset.filter(status__in=status_in.split(","))
        status_param = params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(patient_name__icontains=search)
                | Q(patient_mrn__icontains=search)
                | Q(doctor_name__icontains=search)
                | Q(reason__icontains=search)
            )

        ordering = params.get("ordering") or "start_time"
        try:
            queryset = queryset.order_by(ordering)
        except Exception:
            queryset = queryset.order_by("start_time")
        return queryset

    def create(self, request, *args, **kwargs):
        from patients.models import Patient

        body = request.data
        errors: dict[str, list[str]] = {}

        patient = None
        try:
            patient = Patient.objects.get(pk=int(body.get("patient")))
        except (Patient.DoesNotExist, TypeError, ValueError):
            errors["patient"] = ["Select a valid patient."]

        doctor = None
        try:
            doctor = Doctor.objects.get(pk=int(body.get("doctor")))
        except (Doctor.DoesNotExist, TypeError, ValueError):
            errors["doctor"] = ["Select a valid doctor."]

        date_str = body.get("date")
        if not isinstance(date_str, str) or not date_str:
            errors["date"] = ["This field is required."]

        start_time_str = body.get("start_time")
        if not isinstance(start_time_str, str) or not start_time_str:
            errors["start_time"] = ["This field is required."]

        if errors:
            return Response(errors, status=400)

        for_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        slots = compute_slots(doctor, for_date, expose_identity=False)
        matching = next((s for s in slots if s.start_time.strftime("%H:%M") == start_time_str), None)
        if matching is None:
            return Response(
                {"start_time": ["That time is outside the doctor's clinic hours."]}, status=400
            )
        if not matching.is_available:
            return Response({"start_time": ["That slot has just been taken."]}, status=400)

        token = next_token_number(doctor, for_date)
        appointment = Appointment.objects.create(
            patient_id=patient.id,
            patient_name=patient.full_name,
            patient_mrn=patient.mrn,
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
        return Response(AppointmentSerializer(appointment).data, status=201)


class AppointmentDetailView(generics.RetrieveAPIView):
    permission_classes = [require(APPOINTMENTS_VIEW)]
    serializer_class = AppointmentSerializer
    queryset = Appointment.objects.all()

    def handle_exception(self, exc):
        from django.http import Http404

        if isinstance(exc, Http404):
            return Response({"detail": "Appointment not found."}, status=404)
        return super().handle_exception(exc)


# action -> (valid "from" statuses, resulting status)
TRANSITIONS: dict[str, tuple[frozenset[str], str]] = {
    "check-in": (frozenset({AppointmentStatus.BOOKED}), AppointmentStatus.CHECKED_IN),
    "start": (frozenset({AppointmentStatus.CHECKED_IN}), AppointmentStatus.IN_CONSULTATION),
    "complete": (
        frozenset({AppointmentStatus.IN_CONSULTATION, AppointmentStatus.CHECKED_IN}),
        AppointmentStatus.COMPLETED,
    ),
    "cancel": (
        frozenset({AppointmentStatus.BOOKED, AppointmentStatus.CHECKED_IN}),
        AppointmentStatus.CANCELLED,
    ),
    "no-show": (
        frozenset({AppointmentStatus.BOOKED, AppointmentStatus.CHECKED_IN}),
        AppointmentStatus.NO_SHOW,
    ),
}


class AppointmentTransitionView(APIView):
    permission_classes = [require(APPOINTMENTS_QUEUE)]

    def post(self, request, pk: int, action: str):
        if action not in TRANSITIONS:
            return Response({"detail": "Unknown action."}, status=404)

        appointment = Appointment.objects.filter(pk=pk).first()
        if appointment is None:
            return Response({"detail": "Appointment not found."}, status=404)

        valid_from, to_status = TRANSITIONS[action]
        if appointment.status not in valid_from:
            action_words = action.replace("-", " ")
            status_words = appointment.status.replace("_", " ")
            return Response(
                {"detail": f"Cannot {action_words} an appointment that is {status_words}."},
                status=409,
            )

        appointment.status = to_status
        if action == "check-in":
            appointment.checked_in_at = timezone.now()
        appointment.save()
        return Response(AppointmentSerializer(appointment).data)
