from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Max, Q
from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import BILLING_MANAGE, BILLING_VIEW, role_has_permission
from config.pagination import DefaultPagination

from .models import Invoice, InvoiceLineItem, Payment
from .serializers import InvoiceSerializer
from .services import STICKY_STATUSES, invoice_total_paisa, paid_paisa, refresh_status, status_for


def _can_view_invoices(user) -> bool:
    return user.role == "patient" or role_has_permission(user.role, BILLING_VIEW)


class InvoiceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer
    pagination_class = DefaultPagination

    def check_permissions(self, request):
        super().check_permissions(request)
        if self.request.method == "GET":
            if not _can_view_invoices(request.user):
                self.permission_denied(request)
        elif not role_has_permission(request.user.role, BILLING_MANAGE):
            self.permission_denied(request)

    def get_queryset(self):
        queryset = Invoice.objects.all()
        params = self.request.query_params
        user = self.request.user

        if user.role == "patient":
            queryset = queryset.filter(patient_id=user.patient_id)
        else:
            patient = params.get("patient")
            if patient:
                queryset = queryset.filter(patient_id=patient)

        status_param = params.get("status")
        if status_param:
            ids = [inv.id for inv in queryset if status_for(inv) == status_param]
            queryset = queryset.filter(id__in=ids)

        if params.get("overdue") == "true":
            today = date.today()
            ids = [
                inv.id
                for inv in queryset
                if inv.due_date < today
                and paid_paisa(inv) < invoice_total_paisa(inv)
                and inv.status not in STICKY_STATUSES
            ]
            queryset = queryset.filter(id__in=ids)

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(invoice_number__icontains=search)
                | Q(patient_name__icontains=search)
                | Q(patient_mrn__icontains=search)
            )

        ordering = params.get("ordering") or "-issued_at"
        try:
            queryset = queryset.order_by(ordering)
        except Exception:
            queryset = queryset.order_by("-issued_at")
        return queryset

    def create(self, request, *args, **kwargs):
        from patients.models import Patient

        body = request.data
        errors: dict[str, list[str]] = {}

        patient = Patient.objects.filter(pk=body.get("patient")).first()
        if patient is None:
            errors["patient"] = ["Select a valid patient."]

        items = body.get("items")
        if not isinstance(items, list) or not items:
            errors["items"] = ["An invoice needs at least one line item."]
        else:
            for i, raw in enumerate(items):
                if not isinstance(raw, dict):
                    continue
                description = raw.get("description")
                if not isinstance(description, str) or not description.strip():
                    errors[f"items.{i}.description"] = ["This field may not be blank."]

                quantity = raw.get("quantity")
                if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity <= 0:
                    errors[f"items.{i}.quantity"] = ["Enter a whole quantity greater than 0."]

                unit_price = raw.get("unit_price")
                try:
                    unit_price = float(unit_price)
                    if unit_price < 0:
                        raise ValueError
                except (TypeError, ValueError):
                    errors[f"items.{i}.unit_price"] = ["Enter a valid price."]

                discount = raw.get("discount")
                if discount is not None and f"items.{i}.quantity" not in errors and f"items.{i}.unit_price" not in errors:
                    try:
                        discount = float(discount)
                        if discount > quantity * unit_price:
                            errors[f"items.{i}.discount"] = ["Discount cannot exceed the line total."]
                    except (TypeError, ValueError):
                        pass

        if errors:
            return Response(errors, status=400)

        max_id = Invoice.objects.aggregate(m=Max("id"))["m"] or 0
        due_date = body.get("due_date") or (date.today() + timedelta(days=14)).isoformat()
        tax_rate = body.get("tax_rate")
        try:
            tax_rate = Decimal(str(tax_rate)).quantize(Decimal("0.0001"))
        except Exception:
            tax_rate = Decimal("0.0500")

        invoice = Invoice.objects.create(
            invoice_number=f"INV-{timezone.now().year}-{max_id + 1:05d}",
            patient_id=patient.id,
            patient_name=patient.full_name,
            patient_mrn=patient.mrn,
            status=Invoice.Status.UNPAID,
            tax_rate=tax_rate,
            due_date=due_date,
            notes=body.get("notes") if isinstance(body.get("notes"), str) else "",
        )
        for raw in items:
            InvoiceLineItem.objects.create(
                invoice=invoice,
                source=raw.get("source") or InvoiceLineItem.Source.CONSULTATION,
                description=raw.get("description").strip(),
                quantity=raw.get("quantity"),
                unit_price=f"{float(raw.get('unit_price')):.2f}",
                discount=f"{float(raw.get('discount') or 0):.2f}",
            )
        return Response(InvoiceSerializer(invoice).data, status=201)


class InvoiceSummaryView(APIView):
    """Restricted to staff (billing.view) — see README 'Design decisions'."""

    permission_classes = [IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        if not role_has_permission(request.user.role, BILLING_VIEW):
            self.permission_denied(request)

    def get(self, request):
        invoices = Invoice.objects.exclude(status__in=[Invoice.Status.CANCELLED, Invoice.Status.DRAFT])

        total_billed = 0
        total_collected = 0
        total_outstanding = 0
        overdue_count = 0
        by_source: dict[str, int] = {}
        today = date.today()

        for invoice in invoices:
            total = invoice_total_paisa(invoice)
            paid = paid_paisa(invoice)
            total_billed += total
            total_collected += paid
            total_outstanding += max(0, total - paid)
            if invoice.due_date < today and paid < total:
                overdue_count += 1
            for item in invoice.items.all():
                amount = int(round(float(item.unit_price) * 100)) * item.quantity - int(
                    round(float(item.discount) * 100)
                )
                by_source[item.source] = by_source.get(item.source, 0) + amount

        return Response(
            {
                "total_billed": f"{total_billed / 100:.2f}",
                "total_collected": f"{total_collected / 100:.2f}",
                "total_outstanding": f"{total_outstanding / 100:.2f}",
                "overdue_count": overdue_count,
                "by_source": [
                    {"source": source, "amount": f"{amount / 100:.2f}"} for source, amount in by_source.items()
                ],
            }
        )


class InvoiceDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        return Invoice.objects.all()

    def get_object(self):
        from rest_framework.exceptions import NotFound

        invoice = Invoice.objects.filter(pk=self.kwargs["pk"]).first()
        user = self.request.user
        if invoice is None or (user.role == "patient" and invoice.patient_id != user.patient_id):
            raise NotFound({"detail": "Invoice not found."})
        if user.role != "patient" and not role_has_permission(user.role, BILLING_VIEW):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        return invoice

    def handle_exception(self, exc):
        from rest_framework.exceptions import NotFound

        if isinstance(exc, NotFound):
            return Response(exc.detail, status=404)
        return super().handle_exception(exc)


class InvoicePaymentsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.role == "patient":
            return Response({"detail": "Payments are recorded by hospital staff."}, status=403)
        if not role_has_permission(user.role, BILLING_MANAGE):
            return Response({"detail": "You do not have permission to perform this action."}, status=403)

        invoice = Invoice.objects.filter(pk=pk).first()
        if invoice is None:
            return Response({"detail": "Invoice not found."}, status=404)
        if invoice.status == Invoice.Status.CANCELLED:
            return Response({"detail": "A cancelled invoice cannot take payments."}, status=409)

        amount = request.data.get("amount")
        try:
            amount = float(amount)
            if amount <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response({"amount": ["Enter an amount greater than 0."]}, status=400)

        amount_paisa = int(round(amount * 100))
        remaining = invoice_total_paisa(invoice) - paid_paisa(invoice)
        if amount_paisa > remaining:
            return Response(
                {"amount": [f"The outstanding balance is ৳{remaining / 100:.2f}."]}, status=400
            )

        Payment.objects.create(
            invoice=invoice,
            amount=f"{amount:.2f}",
            method=request.data.get("method") or Payment.Method.CASH,
            reference=request.data.get("reference") or None,
            received_by_name=f"{user.first_name} {user.last_name}".strip(),
        )
        refresh_status(invoice)
        return Response(InvoiceSerializer(invoice).data)


class InvoiceCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        user = request.user
        if user.role == "patient":
            return Response({"detail": "Only hospital staff can cancel an invoice."}, status=403)
        if not role_has_permission(user.role, BILLING_MANAGE):
            return Response({"detail": "You do not have permission to perform this action."}, status=403)

        invoice = Invoice.objects.filter(pk=pk).first()
        if invoice is None:
            return Response({"detail": "Invoice not found."}, status=404)
        if paid_paisa(invoice) > 0:
            return Response(
                {"detail": "An invoice with payments must be refunded, not cancelled."}, status=409
            )

        invoice.status = Invoice.Status.CANCELLED
        invoice.save(update_fields=["status"])
        return Response(InvoiceSerializer(invoice).data)


class InvoiceDownloadUrlView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        user = request.user
        invoice = Invoice.objects.filter(pk=pk).first()
        if invoice is None or (user.role == "patient" and invoice.patient_id != user.patient_id):
            return Response({"detail": "Invoice not found."}, status=404)
        if user.role != "patient" and not role_has_permission(user.role, BILLING_VIEW):
            return Response({"detail": "You do not have permission to perform this action."}, status=403)

        expires_at = (timezone.now() + timedelta(minutes=5)).isoformat()
        return Response(
            {
                "url": f"/api/invoices/{invoice.id}/file/?sig=preview",
                "expires_at": expires_at,
                "filename": f"{invoice.invoice_number}.pdf",
            }
        )
