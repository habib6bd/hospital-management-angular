from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import Invoice
from .services import invoice_total_paisa, paid_paisa, status_for

_TABLE_STYLE = TableStyle(
    [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
)


def render_invoice_pdf(invoice: Invoice) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=invoice.invoice_number)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph("CareWell General Hospital", styles["Title"]),
        Paragraph(f"Invoice {invoice.invoice_number}", styles["Heading2"]),
        Spacer(1, 4 * mm),
        Paragraph(f"Patient: {invoice.patient_name} ({invoice.patient_mrn})", styles["Normal"]),
        Paragraph(f"Issued: {invoice.issued_at:%Y-%m-%d}", styles["Normal"]),
        Paragraph(f"Due: {invoice.due_date:%Y-%m-%d}", styles["Normal"]),
        Paragraph(f"Status: {status_for(invoice)}", styles["Normal"]),
        Spacer(1, 6 * mm),
    ]

    rows = [["Description", "Qty", "Unit price", "Discount", "Line total"]]
    for item in invoice.items.all():
        line_total = item.quantity * float(item.unit_price) - float(item.discount)
        rows.append(
            [item.description, str(item.quantity), str(item.unit_price), str(item.discount), f"{line_total:.2f}"]
        )
    table = Table(rows, hAlign="LEFT")
    table.setStyle(_TABLE_STYLE)
    elements.append(table)
    elements.append(Spacer(1, 6 * mm))

    total = invoice_total_paisa(invoice) / 100
    paid = paid_paisa(invoice) / 100
    elements.append(Paragraph(f"Tax rate: {invoice.tax_rate}", styles["Normal"]))
    elements.append(Paragraph(f"Total: {total:.2f}", styles["Normal"]))
    elements.append(Paragraph(f"Paid: {paid:.2f}", styles["Normal"]))
    elements.append(Paragraph(f"Balance: {(total - paid):.2f}", styles["Normal"]))

    payments = list(invoice.payments.all())
    if payments:
        elements.append(Spacer(1, 4 * mm))
        elements.append(Paragraph("Payments", styles["Heading3"]))
        payment_rows = [["Date", "Amount", "Method", "Received by"]]
        for payment in payments:
            payment_rows.append(
                [
                    f"{payment.received_at:%Y-%m-%d %H:%M}",
                    str(payment.amount),
                    payment.method,
                    payment.received_by_name,
                ]
            )
        payment_table = Table(payment_rows, hAlign="LEFT")
        payment_table.setStyle(_TABLE_STYLE)
        elements.append(payment_table)

    doc.build(elements)
    return buffer.getvalue()
