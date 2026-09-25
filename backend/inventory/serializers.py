from rest_framework import serializers

from .models import Batch, InventoryItem, StockMovement, Supplier


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "contact_person", "phone", "email", "address", "is_active"]


class InventoryItemSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default=None)

    class Meta:
        model = InventoryItem
        fields = [
            "id",
            "code",
            "name",
            "category",
            "unit",
            "quantity_in_stock",
            "reorder_level",
            "unit_price",
            "supplier",
            "supplier_name",
            "is_active",
            "nearest_expiry",
        ]


class BatchSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = Batch
        fields = ["id", "item", "item_name", "batch_number", "quantity", "expiry_date", "received_at", "supplier_name"]


class StockMovementSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "item",
            "item_name",
            "batch_number",
            "movement_type",
            "quantity",
            "reason",
            "performed_by_name",
            "occurred_at",
            "balance_after",
        ]
