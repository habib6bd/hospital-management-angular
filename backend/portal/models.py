from django.db import models


class ReportDownload(models.Model):
    """
    Append-only audit trail of report downloads — never exposed via any API,
    matching src/app/core/mock/db.ts's `reportDownloads` (see
    backend/docs/API_CONTRACT.md §9).
    """

    report = models.ForeignKey("lab.ReportDocument", on_delete=models.CASCADE, related_name="downloads")
    patient_id = models.PositiveIntegerField(db_index=True)
    downloaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-downloaded_at"]

    def __str__(self) -> str:
        return f"report {self.report_id} by patient {self.patient_id}"
