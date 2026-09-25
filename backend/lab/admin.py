from django.contrib import admin

from .models import LabOrder, LabResult, LabTest, ReportDocument

admin.site.register(LabTest)
admin.site.register(LabOrder)
admin.site.register(LabResult)
admin.site.register(ReportDocument)
