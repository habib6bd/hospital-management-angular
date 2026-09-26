from django.urls import path

from . import views

app_name = "billing"

urlpatterns = [
    path("invoices/summary/", views.InvoiceSummaryView.as_view(), name="invoice-summary"),
    path("invoices/", views.InvoiceListCreateView.as_view(), name="invoice-list-create"),
    path("invoices/<int:pk>/", views.InvoiceDetailView.as_view(), name="invoice-detail"),
    path("invoices/<int:pk>/payments/", views.InvoicePaymentsView.as_view(), name="invoice-payments"),
    path("invoices/<int:pk>/cancel/", views.InvoiceCancelView.as_view(), name="invoice-cancel"),
    path("invoices/<int:pk>/refund/", views.InvoiceRefundView.as_view(), name="invoice-refund"),
    path(
        "invoices/<int:pk>/download-url/",
        views.InvoiceDownloadUrlView.as_view(),
        name="invoice-download-url",
    ),
    path("invoices/<int:pk>/file/", views.InvoiceFileView.as_view(), name="invoice-file"),
]
