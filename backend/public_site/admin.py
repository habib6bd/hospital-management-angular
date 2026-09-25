from django.contrib import admin

from .models import ContactMessage, Department, GuestBooking, HealthPackage, HospitalService, Testimonial

admin.site.register(Department)
admin.site.register(HospitalService)
admin.site.register(HealthPackage)
admin.site.register(Testimonial)
admin.site.register(GuestBooking)
admin.site.register(ContactMessage)
