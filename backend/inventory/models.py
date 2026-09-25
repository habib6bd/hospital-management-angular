from django.db import models


class Supplier(models.Model):
    name = models.CharField(max_length=150)
    contact_person = models.CharField(max_length=150, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(null=True, blank=True)
    address = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.name


class InventoryItem(models.Model):
    class Category(models.TextChoices):
        MEDICINE = "medicine", "Medicine"
        CONSUMABLE = "consumable", "Consumable"
        EQUIPMENT = "equipment", "Equipment"

    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.CONSUMABLE)
    unit = models.CharField(max_length=20, default="pcs")
    quantity_in_stock = models.IntegerField(default=0)
    reorder_level = models.IntegerField(default=0)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    supplier = models.ForeignKey(
        Supplier, null=True, blank=True, on_delete=models.SET_NULL, related_name="items"
    )
    is_active = models.BooleanField(default=True)
    nearest_expiry = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"

    def recompute_nearest_expiry(self) -> None:
        live_expiry = (
            self.batches.filter(quantity__gt=0).order_by("expiry_date").values_list("expiry_date", flat=True).first()
        )
        self.nearest_expiry = live_expiry
        self.save(update_fields=["nearest_expiry"])


class Batch(models.Model):
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="batches")
    batch_number = models.CharField(max_length=50)
    quantity = models.IntegerField()
    expiry_date = models.DateField()
    received_at = models.DateTimeField(auto_now_add=True)
    supplier_name = models.CharField(max_length=150, null=True, blank=True)

    class Meta:
        ordering = ["expiry_date"]

    def __str__(self) -> str:
        return f"{self.item.code} / {self.batch_number}"


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        STOCK_IN = "stock_in", "Stock in"
        STOCK_OUT = "stock_out", "Stock out"
        ADJUSTMENT = "adjustment", "Adjustment"
        WASTAGE = "wastage", "Wastage"

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="movements")
    batch_number = models.CharField(max_length=50, null=True, blank=True)
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    quantity = models.IntegerField()
    reason = models.CharField(max_length=255, blank=True, default="")
    performed_by_name = models.CharField(max_length=150, default="System")
    occurred_at = models.DateTimeField(auto_now_add=True)
    balance_after = models.IntegerField()

    class Meta:
        ordering = ["-occurred_at"]

    def __str__(self) -> str:
        return f"{self.item.code} {self.movement_type} {self.quantity}"
