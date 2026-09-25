from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import PATIENTS_ADMIT, PATIENTS_MANAGE, PATIENTS_VIEW, require
from config.pagination import EnvelopeAllPagination

from .models import Admission, Bed, MedicalHistoryEntry, Patient, Ward
from .serializers import (
    AdmissionSerializer,
    BedSerializer,
    MedicalHistoryEntrySerializer,
    PatientSerializer,
    PatientWriteSerializer,
    WardSerializer,
)


def _not_found(message: str):
    return Response({"detail": message}, status=404)


class WardListView(generics.ListAPIView):
    permission_classes = [require(PATIENTS_VIEW)]
    serializer_class = WardSerializer
    pagination_class = EnvelopeAllPagination
    queryset = Ward.objects.all()


class WardBedsView(generics.ListAPIView):
    permission_classes = [require(PATIENTS_VIEW)]
    serializer_class = BedSerializer
    pagination_class = EnvelopeAllPagination

    def get_queryset(self):
        return Bed.objects.filter(ward_id=self.kwargs["ward_id"])


class BedReleaseView(APIView):
    permission_classes = [require(PATIENTS_ADMIT)]

    def post(self, request, ward_id: int, bed_id: int):
        bed = Bed.objects.filter(pk=bed_id).first()
        if bed is None:
            return _not_found("Bed not found.")
        bed.status = Bed.Status.AVAILABLE
        bed.patient = None
        bed.save(update_fields=["status", "patient"])
        return Response(status=204)


class PatientListCreateView(generics.ListCreateAPIView):
    def get_permissions(self):
        permission = PATIENTS_VIEW if self.request.method == "GET" else PATIENTS_MANAGE
        return [require(permission)()]

    def get_serializer_class(self):
        return PatientSerializer

    def get_queryset(self):
        queryset = Patient.objects.all()
        params = self.request.query_params

        patient_type = params.get("patient_type")
        if patient_type in ("opd", "ipd"):
            queryset = queryset.filter(patient_type=patient_type)

        ward = params.get("ward")
        if ward:
            queryset = queryset.filter(current_admission__ward_id=ward)

        gender = params.get("gender")
        if gender:
            queryset = queryset.filter(gender=gender)

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search)
                | Q(mrn__icontains=search)
                | Q(phone__icontains=search)
                | Q(nid__icontains=search)
            )

        ordering = params.get("ordering") or "-registered_at"
        field = ordering.lstrip("-")
        if field in {"registered_at", "full_name", "mrn"}:
            queryset = queryset.order_by(ordering)

        return queryset

    def create(self, request, *args, **kwargs):
        write = PatientWriteSerializer(data=request.data, context={"instance_pk": None})
        write.is_valid(raise_exception=True)
        data = write.validated_data

        max_id = Patient.objects.order_by("-id").values_list("id", flat=True).first() or 0
        mrn = f"HMS-{timezone.now().year}-{max_id + 1:04d}"

        patient = Patient.objects.create(
            mrn=mrn,
            full_name=data["full_name"].strip(),
            gender=data.get("gender") or Patient.Gender.OTHER,
            date_of_birth=data["date_of_birth"],
            blood_group=data.get("blood_group") or None,
            phone=data["phone"],
            email=data.get("email") or None,
            nid=data.get("nid") or None,
            address=data.get("address") or "",
            patient_type=data.get("patient_type") or Patient.PatientType.OPD,
            emergency_contact_name=data.get("emergency_contact_name") or None,
            emergency_contact_phone=data.get("emergency_contact_phone") or None,
            allergies=data.get("allergies") or [],
        )
        return Response(PatientSerializer(patient).data, status=201)


class PatientDetailView(generics.RetrieveUpdateAPIView):
    queryset = Patient.objects.all()
    http_method_names = ["get", "patch", "put", "head", "options"]

    def get_permissions(self):
        permission = PATIENTS_VIEW if self.request.method == "GET" else PATIENTS_MANAGE
        return [require(permission)()]

    def get_object(self):
        patient = Patient.objects.filter(pk=self.kwargs["pk"]).first()
        if patient is None:
            from rest_framework.exceptions import NotFound

            raise NotFound({"detail": "Patient not found."})
        return patient

    def get_serializer_class(self):
        return PatientSerializer

    def update(self, request, *args, **kwargs):
        patient = self.get_object()
        write = PatientWriteSerializer(
            data=request.data,
            context={"instance_pk": patient.pk, "existing_nid": patient.nid},
        )
        write.is_valid(raise_exception=True)
        data = write.validated_data

        patient.full_name = data["full_name"].strip()
        patient.gender = data.get("gender") or Patient.Gender.OTHER
        patient.date_of_birth = data["date_of_birth"]
        patient.blood_group = data.get("blood_group") or None
        patient.phone = data["phone"]
        patient.email = data.get("email") or None
        patient.nid = data.get("nid") or None
        patient.address = data.get("address") or ""
        patient.patient_type = data.get("patient_type") or Patient.PatientType.OPD
        patient.emergency_contact_name = data.get("emergency_contact_name") or None
        patient.emergency_contact_phone = data.get("emergency_contact_phone") or None
        patient.allergies = data.get("allergies") or []
        patient.save()
        return Response(PatientSerializer(patient).data)

    def handle_exception(self, exc):
        from rest_framework.exceptions import NotFound

        if isinstance(exc, NotFound):
            return Response(exc.detail, status=404)
        return super().handle_exception(exc)


class PatientHistoryView(generics.ListCreateAPIView):
    serializer_class = MedicalHistoryEntrySerializer
    pagination_class = EnvelopeAllPagination

    def get_permissions(self):
        permission = PATIENTS_VIEW if self.request.method == "GET" else PATIENTS_MANAGE
        return [require(permission)()]

    def get_queryset(self):
        return MedicalHistoryEntry.objects.filter(patient_id=self.kwargs["pk"])

    def create(self, request, *args, **kwargs):
        patient = Patient.objects.filter(pk=self.kwargs["pk"]).first()
        if patient is None:
            return _not_found("Patient not found.")

        title = request.data.get("title")
        if not isinstance(title, str) or not title.strip():
            return Response({"title": ["This field may not be blank."]}, status=400)

        entry = MedicalHistoryEntry.objects.create(
            patient=patient,
            recorded_by_name=getattr(request.user, "first_name", "") or "System",
            category=request.data.get("category") or MedicalHistoryEntry.Category.NOTE,
            title=title.strip(),
            details=request.data.get("details") if isinstance(request.data.get("details"), str) else "",
        )
        return Response(MedicalHistoryEntrySerializer(entry).data, status=201)


class PatientAdmissionsView(generics.ListAPIView):
    """
    Returns the patient's full admission history, newest first — a deliberate
    improvement over the mock, which only ever returns the current admission
    (see backend/README.md "Design decisions" and API_CONTRACT.md §10.5).
    """

    permission_classes = [require(PATIENTS_VIEW)]
    serializer_class = AdmissionSerializer
    pagination_class = EnvelopeAllPagination

    def get_queryset(self):
        return Admission.objects.filter(patient_id=self.kwargs["pk"])


class PatientAdmitView(APIView):
    permission_classes = [require(PATIENTS_ADMIT)]

    def post(self, request, pk: int):
        patient = Patient.objects.filter(pk=pk).first()
        if patient is None:
            return _not_found("Patient not found.")

        if patient.current_admission_id and patient.current_admission.discharged_at is None:
            return Response({"detail": "This patient is already admitted."}, status=409)

        bed_id = request.data.get("bed")
        bed = Bed.objects.filter(pk=bed_id).first() if bed_id is not None else None
        if bed is None:
            return Response({"bed": ["Select a valid bed."]}, status=400)
        if bed.status != Bed.Status.AVAILABLE:
            return Response({"bed": ["That bed is no longer available."]}, status=400)

        admission = Admission.objects.create(
            patient=patient,
            ward=bed.ward,
            bed=bed,
            attending_doctor_name=request.data.get("attending_doctor_name") or "Dr. On Duty",
        )
        bed.status = Bed.Status.OCCUPIED
        bed.patient = patient
        bed.save(update_fields=["status", "patient"])

        patient.patient_type = Patient.PatientType.IPD
        patient.current_admission = admission
        patient.save(update_fields=["patient_type", "current_admission"])

        return Response(PatientSerializer(patient).data, status=201)


class PatientDischargeView(APIView):
    permission_classes = [require(PATIENTS_ADMIT)]

    def post(self, request, pk: int):
        patient = Patient.objects.filter(pk=pk).first()
        if patient is None:
            return _not_found("Patient not found.")

        admission = patient.current_admission
        if admission is None or admission.discharged_at is not None:
            return Response({"detail": "This patient is not currently admitted."}, status=409)

        admission.discharged_at = timezone.now()
        admission.save(update_fields=["discharged_at"])

        bed = admission.bed
        bed.status = Bed.Status.CLEANING
        bed.patient = None
        bed.save(update_fields=["status", "patient"])

        patient.patient_type = Patient.PatientType.OPD
        patient.save(update_fields=["patient_type"])

        return Response(PatientSerializer(patient).data)
