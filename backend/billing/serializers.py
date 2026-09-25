from rest_framework import serializers

from .models import Invoice, InvoiceLineItem, Payment
from .services import status_for


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = ["id", "source", "description", "quantity", "unit_price", "discount", "reference"]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "amount", "method", "reference", "received_at", "received_by_name"]


class InvoiceSerializer(serializers.ModelSerializer):
    patient = serializers.IntegerField(source="patient_id")
    items = InvoiceLineItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "patient",
            "patient_name",
            "patient_mrn",
            "status",
            "items",
            "payments",
            "tax_rate",
            "issued_at",
            "due_date",
            "notes",
        ]

    def get_status(self, obj: Invoice) -> str:
        return status_for(obj)
