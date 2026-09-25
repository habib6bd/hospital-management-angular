"""
Paisa-precision billing math — mirrors
src/app/core/mock/handlers/billing.handler.ts exactly (see
backend/docs/API_CONTRACT.md §8). Everything is computed in integer minor
units (paisa) to avoid float drift, then formatted back to 2dp strings.
"""

from .models import STICKY_STATUSES, Invoice


def _round_paisa(amount) -> int:
    return int(round(float(amount) * 100))


def invoice_total_paisa(invoice: Invoice) -> int:
    gross = sum(_round_paisa(item.unit_price) * item.quantity for item in invoice.items.all())
    discount = sum(_round_paisa(item.discount) for item in invoice.items.all())
    subtotal = gross - min(discount, gross)
    total = subtotal + round(subtotal * float(invoice.tax_rate))
    return int(total)


def paid_paisa(invoice: Invoice) -> int:
    return sum(_round_paisa(payment.amount) for payment in invoice.payments.all())


def status_for(invoice: Invoice) -> str:
    if invoice.status in STICKY_STATUSES:
        return invoice.status
    paid = paid_paisa(invoice)
    total = invoice_total_paisa(invoice)
    if paid <= 0:
        return Invoice.Status.UNPAID
    if paid >= total:
        return Invoice.Status.PAID
    return Invoice.Status.PARTIAL


def refresh_status(invoice: Invoice) -> None:
    """Recomputes and persists the derived status — call after every mutation."""
    new_status = status_for(invoice)
    if new_status != invoice.status:
        invoice.status = new_status
        invoice.save(update_fields=["status"])
