from datetime import timedelta
from urllib.parse import quote

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from appointments.models import Appointment
from appointments.serializers import AppointmentSerializer
from config.download_tokens import make_download_token, verify_download_token
from config.pagination import DefaultPagination
from lab.models import ReportDocument
from lab.pdf import render_report_pdf
from lab.serializers import ReportDocumentSerializer
from patients.models import Patient
from patients.serializers import PatientSerializer

from .models import ReportDownload
from .permissions import IsPatientPortalUser


class PortalProfileView(APIView):
    permission_classes = [IsPatientPortalUser]

    def get(self, request):
        patient = Patient.objects.filter(pk=request.user.patient_id).first()
        if patient is None:
            return Response({"detail": "Patient not found."}, status=404)
        return Response(PatientSerializer(patient).data)


class PortalAppointmentsView(generics.ListAPIView):
    """No `search`/`ordering` override — fixed sort by date+start_time, newest first."""

    permission_classes = [IsPatientPortalUser]
    serializer_class = AppointmentSerializer
    pagination_class = DefaultPagination

    def get_queryset(self):
        return Appointment.objects.filter(patient_id=self.request.user.patient_id).order_by(
            "-date", "-start_time"
        )


class PortalReportsView(generics.ListAPIView):
    permission_classes = [IsPatientPortalUser]
    serializer_class = ReportDocumentSerializer
    pagination_class = DefaultPagination

    def get_queryset(self):
        queryset = ReportDocument.objects.filter(patient_id=self.request.user.patient_id)
        params = self.request.query_params

        kind = params.get("kind")
        if kind:
            queryset = queryset.filter(kind=kind)
        status_param = params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(related_order_number__icontains=search)
            )

        ordering = params.get("ordering") or "-issued_at"
        try:
            queryset = queryset.order_by(ordering)
        except Exception:
            queryset = queryset.order_by("-issued_at")
        return queryset


class PortalReportDownloadUrlView(APIView):
    permission_classes = [IsPatientPortalUser]

    def get(self, request, pk: int):
        report = ReportDocument.objects.filter(pk=pk, patient_id=request.user.patient_id).first()
        if report is None:
            return Response({"detail": "Report not found."}, status=404)
        if report.status == ReportDocument.Status.PENDING:
            return Response({"detail": "This report is not ready yet."}, status=409)

        expires_at = (timezone.now() + timedelta(minutes=5)).isoformat()
        token = quote(make_download_token("report", report.id), safe="")
        return Response(
            {
                "url": f"/api/portal/reports/{report.id}/file/?sig={token}",
                "expires_at": expires_at,
                "filename": f"{report.kind}-{report.id}.pdf",
            }
        )


class PortalReportFileView(APIView):
    """
    GET /api/portal/reports/{id}/file/?sig=... — see billing.views.InvoiceFileView
    for the shared reasoning (signature is the authorization, not a fresh
    ownership check; not part of the original mock contract).
    """

    permission_classes = [AllowAny]

    def get(self, request, pk: int):
        if not verify_download_token("report", pk, request.query_params.get("sig")):
            return Response({"detail": "This download link is invalid or has expired."}, status=403)

        report = ReportDocument.objects.filter(pk=pk).first()
        if report is None:
            return Response({"detail": "Report not found."}, status=404)

        pdf_bytes = render_report_pdf(report)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{report.kind}-{report.id}.pdf"'
        return response


class PortalReportDownloadsView(APIView):
    permission_classes = [IsPatientPortalUser]

    def post(self, request, pk: int):
        report = ReportDocument.objects.filter(pk=pk, patient_id=request.user.patient_id).first()
        if report is None:
            return Response({"detail": "Report not found."}, status=404)

        report.status = ReportDocument.Status.DOWNLOADED
        report.downloaded_at = timezone.now()
        report.save(update_fields=["status", "downloaded_at"])
        ReportDownload.objects.create(report=report, patient_id=request.user.patient_id)

        return Response(ReportDocumentSerializer(report).data, status=201)
