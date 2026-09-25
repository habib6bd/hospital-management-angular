"""
FEFO (first-expiry-first-out) stock movement logic — mirrors
src/app/core/mock/handlers/inventory.handler.ts POST /stock-movements/
exactly (see backend/docs/API_CONTRACT.md §6).
"""

from django.utils import timezone

from .models import Batch, InventoryItem, StockMovement

INBOUND_TYPES = {StockMovement.MovementType.STOCK_IN}


def apply_stock_movement(
    *,
    item: InventoryItem,
    movement_type: str,
    quantity: int,
    batch_number: str | None,
    expiry_date,
    reason: str,
    performed_by_name: str,
) -> StockMovement:
    is_inbound = movement_type == StockMovement.MovementType.STOCK_IN
    delta = quantity if is_inbound else -quantity

    resolved_batch_number = batch_number or None

    if is_inbound and expiry_date:
        batch = Batch.objects.create(
            item=item,
            batch_number=batch_number or f"B{str(int(timezone.now().timestamp()))[-6:]}",
            quantity=quantity,
            expiry_date=expiry_date,
            supplier_name=item.supplier.name if item.supplier_id else None,
        )
        resolved_batch_number = batch.batch_number
    elif not is_inbound:
        consumed_batch_number = _consume_from_batches(item, quantity)
        resolved_batch_number = batch_number or consumed_batch_number

    item.quantity_in_stock = max(0, item.quantity_in_stock + delta)
    item.save(update_fields=["quantity_in_stock"])
    item.recompute_nearest_expiry()

    movement = StockMovement.objects.create(
        item=item,
        batch_number=resolved_batch_number,
        movement_type=movement_type,
        quantity=quantity,
        reason=reason,
        performed_by_name=performed_by_name,
        balance_after=item.quantity_in_stock,
    )
    return movement


def _consume_from_batches(item: InventoryItem, quantity: int) -> str | None:
    """Draws down `quantity` FEFO across live batches; returns the first batch touched."""
    remaining = quantity
    first_touched: str | None = None
    for batch in item.batches.filter(quantity__gt=0).order_by("expiry_date"):
        if remaining <= 0:
            break
        take = min(batch.quantity, remaining)
        if take <= 0:
            continue
        if first_touched is None:
            first_touched = batch.batch_number
        batch.quantity -= take
        batch.save(update_fields=["quantity"])
        remaining -= take
    return first_touched
