from django.contrib import admin

from .models import Appointment, Doctor, DoctorSchedule

admin.site.register(Doctor)
admin.site.register(DoctorSchedule)
admin.site.register(Appointment)
