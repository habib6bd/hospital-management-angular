from django.urls import path

from . import views

app_name = "lab"

urlpatterns = [
    path("lab-tests/", views.LabTestListView.as_view(), name="lab-test-list"),
    path("lab-orders/", views.LabOrderListCreateView.as_view(), name="lab-order-list-create"),
    path("lab-orders/<int:pk>/", views.LabOrderDetailView.as_view(), name="lab-order-detail"),
    path(
        "lab-orders/<int:pk>/collect-sample/",
        views.LabOrderCollectSampleView.as_view(),
        name="lab-order-collect-sample",
    ),
    path("lab-orders/<int:pk>/start/", views.LabOrderStartView.as_view(), name="lab-order-start"),
    path("lab-orders/<int:pk>/cancel/", views.LabOrderCancelView.as_view(), name="lab-order-cancel"),
    path("lab-orders/<int:pk>/results/", views.LabOrderResultsView.as_view(), name="lab-order-results"),
    path("reports/", views.ReportListView.as_view(), name="report-list"),
]
