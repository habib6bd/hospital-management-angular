from django.contrib import admin

from .models import Admission, Bed, MedicalHistoryEntry, Patient, Ward

admin.site.register(Ward)
admin.site.register(Bed)
admin.site.register(Patient)
admin.site.register(Admission)
admin.site.register(MedicalHistoryEntry)
