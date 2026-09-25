"""
Slot + token computation shared by public_site (guest booking) and appointments
(staff booking) — mirrors the slot-generation logic duplicated across
src/app/core/mock/handlers/public.handler.ts and appointments.handler.ts,
kept as one implementation here instead.
"""

from dataclasses import dataclass
from datetime import date as date_cls
from datetime import datetime, time, timedelta

from django.db.models import Max
from django.utils import timezone

from .models import SLOT_HOLDING_STATUSES, Appointment, Doctor


@dataclass(frozen=True)
class Slot:
    start_time: time
    end_time: time
    is_available: bool
    taken_by: str | None = None


def _add_minutes(t: time, minutes: int) -> time:
    combined = datetime.combine(date_cls.today(), t) + timedelta(minutes=minutes)
    return combined.time()


def compute_slots(doctor: Doctor, for_date: date_cls, *, expose_identity: bool = False) -> list[Slot]:
    """
    Builds the day's slots from the doctor's active schedules for that weekday
    (0=Sunday..6=Saturday, matching JS `Date.getDay()` — Python's
    `date.isoweekday() % 7` gives the same mapping since Python's Monday=0
    would otherwise disagree with JS's Sunday=0).

    `expose_identity=True` returns `taken_by` (the booking patient's name),
    used only by the staff-side endpoint — the public endpoint never exposes
    who holds a slot (see API_CONTRACT.md §3 PublicSlotDto vs §5 TimeSlotDto).
    """
    weekday = (for_date.isoweekday()) % 7  # Python Monday=1..Sunday=7 -> JS Sunday=0..Saturday=6
    schedules = doctor.schedules.filter(weekday=weekday, is_active=True)

    existing = {
        appt.start_time: appt
        for appt in doctor.appointments.filter(date=for_date, status__in=SLOT_HOLDING_STATUSES)
    }

    now = timezone.localtime()
    is_today = for_date == now.date()

    slots: list[Slot] = []
    for schedule in schedules:
        cursor = schedule.start_time
        while cursor < schedule.end_time:
            slot_end = _add_minutes(cursor, schedule.slot_minutes)
            booked = existing.get(cursor)
            is_past = is_today and cursor <= now.time()
            available = booked is None and not is_past
            taken_by = None
            if expose_identity and booked is not None:
                taken_by = booked.patient_name
            slots.append(Slot(start_time=cursor, end_time=slot_end, is_available=available, taken_by=taken_by))
            cursor = slot_end
    return slots


def next_token_number(doctor: Doctor, for_date: date_cls) -> int:
    """Per-day, per-doctor sequential token — restarts each day, like a real OPD."""
    current_max = Appointment.objects.filter(doctor=doctor, date=for_date).aggregate(
        m=Max("token_number")
    )["m"]
    return (current_max or 0) + 1
