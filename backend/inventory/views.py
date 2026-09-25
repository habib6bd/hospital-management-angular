from datetime import date, timedelta

from django.db.models import F, Q
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import INVENTORY_MANAGE, INVENTORY_VIEW, require
from config.pagination import DefaultPagination, EnvelopeAllPagination

from .models import Batch, InventoryItem, StockMovement, Supplier
from .serializers import BatchSerializer, InventoryItemSerializer, StockMovementSerializer, SupplierSerializer
from .services import apply_stock_movement


class SupplierListCreateView(generics.ListCreateAPIView):
    pagination_class = EnvelopeAllPagination
    serializer_class = SupplierSerializer

    def get_permissions(self):
        permission = INVENTORY_VIEW if self.request.method == "GET" else INVENTORY_MANAGE
        return [require(permission)()]

    def get_queryset(self):
        queryset = Supplier.objects.all()
        params = self.request.query_params
        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(contact_person__icontains=search) | Q(phone__icontains=search)
            )
        is_active = params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=(is_active == "true"))
        return queryset

    def create(self, request, *args, **kwargs):
        name = request.data.get("name")
        if not isinstance(name, str) or not name.strip():
            return Response({"name": ["This field may not be blank."]}, status=400)

        supplier = Supplier.objects.create(
            name=name.strip(),
            contact_person=request.data.get("contact_person") or "",
            phone=request.data.get("phone") or "",
            address=request.data.get("address") or "",
            email=request.data.get("email") or None,
            is_active=True,
        )
        return Response(SupplierSerializer(supplier).data, status=201)


class InventoryItemListCreateView(generics.ListCreateAPIView):
    pagination_class = DefaultPagination
    serializer_class = InventoryItemSerializer

    def get_permissions(self):
        permission = INVENTORY_VIEW if self.request.method == "GET" else INVENTORY_MANAGE
        return [require(permission)()]

    def get_queryset(self):
        queryset = InventoryItem.objects.all()
        params = self.request.query_params

        category = params.get("category")
        if category:
            queryset = queryset.filter(category=category)
        supplier = params.get("supplier")
        if supplier:
            queryset = queryset.filter(supplier_id=supplier)

        stock_status = params.get("stock_status")
        if stock_status == "low":
            queryset = queryset.filter(quantity_in_stock__gt=0, quantity_in_stock__lte=F("reorder_level"))
        elif stock_status == "out":
            queryset = queryset.filter(quantity_in_stock__lte=0)
        elif stock_status == "expiring":
            queryset = queryset.filter(
                nearest_expiry__isnull=False, nearest_expiry__lte=date.today() + timedelta(days=90)
            )

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(code__icontains=search) | Q(supplier__name__icontains=search)
            )

        ordering = params.get("ordering") or "name"
        try:
            queryset = queryset.order_by(ordering)
        except Exception:
            queryset = queryset.order_by("name")
        return queryset

    def create(self, request, *args, **kwargs):
        body = request.data
        errors: dict[str, list[str]] = {}

        code = (body.get("code") or "").strip()
        if not code:
            errors["code"] = ["This field may not be blank."]
        elif InventoryItem.objects.filter(code=code).exists():
            errors["code"] = ["An item with this code already exists."]

        name = (body.get("name") or "").strip()
        if not name:
            errors["name"] = ["This field may not be blank."]

        reorder_level = body.get("reorder_level")
        try:
            reorder_level = float(reorder_level)
            if reorder_level < 0:
                raise ValueError
        except (TypeError, ValueError):
            errors["reorder_level"] = ["Enter a number greater than or equal to 0."]

        unit_price = body.get("unit_price")
        try:
            unit_price = float(unit_price)
            if unit_price < 0:
                raise ValueError
        except (TypeError, ValueError):
            errors["unit_price"] = ["Enter a valid price."]

        if errors:
            return Response(errors, status=400)

        supplier = Supplier.objects.filter(pk=body.get("supplier")).first() if body.get("supplier") else None

        item = InventoryItem.objects.create(
            code=code,
            name=name,
            category=body.get("category") or InventoryItem.Category.CONSUMABLE,
            unit=body.get("unit") or "pcs",
            quantity_in_stock=0,
            reorder_level=int(reorder_level),
            unit_price=f"{unit_price:.2f}",
            supplier=supplier,
            is_active=True,
            nearest_expiry=None,
        )
        return Response(InventoryItemSerializer(item).data, status=201)


class InventoryItemDetailView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]
    serializer_class = InventoryItemSerializer
    queryset = InventoryItem.objects.all()

    def get_permissions(self):
        permission = INVENTORY_VIEW if self.request.method == "GET" else INVENTORY_MANAGE
        return [require(permission)()]

    def get_object(self):
        item = InventoryItem.objects.filter(pk=self.kwargs["pk"]).first()
        if item is None:
            from rest_framework.exceptions import NotFound

            raise NotFound({"detail": "Item not found."})
        return item

    def handle_exception(self, exc):
        from rest_framework.exceptions import NotFound

        if isinstance(exc, NotFound):
            return Response(exc.detail, status=404)
        return super().handle_exception(exc)

    def update(self, request, *args, **kwargs):
        item = self.get_object()
        body = request.data

        if "code" in body:
            code = (body.get("code") or "").strip()
            if code and InventoryItem.objects.filter(code=code).exclude(pk=item.pk).exists():
                return Response({"code": ["An item with this code already exists."]}, status=400)
            if code:
                item.code = code

        if body.get("name"):
            item.name = body["name"]
        if body.get("category"):
            item.category = body["category"]
        if body.get("unit"):
            item.unit = body["unit"]
        if "reorder_level" in body and body["reorder_level"] is not None:
            item.reorder_level = body["reorder_level"]
        if "unit_price" in body and body["unit_price"] is not None:
            item.unit_price = f"{float(body['unit_price']):.2f}"
        # Deviation from the mock (documented in README "Design decisions"): only
        # touch `supplier` when the payload actually includes it, instead of
        # resetting it to null on every PATCH that omits the field.
        if "supplier" in body:
            item.supplier = Supplier.objects.filter(pk=body.get("supplier")).first() if body.get("supplier") else None

        item.save()
        return Response(InventoryItemSerializer(item).data)


class InventoryAlertsView(generics.ListAPIView):
    permission_classes = [require(INVENTORY_VIEW)]
    serializer_class = InventoryItemSerializer
    pagination_class = EnvelopeAllPagination

    def get_queryset(self):
        low_or_out = InventoryItem.objects.filter(quantity_in_stock__lte=F("reorder_level"))
        expiring = InventoryItem.objects.filter(
            nearest_expiry__isnull=False, nearest_expiry__lte=date.today() + timedelta(days=90)
        )
        ids = set(low_or_out.values_list("id", flat=True)) | set(expiring.values_list("id", flat=True))
        return InventoryItem.objects.filter(id__in=ids)


class ItemBatchesView(generics.ListAPIView):
    permission_classes = [require(INVENTORY_VIEW)]
    serializer_class = BatchSerializer
    pagination_class = EnvelopeAllPagination

    def get_queryset(self):
        return Batch.objects.filter(item_id=self.kwargs["pk"]).order_by("expiry_date")


class ItemMovementsView(generics.ListAPIView):
    permission_classes = [require(INVENTORY_VIEW)]
    serializer_class = StockMovementSerializer
    pagination_class = DefaultPagination

    def get_queryset(self):
        return StockMovement.objects.filter(item_id=self.kwargs["pk"]).order_by("-occurred_at")


class StockMovementListCreateView(generics.ListCreateAPIView):
    pagination_class = DefaultPagination
    serializer_class = StockMovementSerializer

    def get_permissions(self):
        permission = INVENTORY_VIEW if self.request.method == "GET" else INVENTORY_MANAGE
        return [require(permission)()]

    def get_queryset(self):
        queryset = StockMovement.objects.all()
        params = self.request.query_params

        movement_type = params.get("movement_type")
        if movement_type:
            queryset = queryset.filter(movement_type=movement_type)

        search = params.get("search")
        if search:
            queryset = queryset.filter(Q(item__name__icontains=search) | Q(reason__icontains=search))

        ordering = params.get("ordering") or "-occurred_at"
        try:
            queryset = queryset.order_by(ordering)
        except Exception:
            queryset = queryset.order_by("-occurred_at")
        return queryset

    def create(self, request, *args, **kwargs):
        body = request.data
        errors: dict[str, list[str]] = {}

        item = InventoryItem.objects.filter(pk=body.get("item")).first()
        if item is None:
            errors["item"] = ["Select a valid item."]

        quantity = body.get("quantity")
        try:
            quantity = float(quantity)
            if quantity <= 0:
                raise ValueError
        except (TypeError, ValueError):
            errors["quantity"] = ["Enter a quantity greater than 0."]

        movement_type = body.get("movement_type")
        if movement_type not in {c.value for c in StockMovement.MovementType}:
            errors["movement_type"] = ["Select a valid movement type."]

        if not errors and movement_type in {StockMovement.MovementType.STOCK_OUT, StockMovement.MovementType.WASTAGE}:
            if item.quantity_in_stock < quantity:
                errors["quantity"] = [
                    f"Only {item.quantity_in_stock} {item.unit} in stock; cannot remove {int(quantity)}."
                ]

        if errors:
            return Response(errors, status=400)

        performed_by_name = getattr(request.user, "first_name", "") or "System"
        movement = apply_stock_movement(
            item=item,
            movement_type=movement_type,
            quantity=int(quantity),
            batch_number=body.get("batch_number") or None,
            expiry_date=body.get("expiry_date") or None,
            reason=body.get("reason") if isinstance(body.get("reason"), str) else "",
            performed_by_name=performed_by_name,
        )
        return Response(StockMovementSerializer(movement).data, status=201)
