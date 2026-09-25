from django.db.models import Q, Max
from django.utils import timezone
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import LAB_ORDER, LAB_RESULT, LAB_VIEW, require
from config.pagination import DefaultPagination, EnvelopeAllPagination

from .models import LabOrder, LabOrderStatus, LabResult, LabTest, ReportDocument
from .serializers import LabOrderSerializer, LabTestSerializer, ReportDocumentSerializer


class LabTestListView(generics.ListAPIView):
    permission_classes = [require(LAB_VIEW)]
    serializer_class = LabTestSerializer
    pagination_class = EnvelopeAllPagination

    def get_queryset(self):
        queryset = LabTest.objects.all()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(code__icontains=search))
        return queryset


class LabOrderListCreateView(generics.ListCreateAPIView):
    serializer_class = LabOrderSerializer
    pagination_class = DefaultPagination

    def get_permissions(self):
        permission = LAB_VIEW if self.request.method == "GET" else LAB_ORDER
        return [require(permission)()]

    def get_queryset(self):
        queryset = LabOrder.objects.all()
        params = self.request.query_params

        status_in = params.get("status__in")
        if status_in:
            queryset = queryset.filter(status__in=status_in.split(","))
        status_param = params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        priority = params.get("priority")
        if priority:
            queryset = queryset.filter(priority=priority)
        patient = params.get("patient")
        if patient:
            queryset = queryset.filter(patient_id=patient)

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(order_number__icontains=search)
                | Q(patient_name__icontains=search)
                | Q(patient_mrn__icontains=search)
                | Q(sample_id__icontains=search)
            )

        ordering = params.get("ordering") or "-ordered_at"
        try:
            queryset = queryset.order_by(ordering)
        except Exception:
            queryset = queryset.order_by("-ordered_at")
        return queryset

    def create(self, request, *args, **kwargs):
        from patients.models import Patient

        body = request.data
        errors: dict[str, list[str]] = {}

        patient = Patient.objects.filter(pk=body.get("patient")).first()
        if patient is None:
            errors["patient"] = ["Select a valid patient."]

        test_ids = [t for t in (body.get("tests") or []) if isinstance(t, int)]
        tests = list(LabTest.objects.filter(pk__in=test_ids)) if test_ids else []
        if not tests:
            errors["tests"] = ["Select at least one test."]

        if errors:
            return Response(errors, status=400)

        max_id = LabOrder.objects.aggregate(m=Max("id"))["m"] or 0
        order = LabOrder.objects.create(
            order_number=f"LAB-{max_id + 1:05d}",
            patient_id=patient.id,
            patient_name=patient.full_name,
            patient_mrn=patient.mrn,
            ordered_by=request.user,
            status=LabOrderStatus.ORDERED,
            priority=body.get("priority") if body.get("priority") == "urgent" else "routine",
            clinical_notes=body.get("clinical_notes") if isinstance(body.get("clinical_notes"), str) else "",
        )
        order.tests.set(tests)
        return Response(LabOrderSerializer(order).data, status=201)


class LabOrderDetailView(generics.RetrieveAPIView):
    permission_classes = [require(LAB_VIEW)]
    serializer_class = LabOrderSerializer
    queryset = LabOrder.objects.all()

    def handle_exception(self, exc):
        from django.http import Http404

        if isinstance(exc, Http404):
            return Response({"detail": "Order not found."}, status=404)
        return super().handle_exception(exc)


class LabOrderCollectSampleView(APIView):
    permission_classes = [require(LAB_RESULT)]

    def post(self, request, pk: int):
        order = LabOrder.objects.filter(pk=pk).first()
        if order is None:
            return Response({"detail": "Order not found."}, status=404)
        if order.status != LabOrderStatus.ORDERED:
            return Response(
                {"detail": "A sample has already been collected for this order."}, status=409
            )
        order.status = LabOrderStatus.SAMPLE_COLLECTED
        order.sample_collected_at = timezone.now()
        order.sample_id = f"S-{order.id:05d}"
        order.save(update_fields=["status", "sample_collected_at", "sample_id"])
        return Response(LabOrderSerializer(order).data)


class LabOrderStartView(APIView):
    permission_classes = [require(LAB_RESULT)]

    def post(self, request, pk: int):
        order = LabOrder.objects.filter(pk=pk).first()
        if order is None:
            return Response({"detail": "Order not found."}, status=404)
        if order.status != LabOrderStatus.SAMPLE_COLLECTED:
            return Response(
                {"detail": "The sample must be collected before analysis can start."}, status=409
            )
        order.status = LabOrderStatus.IN_PROGRESS
        order.save(update_fields=["status"])
        return Response(LabOrderSerializer(order).data)


class LabOrderCancelView(APIView):
    permission_classes = [require(LAB_ORDER)]

    def post(self, request, pk: int):
        order = LabOrder.objects.filter(pk=pk).first()
        if order is None:
            return Response({"detail": "Order not found."}, status=404)
        if order.status == LabOrderStatus.COMPLETED:
            return Response({"detail": "A completed order cannot be cancelled."}, status=409)
        order.status = LabOrderStatus.CANCELLED
        order.save(update_fields=["status"])
        return Response(LabOrderSerializer(order).data)


class LabOrderResultsView(APIView):
    permission_classes = [require(LAB_RESULT)]

    def post(self, request, pk: int):
        order = LabOrder.objects.filter(pk=pk).first()
        if order is None:
            return Response({"detail": "Order not found."}, status=404)

        if order.status == LabOrderStatus.CANCELLED:
            return Response({"detail": "Results cannot be entered on a cancelled order."}, status=409)
        if order.status == LabOrderStatus.ORDERED:
            return Response({"detail": "The sample has not been collected yet."}, status=409)

        submitted = {
            r["test"]: (r.get("value") or "").strip()
            for r in (request.data.get("results") or [])
            if isinstance(r, dict) and isinstance(r.get("test"), int)
        }

        errors: dict[str, list[str]] = {}
        for test in order.tests.all():
            if not submitted.get(test.id):
                errors[f"results.{test.id}"] = ["A result value is required."]
        if errors:
            return Response(errors, status=400)

        order.results.all().delete()
        for r in request.data.get("results") or []:
            test = order.tests.filter(pk=r.get("test")).first()
            if test is None:
                continue
            LabResult.objects.create(
                order=order,
                test=test,
                value=(r.get("value") or "").strip(),
                notes=r.get("notes") if isinstance(r.get("notes"), str) else "",
                reference_low=test.reference_low,
                reference_high=test.reference_high,
            )

        now = timezone.now()
        test_names = ", ".join(order.tests.values_list("name", flat=True))
        report = ReportDocument.objects.create(
            patient_id=order.patient_id,
            kind=ReportDocument.Kind.LAB_REPORT,
            title=test_names,
            status=ReportDocument.Status.READY,
            issued_at=now,
            size_bytes=120_000 + order.tests.count() * 20_000,
            related_order_number=order.order_number,
        )
        order.status = LabOrderStatus.COMPLETED
        order.completed_at = now
        order.report = report
        order.save(update_fields=["status", "completed_at", "report"])
        return Response(LabOrderSerializer(order).data)


class ReportListView(generics.ListAPIView):
    permission_classes = [require(LAB_VIEW)]
    serializer_class = ReportDocumentSerializer
    pagination_class = DefaultPagination

    def get_queryset(self):
        queryset = ReportDocument.objects.all()
        patient = self.request.query_params.get("patient")
        if patient:
            queryset = queryset.filter(patient_id=patient)
        return queryset
