from django.contrib import admin

from .models import Batch, InventoryItem, StockMovement, Supplier

admin.site.register(Supplier)
admin.site.register(InventoryItem)
admin.site.register(Batch)
admin.site.register(StockMovement)
