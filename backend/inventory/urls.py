from django.urls import path

from . import views

app_name = "inventory"

urlpatterns = [
    path("suppliers/", views.SupplierListCreateView.as_view(), name="supplier-list-create"),
    path("inventory/alerts/", views.InventoryAlertsView.as_view(), name="inventory-alerts"),
    path("inventory/", views.InventoryItemListCreateView.as_view(), name="inventory-list-create"),
    path("inventory/<int:pk>/", views.InventoryItemDetailView.as_view(), name="inventory-detail"),
    path("inventory/<int:pk>/batches/", views.ItemBatchesView.as_view(), name="inventory-batches"),
    path("inventory/<int:pk>/movements/", views.ItemMovementsView.as_view(), name="inventory-movements"),
    path("stock-movements/", views.StockMovementListCreateView.as_view(), name="stock-movement-list-create"),
]
