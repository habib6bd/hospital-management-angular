from rest_framework import serializers

from .models import LabOrder, LabResult, LabTest, ReportDocument


class LabTestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabTest
        fields = ["id", "code", "name", "specimen", "unit", "reference_low", "reference_high", "price", "turnaround_hours"]


class LabResultSerializer(serializers.ModelSerializer):
    test_name = serializers.CharField(source="test.name", read_only=True)
    unit = serializers.CharField(source="test.unit", read_only=True)

    class Meta:
        model = LabResult
        fields = ["id", "test", "test_name", "unit", "value", "reference_low", "reference_high", "notes"]


class LabOrderSerializer(serializers.ModelSerializer):
    patient = serializers.IntegerField(source="patient_id")
    ordered_by_name = serializers.CharField(read_only=True)
    tests = LabTestSerializer(many=True, read_only=True)
    results = LabResultSerializer(many=True, read_only=True)
    report = serializers.IntegerField(source="report_id", read_only=True)

    class Meta:
        model = LabOrder
        fields = [
            "id",
            "order_number",
            "patient",
            "patient_name",
            "patient_mrn",
            "ordered_by",
            "ordered_by_name",
            "status",
            "priority",
            "tests",
            "results",
            "ordered_at",
            "sample_collected_at",
            "sample_id",
            "completed_at",
            "clinical_notes",
            "report",
        ]


class ReportDocumentSerializer(serializers.ModelSerializer):
    patient = serializers.IntegerField(source="patient_id")

    class Meta:
        model = ReportDocument
        fields = [
            "id",
            "patient",
            "kind",
            "title",
            "status",
            "issued_at",
            "downloaded_at",
            "size_bytes",
            "related_order_number",
        ]
