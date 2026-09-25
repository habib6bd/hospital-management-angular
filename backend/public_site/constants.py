"""
Mirrors the constant tables in src/app/core/mock/seeds/public.seed.ts. Kept
here (not duplicated onto the Doctor model) so department/specialty labels
have one source of truth, exactly like the frontend seed comments describe.
"""

SPECIALTY_TO_DEPARTMENT: dict[str, str] = {
    "Cardiology": "cardiology",
    "Obstetrics": "gynae-obstetrics",
    "Orthopaedics": "orthopaedics",
    "Paediatrics": "paediatrics",
    "General Medicine": "medicine",
    "Dermatology": "dermatology",
    "Neurology": "neurology",
    "ENT": "ent",
}

SPECIALTY_LABELS: dict[str, dict[str, str]] = {
    "Cardiology": {"en": "Cardiologist", "bn": "হৃদরোগ বিশেষজ্ঞ"},
    "Obstetrics": {"en": "Gynaecologist & Obstetrician", "bn": "স্ত্রীরোগ ও প্রসূতি বিশেষজ্ঞ"},
    "Orthopaedics": {"en": "Orthopaedic Surgeon", "bn": "অর্থোপেডিক সার্জন"},
    "Paediatrics": {"en": "Paediatrician", "bn": "শিশু বিশেষজ্ঞ"},
    "General Medicine": {"en": "Medicine Specialist", "bn": "মেডিসিন বিশেষজ্ঞ"},
    "Dermatology": {"en": "Dermatologist", "bn": "চর্মরোগ বিশেষজ্ঞ"},
    "Neurology": {"en": "Neurologist", "bn": "স্নায়ুরোগ বিশেষজ্ঞ"},
    "ENT": {"en": "ENT Specialist", "bn": "নাক-কান-গলা বিশেষজ্ঞ"},
}

LANGUAGES_SPOKEN: dict[str, str] = {"en": "Bangla, English", "bn": "বাংলা, ইংরেজি"}

BOOKING_WINDOW_DAYS = 14

# Matches BD_PHONE_PATTERN across the mock (public booking, contact, patients).
BD_PHONE_REGEX = r"^01[3-9]\d{8}$"


def specialty_label(specialty: str) -> dict[str, str]:
    return SPECIALTY_LABELS.get(specialty, {"en": specialty, "bn": specialty})


def department_slug_for(specialty: str) -> str | None:
    return SPECIALTY_TO_DEPARTMENT.get(specialty)


def normalize_bd_phone(value: str) -> str:
    """value.replace(/^\\+?88/, '').replace(/[\\s-]/g, '') — see API_CONTRACT.md §1."""
    import re

    stripped = re.sub(r"^\+?88", "", value or "")
    return re.sub(r"[\s-]", "", stripped)
