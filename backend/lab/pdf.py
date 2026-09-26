from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import ReportDocument

_TABLE_STYLE = TableStyle(
    [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
)


def render_report_pdf(report: ReportDocument) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=report.title)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph("CareWell General Hospital", styles["Title"]),
        Paragraph(report.title, styles["Heading2"]),
        Spacer(1, 4 * mm),
        Paragraph(f"Kind: {report.get_kind_display()}", styles["Normal"]),
        Paragraph(f"Status: {report.get_status_display()}", styles["Normal"]),
    ]
    if report.issued_at:
        elements.append(Paragraph(f"Issued: {report.issued_at:%Y-%m-%d %H:%M}", styles["Normal"]))
    if report.related_order_number:
        elements.append(Paragraph(f"Order: {report.related_order_number}", styles["Normal"]))
    elements.append(Spacer(1, 6 * mm))

    # `lab_order` is the reverse accessor for LabOrder.report (OneToOneField,
    # related_name="lab_order") — only present for kind="lab_report".
    lab_order = getattr(report, "lab_order", None)
    if lab_order is not None and lab_order.results.exists():
        rows = [["Test", "Value", "Unit", "Reference range", "Notes"]]
        for result in lab_order.results.select_related("test").all():
            low = result.reference_low or ""
            high = result.reference_high or ""
            reference = f"{low}–{high}" if (low or high) else ""
            rows.append([result.test.name, result.value, result.test.unit, reference, result.notes])
        table = Table(rows, hAlign="LEFT")
        table.setStyle(_TABLE_STYLE)
        elements.append(table)
    else:
        elements.append(Paragraph("No structured results available for this report.", styles["Normal"]))

    doc.build(elements)
    return buffer.getvalue()
