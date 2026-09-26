# API Contract — Django REST backend for the Hospital Management Angular app

This document is the source of truth for the Django/DRF implementation. It was reverse-engineered
from the Angular app's in-memory mock API, which is itself the specification the frontend was
built against. **The Django API must reproduce every path, status code, field name and error
message below exactly**, so that flipping `useMockApi: false` in
`src/app/core/config/app-config.ts` is a true drop-in swap.

Primary sources read to produce this document:

- `src/app/core/mock/handlers/*.ts` — every endpoint, status code, error message, state transition
- `src/app/shared/models/*.dto.ts` — exact snake_case field names/types
- `src/app/core/mock/db.ts`, `src/app/core/mock/seeds/*.ts` — data model & demo data
- `src/app/core/auth/*.ts` — roles, JWT payload shape, permission strategies
- `src/app/core/http/paginated.ts`, `src/app/core/http/api-error.ts` — pagination envelope, error shapes
- `src/app/core/mock/mock-utils.ts`, `mock-types.ts` — shared helper semantics (`match`, `ok`,
  `detailError`, `validationError`, `paginate`, `searchFilter`, `orderBy`)

---

## 1. Global conventions

- **Base path**: every route is prefixed `/api/`. All URLs end with a trailing slash.
- **Pagination** (DRF `PageNumberPagination`, `PAGE_SIZE=20` unless noted):
  ```json
  { "count": 0, "next": "/api/path/?page=2&...", "previous": null, "results": [] }
  ```
  Query params: `page` (default 1), `page_size` (overrides default; invalid/absent falls back to
  default; min 1). Several "reference data" list endpoints (departments, doctors (public + staff
  schedule list), services, packages, testimonials, wards, ward beds, batches, patient
  admissions/history) are **not paginated** in the mock — they always return the full result set
  wrapped in the same 4-key envelope with `next`/`previous` always `null`. These are called out
  per-endpoint below. Preserve this distinction: DRF should apply pagination only where noted.
- **Search**: query param `search`, case-insensitive substring match OR'd across a fixed field
  list per endpoint (DRF `SearchFilter`).
- **Ordering**: query param `ordering` (`field` / `-field` for descending), single field only.
  Endpoint-specific defaults are noted; nulls sort last.
- **Auth**: `Authorization: Bearer <access-jwt>` (SimpleJWT). Every authenticated endpoint returns
  **401** `{"detail": "Authentication credentials were not provided."}` (or `{"detail": "Given
  token not valid for any token type"}` for `/auth/me/` — see §2) when no valid, non-expired user
  resolves from the token. **No RBAC/permission-class differentiation exists anywhere in the mock
  beyond "is authenticated"** — every authenticated user, regardless of role, may call every
  business endpoint. The `permission.strategies.ts` role matrix (§2.2) governs **frontend
  UI/routing only** (nav items, dashboard widgets, route guards) and is *not* enforced by any mock
  handler. Decide with the product owner whether Django should introduce real per-role permission
  classes as a deliberate improvement, or mirror "authenticated-only" for byte-for-byte parity —
  flagged as an open question in `PROGRESS.md`.
- **Error shapes** (DRF-native):
  - `{"detail": "<message>"}` — non-field errors: 401, 403, 404, 409.
  - `{"<field>": ["<message>", ...], ...}` — 400 validation errors (DRF serializer-error
    convention, no `detail` wrapper). Multiple failing fields are returned together in one
    response. Some field keys are dotted synthetic paths (e.g. `items.0.description`,
    `results.{testId}`) — these are literal string keys, not nested JSON.
  - `{"non_field_errors": [...]}` — reserved DRF shape for cross-field validation; not currently
    used by any mock handler but supported by the frontend's `toApiError`.
- **Dates/times**: date-only fields are `YYYY-MM-DD`. Datetime fields are full ISO-8601 UTC with
  `Z` suffix (`Date.prototype.toISOString()` format). Money fields are **decimal strings** with 2
  decimal places (`"1200.00"`), except `tax_rate` which uses 4 decimal places (`"0.0500"`).
- **Localized content** (`Localized = {en: string, bn: string}`) appears embedded in public-site
  DTOs (department/doctor/service/package/testimonial names, descriptions, etc.). Model these as a
  single JSON field (or two columns serialized into one nested object), not flat `name_en`/`name_bn`
  keys, to match the wire shape exactly.
- **Phone normalization**: strip a leading `+88`/`88` and all spaces/hyphens before validation,
  storage, and lookup comparisons: `value.replace(/^\+?88/, '').replace(/[\s-]/g, '')`. Validation
  regex: `^01[3-9]\d{8}$` (post-normalization). Two different error message texts exist depending
  on the endpoint — preserve both:
  - Public booking / contact: `"Enter a valid Bangladeshi mobile number, e.g. 01712345678."`
  - Patient create/update: `"Enter a valid Bangladeshi mobile number."` (no example)

---

## 2. Auth (`accounts` app)

### 2.1 Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/token/` | none | body `{username, password}` → `{access, refresh}` |
| POST | `/api/token/refresh/` | none | body `{refresh}` → `{access}` |
| POST | `/api/token/blacklist/` | none (mock) | body `{refresh}` → `{}`, 200 |
| GET | `/api/auth/me/` | required | → `AuthUserDto` |

**POST `/api/token/`**
- Body: `{username: string, password: string}`.
- Bad credentials or inactive user: **401** `{"detail": "No active account found with the given credentials"}` (SimpleJWT's exact default message).
- Success: **200** `{"access": "<jwt>", "refresh": "<jwt>"}`.
- Access token TTL 15 min, refresh TTL 24h (mock values; production SimpleJWT config is up to the
  team but should stay reasonable/consistent — confirm desired TTLs with the user, mock is not
  necessarily prescriptive here since it's a security parameter not a wire-contract field).
- Access/refresh payload MUST contain `user_id` (int), `exp` (unix seconds), `token_type`
  (`"access"`/`"refresh"`) — the frontend decodes these fields directly (`auth.model.ts
  decodeAccessToken`).

**POST `/api/token/refresh/`**
- Body: `{refresh: string}`.
- Invalid/expired/wrong-type token: **401** `{"detail": "Token is invalid or expired"}`.
- Success: **200** `{"access": "<jwt>"}`.

**POST `/api/token/blacklist/`**
- Body: `{refresh: string}`. Mock always returns **200** `{}` unconditionally (no validation). Real
  SimpleJWT `token_blacklist` behavior — blacklists the refresh token — should be wired in; the
  200/`{}` response shape can be kept minimal to match.

**GET `/api/auth/me/`**
- No valid Bearer token: **401** `{"detail": "Given token not valid for any token type"}` (note:
  different exact message than the generic "Authentication credentials were not provided." used
  elsewhere — SimpleJWT's `InvalidToken` message; preserve this distinction).
- Success: **200** `AuthUserDto`:
  ```
  { id:int, username:str, email:str, first_name:str, last_name:str, role:str,
    staff_id:str|null, patient_id:int|null, doctor_id:int|null, avatar_url:str|null }
  ```
  (password/is_active fields never serialized.)
  - `patient_id`: non-null only for `role === 'patient'`, links to the account's `Patient` record.
  - `doctor_id`: non-null only for `role === 'doctor'`, links to the account's `Doctor` record.
    **Not part of the original mock contract** — added on request from the frontend team so a
    doctor's own session can resolve their `Doctor` id (e.g. for "my appointments"/"my schedule"
    views) without a lookup by name. If the frontend's mock/`AuthUserDto` is updated to match,
    keep both in sync; if not, this field is additive and won't break existing consumers that
    ignore unknown keys.

### 2.2 Roles

Exactly these seven role values (Django group names / a `role` field), snake_case on the wire:

```
admin, doctor, nurse, receptionist, lab_technician, pharmacist, patient
```

`staff_id` is `null` only for `patient` role users; other roles get `EMP-NNNN`. `patient_id` is
non-null only for `patient`-role users, linking to their `Patient` record.

### 2.3 Permission matrix (frontend-only; mock does not enforce server-side)

Documented for completeness / to inform whether Django should introduce real permission classes.
Permissions: `patients.view`, `patients.manage`, `patients.admit`, `appointments.view`,
`appointments.manage`, `appointments.queue`, `inventory.view`, `inventory.manage`, `lab.view`,
`lab.order`, `lab.result`, `billing.view`, `billing.manage`, `dashboard.view`, `portal.view`,
`notifications.view`.

| Role | Permissions |
|---|---|
| admin | all except `portal.view` |
| doctor | patients.{view,manage,admit}, appointments.{view,manage,queue}, lab.{view,order}, dashboard.view, notifications.view |
| nurse | patients.{view,manage,admit}, appointments.{view,queue}, inventory.view, lab.view, dashboard.view, notifications.view |
| receptionist | patients.{view,manage}, appointments.{view,manage,queue}, billing.{view,manage}, dashboard.view, notifications.view |
| lab_technician | patients.view, lab.{view,result}, dashboard.view, notifications.view |
| pharmacist | patients.view, inventory.{view,manage}, billing.view, dashboard.view, notifications.view |
| patient | portal.view, notifications.view |

**Recommendation for Phase 2**: implement DRF permission classes that mirror this table (so the
Django API is *more* correct than the mock, closing a real security gap) unless the user says to
match the mock's "any authenticated user" behavior exactly. **Ask before deviating** — flagged as
an open question.

---

## 3. Public site (`public_site` app) — `/api/public/**`, no authentication

| Method | Path | Paginated | Notes |
|---|---|---|---|
| GET | `/api/public/departments/` | no | list `DepartmentDto` |
| GET | `/api/public/departments/{slug}/` | — | 404 `"Department not found."` |
| GET | `/api/public/doctors/` | yes (page_size default **12**) | filters: `department`, `day` (0-6), `gender`, `search`; fixed ordering `-experience_years` (not overridable) |
| GET | `/api/public/doctors/{id}/slots/` | — | requires `date`; missing → 400 `{"date": ["This query parameter is required."]}` |
| GET | `/api/public/doctors/{id}/` | — | 404 `"Doctor not found."` |
| GET | `/api/public/services/` | no | list `HospitalServiceDto` |
| GET | `/api/public/services/{slug}/` | — | 404 `"Service not found."` |
| GET | `/api/public/packages/` | no | list `HealthPackageDto` |
| GET | `/api/public/testimonials/` | no | list `TestimonialDto` |
| POST | `/api/public/appointments/` | — | guest booking, see below |
| GET | `/api/public/appointments/lookup/` | — | `?reference=&phone=` |
| POST | `/api/public/contact/` | — | contact form |

Any other method/path under `/public/` → **404** `{"detail": "No public endpoint for <METHOD> <path>."}`.

### DTOs

```
DepartmentDto: { slug, name:Localized, summary:Localized, description:Localized, icon:str,
  image:str, services:Localized[], doctor_count:int }   # doctor_count computed live

PublicDoctorDto: { id, name:Localized, specialty:Localized, department_slug, department_name:Localized,
  designation:Localized, qualifications:str, experience_years:int, consultation_fee:str,
  room_number:str, gender:"male"|"female", languages:Localized, bio:Localized, photo_url:str|null,
  chamber: [{weekday:int, start_time:"HH:MM", end_time:"HH:MM"}] }   # from active DoctorSchedule rows

PublicSlotDto: { start_time:"HH:MM", end_time:"HH:MM", is_available:bool }   # no patient info exposed

HospitalServiceDto: { slug, name:Localized, summary:Localized, description:Localized, icon:str,
  image:str, category:"clinical"|"diagnostic"|"support", features:Localized[], is_emergency:bool }

HealthPackageDto: { id, name:Localized, price:str, tests:Localized[], is_popular:bool }

TestimonialDto: { id, name:Localized, location:Localized, quote:Localized }

GuestBookingDto (request): { doctor:int, date:"YYYY-MM-DD", start_time:"HH:MM", name:str,
  phone:str, age:int, gender:"male"|"female", reason?:str }

BookingConfirmationDto (response): { reference:str, serial_no:int, doctor:int, doctor_name:Localized,
  specialty:Localized, date:"YYYY-MM-DD", start_time:"HH:MM", end_time:"HH:MM", room_number:str,
  consultation_fee:str, patient_name:str, phone:str }
```

### `GET /api/public/doctors/{id}/slots/`
Slots computed from the doctor's **active** `DoctorSchedule` rows for `date`'s weekday
(`0=Sunday..6=Saturday`), sliced into `slot_minutes` increments between `start_time`/`end_time`.
A slot is unavailable if an appointment exists for that doctor/date/start_time with status in
`{booked, checked_in}` ("slot holding" statuses) — patient identity is never exposed publicly.

### `POST /api/public/appointments/` — guest booking
Validation (400, all failing fields merged):
- `doctor` not found → `{"doctor": ["Select a valid doctor."]}`
- `date` empty or outside `[today, today+14 days]` (`BOOKING_WINDOW_DAYS=14`) → `{"date": ["Choose a date within the next 14 days."]}`
- `start_time` empty → `{"start_time": ["Choose a time slot."]}`
- `name` trimmed length < 2 → `{"name": ["Enter the patient's full name."]}` (curly apostrophe U+2019)
- `phone` fails BD mobile regex → `{"phone": ["Enter a valid Bangladeshi mobile number, e.g. 01712345678."]}`
- `age` not integer 0–120 → `{"age": ["Enter an age between 0 and 120."]}`
- `gender` not `male`/`female` → `{"gender": ["Select a gender."]}`
- After the above pass: `start_time` not among the doctor's computed slots for `date` → `{"start_time": ["That time is outside the doctor's chamber hours."]}`; slot exists but taken → `{"start_time": ["That slot has just been taken. Please pick another."]}`

Success **201** `BookingConfirmationDto`. `reference` format: `CW-<YYMMDD>-<NNNN>` where `YYMMDD`
is the date with dashes stripped and `NNNN` is the new appointment id zero-padded to 4 digits.
State: creates an `Appointment` with `patient=0` (no patient FK — guest), `patient_mrn="GUEST"`,
`status="booked"`, sequential `token_number` per doctor+date, plus a `GuestBooking` lookup row
`{reference, appointment, phone (normalized), age, gender}`. **No `Patient` record is created at
booking time** — reception creates it at check-in.

### `GET /api/public/appointments/lookup/`
`?reference=&phone=` (reference uppercased/trimmed, phone normalized). No match → **404**
`{"detail": "No booking matches that reference and phone number."}` — this single generic message
covers wrong reference, wrong phone, or both (prevents enumeration).

### `POST /api/public/contact/`
Body `{name, phone, message, email?, subject?}`. Validation (400, merged):
- `name` blank after trim → `{"name": ["This field is required."]}`
- `phone` fails BD regex → `{"phone": ["Enter a valid Bangladeshi mobile number, e.g. 01712345678."]}`
- `message` trimmed length < 10 → `{"message": ["Please write at least 10 characters."]}`

Success **201** `{"id": int}` only (message not echoed).

---

## 4. Patients (`patients` app) — `/api/patients/**`, `/api/wards/**`, authenticated

401 `{"detail": "Authentication credentials were not provided."}` if unauthenticated. No further
role restriction in the mock (see §1 RBAC note).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/wards/` | not paginated, list `WardDto` |
| GET | `/api/wards/{id}/beds/` | not paginated, list `BedDto`; unknown ward → empty list (no 404) |
| POST | `/api/wards/{wardId}/beds/{bedId}/release/` | `wardId` accepted but unused; 404 `"Bed not found."`; success **204** |
| GET | `/api/patients/` | paginated, page_size 20 |
| POST | `/api/patients/` | create |
| GET | `/api/patients/{id}/` | 404 `"Patient not found."` |
| PATCH, PUT | `/api/patients/{id}/` | **both act as full replace** — omitted fields reset to defaults |
| GET | `/api/patients/{id}/history/` | not paginated; no 404 for unknown patient (empty list) |
| POST | `/api/patients/{id}/history/` | 404 `"Patient not found."` if id unknown |
| GET | `/api/patients/{id}/admissions/` | not paginated; **mock quirk**: returns only the current/most-recent admission (0 or 1 rows), not full history — see note below |
| POST | `/api/patients/{id}/admit/` | admission |
| POST | `/api/patients/{id}/discharge/` | discharge |

### DTOs

```
PatientDto: { id, mrn:str, full_name:str, gender:str, date_of_birth:"YYYY-MM-DD",
  blood_group:str|null, phone:str, email:str|null, nid:str|null, address:str,
  patient_type:"opd"|"ipd", emergency_contact_name:str|null, emergency_contact_phone:str|null,
  allergies:str[], registered_at:ISO-dt, current_admission:AdmissionDto|null }

AdmissionDto: { id, ward:int, ward_name:str, bed:int, bed_number:str, admitted_at:ISO-dt,
  discharged_at:ISO-dt|null, attending_doctor_name:str, summary_report:int|null }

WardDto: { id, name:str, ward_type:"general"|"icu"|"maternity"|"paediatric"|"isolation",
  floor:int, total_beds:int, occupied_beds:int }

BedDto: { id, ward:int, bed_number:str, status:"available"|"occupied"|"cleaning"|"maintenance",
  patient:int|null, patient_name:str|null }

MedicalHistoryEntryDto: { id, patient:int, recorded_at:ISO-dt, recorded_by_name:str,
  category:"diagnosis"|"procedure"|"allergy"|"medication"|"note", title:str, details:str }
```

### `GET /api/patients/`
Filters: `patient_type` (opd/ipd), `ward` (numeric id, matches `current_admission.ward`),
`gender`, `search` (fields: `full_name`, `mrn`, `phone`, `nid`), `ordering` (default
`-registered_at`), `page`, `page_size` (default 20).

### `POST /api/patients/`
Body: `{full_name, gender, date_of_birth, blood_group?, phone, email?, nid?, address, patient_type,
emergency_contact_name?, emergency_contact_phone?, allergies?}`.

Validation (400, merged):
- `full_name` blank after trim → `{"full_name": ["This field may not be blank."]}`
- `date_of_birth` missing → `{"date_of_birth": ["This field is required."]}`; in the future → `{"date_of_birth": ["Date of birth cannot be in the future."]}`
- `phone` fails BD regex → `{"phone": ["Enter a valid Bangladeshi mobile number."]}`
- `nid` non-empty and not 10/13/17 digits → `{"nid": ["Enter a valid NID (10, 13 or 17 digits)."]}`; duplicate NID → `{"nid": ["A patient with this NID already exists."]}`

Success **201** `PatientDto`. Server sets: `id` sequential; `mrn` = `"HMS-2026-" + id padded to 4
digits` (mock hardcodes year 2026 literally — **confirm with user** whether Django should hardcode
`2026` for byte-for-byte parity or derive the current year; recommend deriving dynamically as a
deliberate, documented deviation; flagged in PROGRESS.md); `gender` defaults `"other"`;
`blood_group`/`email`/`nid`/`emergency_contact_name`/`emergency_contact_phone` default `null`;
`address` defaults `""`; `patient_type` defaults `"opd"`; `allergies` defaults `[]`;
`registered_at` = now; `current_admission` = `null`.

### `PATCH`/`PUT /api/patients/{id}/`
Both perform a **full replace** (not partial) — an omitted field resets to its create-time default,
same validation as create except NID-uniqueness is skipped when the submitted NID equals the
existing record's own NID. `mrn`, `registered_at`, `current_admission` are immutable via this
route (preserved from the existing record regardless of payload). 404 `"Patient not found."`.
**Implement this exactly as-is** (not a true partial PATCH) to match frontend expectations, unless
directed otherwise — flag as a known quirk.

### `GET/POST /api/patients/{id}/history/`
GET: sorted descending by `recorded_at`. POST body `{title, category?, details?}`; `title` blank
→ **400** `{"title": ["This field may not be blank."]}`. Success **201**; `category` defaults
`"note"`, `details` defaults `""`, `recorded_by_name` = caller's `first_name` (or `"System"`).

### `GET /api/patients/{id}/admissions/`
**Mock quirk**: only ever returns the patient's `current_admission` (0 or 1 rows), not true
history. Confirm with user whether Django should expose full admission history here (more
correct) or replicate the mock's limitation for parity — flagged as an open question.

### `POST /api/patients/{id}/admit/`
Body `{bed:int, attending_doctor_name?:str}`.
- 404 `"Patient not found."`
- **409** `{"detail": "This patient is already admitted."}` if `current_admission` open (not discharged)
- **400** `{"bed": ["Select a valid bed."]}` if bed id unknown
- **400** `{"bed": ["That bed is no longer available."]}` if bed status != `available`

Success **201** updated `PatientDto`. State: new `Admission` row (`discharged_at: null`,
`attending_doctor_name` default `"Dr. On Duty"`); bed → `status="occupied"`, `patient`,
`patient_name` set; ward `occupied_beds` +1 (clamped `[0, total_beds]`); patient →
`patient_type="ipd"`, `current_admission` set.

### `POST /api/patients/{id}/discharge/`
- 404 `"Patient not found."`
- **409** `{"detail": "This patient is not currently admitted."}` if no open admission

Success **200** updated `PatientDto`. State: admission `discharged_at` = now; bed →
`status="cleaning"` (NOT `available` — must be explicitly released), `patient`/`patient_name`
→ `null`; ward `occupied_beds` −1 (clamped ≥0); patient → `patient_type="opd"`,
`current_admission` stays the now-closed admission object (callers detect "not admitted" via
`discharged_at !== null`).

### `POST /api/wards/{wardId}/beds/{bedId}/release/`
`wardId` unused/unvalidated. 404 `{"detail": "Bed not found."}` if `bedId` unknown. Success
**204** No Content. Bed → `status="available"`, `patient`/`patient_name` → `null` (works from any
prior status, including `maintenance`).

---

## 5. Appointments (`appointments` app) — `/api/doctors/**`, `/api/schedules/**`, `/api/appointments/**`

Authenticated (401 `"Authentication credentials were not provided."` — this handler independently
checks `currentUser` before any route match, so this exact message applies uniformly, distinct
from `/auth/me/`'s SimpleJWT message).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/doctors/` | not paginated; filters `search`, `department` |
| GET | `/api/doctors/{id}/slots/` | requires `date`; 400 if missing |
| GET | `/api/schedules/` | not paginated; filter `doctor` |
| PATCH | `/api/schedules/{id}/` | 404 `"Schedule not found."` |
| GET | `/api/appointments/` | paginated, page_size 20 |
| POST | `/api/appointments/` | create/book |
| GET | `/api/appointments/{id}/` | 404 `"Appointment not found."` |
| POST | `/api/appointments/{id}/check-in/` | booked → checked_in |
| POST | `/api/appointments/{id}/start/` | checked_in → in_consultation |
| POST | `/api/appointments/{id}/complete/` | in_consultation\|checked_in → completed |
| POST | `/api/appointments/{id}/cancel/` | booked\|checked_in → cancelled |
| POST | `/api/appointments/{id}/no-show/` | booked\|checked_in → no_show |

### DTOs

```
DoctorDto: { id, full_name:str, specialty:str, department:str, consultation_fee:str, room_number:str }

DoctorScheduleDto: { id, doctor:int, doctor_name:str, weekday:int(0-6), start_time:"HH:MM",
  end_time:"HH:MM", slot_minutes:int, is_active:bool }

TimeSlotDto: { start_time:"HH:MM", end_time:"HH:MM", is_available:bool, taken_by:str|null }

AppointmentDto: { id, patient:int, patient_name:str, patient_mrn:str, doctor:int, doctor_name:str,
  specialty:str, date:"YYYY-MM-DD", start_time:"HH:MM", end_time:"HH:MM", status:str,
  token_number:int|null, reason:str, checked_in_at:ISO-dt|null, created_at:ISO-dt }
```
Status values: `booked | checked_in | in_consultation | completed | cancelled | no_show`.

### `GET /api/doctors/{id}/slots/`
Requires `date` query param; missing/empty → **400** `{"date": ["This query parameter is required."]}`.
Response: `{"results": TimeSlotDto[]}` (bare wrapper, **not** the paginated envelope — no
count/next/previous). Unavailable if an appointment exists with status in
`{booked, checked_in, in_consultation, completed}` at that time (cancelled/no_show free the slot).
If `date` is today, past-time slots are also `is_available: false` (but `taken_by` stays `null`).

### `PATCH /api/schedules/{id}/`
Body: any subset of `{is_active, start_time, end_time, slot_minutes}`. Success **200** full
`DoctorScheduleDto`.

### `GET /api/appointments/`
Filters: `date` (exact), `date_after`/`date_before` (inclusive range), `doctor`, `patient`
(numeric), `status`, `status__in` (comma-separated), `search` (fields: `patient_name`,
`patient_mrn`, `doctor_name`, `reason`), `ordering` (default `start_time`), `page`, `page_size`
(default 20).

### `POST /api/appointments/`
Body: `{patient:int, doctor:int, date, start_time, reason?}`. Validation (400, merged):
- `patient` not found → `{"patient": ["Select a valid patient."]}`
- `doctor` not found → `{"doctor": ["Select a valid doctor."]}`
- `date` missing/empty → `{"date": ["This field is required."]}`
- `start_time` missing/empty → `{"start_time": ["This field is required."]}`
- (after the above pass) `start_time` not among the doctor's clinic-hour slots → `{"start_time": ["That time is outside the doctor's clinic hours."]}`
- slot taken → `{"start_time": ["That slot has just been taken."]}`

Success **201** `AppointmentDto`. `status="booked"`; `token_number` = 1 + max existing token for
that doctor+date (per-day, per-doctor sequential); `checked_in_at=null`; `created_at`=now.

### State transitions — exact table

| Action (URL segment) | Valid `from` | → `to` | Side effects |
|---|---|---|---|
| `check-in` | `booked` | `checked_in` | `checked_in_at` = now |
| `start` | `checked_in` | `in_consultation` | — |
| `complete` | `in_consultation`, `checked_in` | `completed` | — |
| `cancel` | `booked`, `checked_in` | `cancelled` | — |
| `no-show` | `booked`, `checked_in` | `no_show` | — |

Unknown action segment → **404** `{"detail": "Unknown action."}`. Appointment id unknown → **404**
`{"detail": "Appointment not found."}`. Invalid transition → **409**
`{"detail": "Cannot <action, hyphen→space> an appointment that is <current status, underscore→space>."}`,
e.g. `complete` on `booked` → `"Cannot complete an appointment that is booked."`. Success **200**
full `AppointmentDto`.

---

## 6. Inventory (`inventory` app) — `/api/suppliers/**`, `/api/inventory/**`, `/api/stock-movements/**`

Authenticated (same 401 message as §5).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/suppliers/` | not paginated; filters `search`, `is_active` |
| POST | `/api/suppliers/` | create |
| GET | `/api/inventory/` | paginated, page_size 20 |
| GET | `/api/inventory/alerts/` | not paginated — **must route before `/inventory/{id}/`** |
| POST | `/api/inventory/` | create item |
| GET | `/api/inventory/{id}/` | 404 `"Item not found."` |
| PATCH | `/api/inventory/{id}/` | see supplier-reset quirk below |
| GET | `/api/inventory/{id}/batches/` | not paginated; sorted asc by `expiry_date`; no 404 for unknown item |
| GET | `/api/inventory/{id}/movements/` | paginated, sorted desc by `occurred_at`; no 404 for unknown item |
| GET | `/api/stock-movements/` | paginated, page_size 20 |
| POST | `/api/stock-movements/` | records a movement, mutates stock/batches |

### DTOs

```
SupplierDto: { id, name:str, contact_person:str, phone:str, email:str|null, address:str, is_active:bool }

InventoryItemDto: { id, code:str, name:str, category:"medicine"|"consumable"|"equipment", unit:str,
  quantity_in_stock:int, reorder_level:int, unit_price:str, supplier:int|null, supplier_name:str|null,
  is_active:bool, nearest_expiry:"YYYY-MM-DD"|null }

BatchDto: { id, item:int, item_name:str, batch_number:str, quantity:int, expiry_date:"YYYY-MM-DD",
  received_at:ISO-dt, supplier_name:str|null }

StockMovementDto: { id, item:int, item_name:str, batch_number:str|null,
  movement_type:"stock_in"|"stock_out"|"adjustment"|"wastage", quantity:int, reason:str,
  performed_by_name:str, occurred_at:ISO-dt, balance_after:int }
```

### `POST /api/suppliers/`
`name` blank after trim → **400** `{"name": ["This field may not be blank."]}`. Success **201**;
`contact_person`/`phone`/`address` default `""`; `email` default `null`; `is_active` always `true`
on create (not client-settable).

### `GET /api/inventory/`
Filters: `category`, `supplier` (numeric), `stock_status` (`low`: `0 < qty <= reorder_level`;
`out`: `qty <= 0`; `expiring`: `nearest_expiry` within 90 days), `search` (fields: `name`, `code`,
`supplier_name`), `ordering` (default `name`), `page`, `page_size`.

### `GET /api/inventory/alerts/`
Items where `quantity_in_stock <= reorder_level` OR `nearest_expiry <= today+90d`. Register this
route ahead of the `{id}` detail route in Django's URLconf.

### `POST /api/inventory/`
Body: `{code, name, category, unit, reorder_level, unit_price, supplier}`. Validation (400, merged):
- `code` blank after trim → `{"code": ["This field may not be blank."]}`
- `code` already exists → `{"code": ["An item with this code already exists."]}`
- `name` blank after trim → `{"name": ["This field may not be blank."]}`
- `reorder_level` not finite / < 0 → `{"reorder_level": ["Enter a number greater than or equal to 0."]}`
- `unit_price` not finite / < 0 → `{"unit_price": ["Enter a valid price."]}`

Success **201**: `category` default `"consumable"`; `unit` default `"pcs"`; `quantity_in_stock`
always starts `0`; `unit_price` stored `.toFixed(2)`; `is_active` always `true`; `nearest_expiry`
always `null` at creation.

### `PATCH /api/inventory/{id}/`
404 `"Item not found."`. `code` colliding with a *different* item → **400**
`{"code": ["An item with this code already exists."]}`. **Quirk — replicate exactly**: `supplier`
is always recomputed from the payload even if the field is omitted; an omitted `supplier` resolves
to `null`, which **clears any existing supplier link and `supplier_name`**. `quantity_in_stock`,
`is_active`, `nearest_expiry` are not modifiable via this endpoint. Flag this quirk in
PROGRESS.md as a known mock limitation the frontend may be relying on (confirm before "fixing" it).

### `POST /api/stock-movements/` — stock/batch rules
Body: `{item, movement_type, quantity, batch_number?, expiry_date?, reason?}`. Validation (400, merged):
- `item` not found → `{"item": ["Select a valid item."]}`
- `quantity` not finite / <= 0 → `{"quantity": ["Enter a quantity greater than 0."]}`
- `movement_type` not one of the four values → `{"movement_type": ["Select a valid movement type."]}`
- For `stock_out`/`wastage` only (not `stock_in`/`adjustment`): `quantity_in_stock < quantity` → **400**
  `{"quantity": ["Only {current_qty} {unit} in stock; cannot remove {requested_qty}."]}`

Direction: `isInbound = movement_type == 'stock_in'`; every other type subtracts.
`quantity_in_stock = max(0, current + (isInbound ? +qty : -qty))` (clamped, never negative).

Batch behavior (FEFO — first-expiry-first-out):
- Inbound with a non-empty `expiry_date` → creates a new `Batch` (`batch_number` = payload value or
  auto-generated `B<last-6-digits-of-timestamp>`; `received_at`=now; `supplier_name` copied from
  item). Movement's `batch_number` is overridden to this batch's number.
- Inbound with no `expiry_date` → no batch row; movement `batch_number` = payload value or `null`.
- Non-inbound → consume from existing batches for that item sorted ascending by `expiry_date`
  (batches with `quantity<=0` excluded), `min(batch.quantity, remaining)` per batch until
  satisfied; shortfall silently absorbed (no error) since item total already accounts for
  untracked stock. Movement `batch_number` = payload value, else the first batch touched (or
  `null` if none).
- `nearest_expiry` on the item recomputed after every mutation as the min `expiry_date` among
  batches with `quantity>0` (or `null`).

Success **201** `StockMovementDto`. `performed_by_name` = caller's `first_name` or `"System"`.
`balance_after` = item's `quantity_in_stock` **after** the delta.

---

## 7. Lab (`lab` app) — `/api/lab-tests/**`, `/api/lab-orders/**`, `/api/reports/**`

Authenticated (same 401 message).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/lab-tests/` | not paginated; filter `search` (fields: `name`, `code`) |
| GET | `/api/lab-orders/` | paginated, page_size 20 |
| POST | `/api/lab-orders/` | create order |
| GET | `/api/lab-orders/{id}/` | 404 `"Order not found."` |
| POST | `/api/lab-orders/{id}/collect-sample/` | ordered → sample_collected |
| POST | `/api/lab-orders/{id}/start/` | sample_collected → in_progress |
| POST | `/api/lab-orders/{id}/cancel/` | any except completed → cancelled |
| POST | `/api/lab-orders/{id}/results/` | enters results, completes order, issues report |
| GET | `/api/reports/` | paginated, page_size 20; filter `patient` |

### DTOs

```
LabTestDto: { id, code:str, name:str, specimen:str, unit:str, reference_low:str|null,
  reference_high:str|null, price:str, turnaround_hours:int }

LabOrderDto: { id, order_number:str, patient:int, patient_name:str, patient_mrn:str,
  ordered_by:int, ordered_by_name:str, status:str, priority:"urgent"|"routine",
  tests:LabTestDto[], results:LabResultDto[], ordered_at:ISO-dt, sample_collected_at:ISO-dt|null,
  sample_id:str|null, completed_at:ISO-dt|null, clinical_notes:str, report:int|null }

LabResultDto: { id, test:int, test_name:str, unit:str, value:str, reference_low:str|null,
  reference_high:str|null, notes:str }

ReportDocumentDto: { id, patient:int, kind:"lab_report"|"prescription"|"discharge_summary"|"invoice",
  title:str, status:"pending"|"ready"|"downloaded", issued_at:ISO-dt|null, downloaded_at:ISO-dt|null,
  size_bytes:int|null, related_order_number:str|null }
```

### `GET /api/lab-orders/`
Filters: `status`, `status__in` (comma-separated), `priority`, `patient` (numeric), `search`
(fields: `order_number`, `patient_name`, `patient_mrn`, `sample_id`), `ordering` (default
`-ordered_at`), `page`, `page_size`.

### `POST /api/lab-orders/`
Body: `{patient, tests:int[], priority?, clinical_notes?}`. `priority` defaults `"routine"` for any
non-`"urgent"` value. Validation (400, merged):
- `patient` not found → `{"patient": ["Select a valid patient."]}`
- `tests` empty after filtering non-numeric ids → `{"tests": ["Select at least one test."]}`

Success **201**. `order_number` = `"LAB-" + id padded to 5 digits`. `patient_name`/`patient_mrn`
snapshotted at creation (not live-joined). `status="ordered"`; `results=[]`; unknown test ids
silently dropped from `tests`.

### State machine — exact rules

| Endpoint | Valid `from` | → `to` | Invalid → 409 detail |
|---|---|---|---|
| `collect-sample` | `ordered` | `sample_collected` | `"A sample has already been collected for this order."` (used for any other current status) |
| `start` | `sample_collected` | `in_progress` | `"The sample must be collected before analysis can start."` |
| `cancel` | any except `completed` | `cancelled` | `"A completed order cannot be cancelled."` (cancelling an already-cancelled order is a no-op success) |
| `results` | `sample_collected`, `in_progress`, `completed` | `completed` | `cancelled` → `"Results cannot be entered on a cancelled order."`; `ordered` → `"The sample has not been collected yet."` |

`collect-sample` success: `sample_collected_at`=now, `sample_id` = `"S-" + id padded to 5 digits`.

`results` body: `{results: [{test:int, value:str, notes?:str}, ...]}`. Validation (400): every test
on the order must have a non-empty (trimmed) value in the submission — missing or blank →
`{"results.{testId}": ["A result value is required."]}` per test (partial submissions rejected).
Success **200** (not 201 — this is a transition): builds `LabResultDto[]` for every ordered test
(`reference_low`/`reference_high` copied from the test definition); creates a `ReportDocumentDto`
(`kind="lab_report"`, `status="ready"`, `title` = comma-joined test names, `size_bytes` =
`120000 + tests.length*20000`, `related_order_number` = order's `order_number`); order updated:
`status="completed"`, `results`=new array, `completed_at`=now, `report`=new report id.

### `GET /api/reports/`
Staff view — no ownership restriction. Filter `patient` only (no search/ordering/status/kind
filters on this staff route). Default order = insertion order (newest first).

---

## 8. Billing (`billing` app) — `/api/invoices/**`

Authenticated (same 401 message). **Patient-role callers are scoped to their own records** (see
below); no other role restriction exists.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/invoices/` | paginated, page_size 20; patient role forcibly filtered to own invoices |
| GET | `/api/invoices/summary/` | **must route before `/invoices/{id}/`** |
| POST | `/api/invoices/` | create |
| GET | `/api/invoices/{id}/` | 404 for unknown id **or** other patient's invoice (masked) |
| POST | `/api/invoices/{id}/payments/` | staff only (403 for patient role) |
| POST | `/api/invoices/{id}/cancel/` | staff only (403 for patient role) |
| POST | `/api/invoices/{id}/refund/` | staff only; **not in the original mock** — see below |
| GET | `/api/invoices/{id}/download-url/` | 404 masked for other patients; no readiness gate |

### DTOs

```
InvoiceDto: { id, invoice_number:str, patient:int, patient_name:str, patient_mrn:str,
  status:"draft"|"unpaid"|"partial"|"paid"|"cancelled"|"refunded", items:InvoiceLineItemDto[],
  payments:PaymentDto[], tax_rate:str, issued_at:ISO-dt, due_date:"YYYY-MM-DD", notes:str }

InvoiceLineItemDto: { id, source:"consultation"|"admission"|"pharmacy"|"lab"|"procedure",
  description:str, quantity:int, unit_price:str, discount:str, reference:int|null }

PaymentDto: { id, amount:str, method:"cash"|"card"|"bkash"|"nagad"|"bank_transfer"|"insurance",
  reference:str|null, received_at:ISO-dt, received_by_name:str }

DownloadTicketDto: { url:str, expires_at:ISO-dt, filename:str }   # shared with lab report download-url
```

### Derived-value rules (must be replicated exactly — use integer minor units / `Decimal`, never floats)

- `invoice_total_paisa = subtotal + round(subtotal * tax_rate)`, where
  `gross = Σ(round(unit_price*100) * quantity)`, `discount = Σ round(discount*100)` (capped at
  `gross`), `subtotal = gross - min(discount, gross)`.
- `paid_paisa = Σ round(payment.amount * 100)`.
- `status_for(invoice)`: if the **stored** status is `draft`, `cancelled`, or `refunded`, it is
  **sticky** — never recomputed. Otherwise: `paid<=0 → "unpaid"`; `paid>=total → "paid"`; else
  `"partial"`. Recompute and persist after every mutating action.

### `GET /api/invoices/`
If `role == "patient"`: forcibly filtered to `patient == user.patient_id`; the `patient` query
param is ignored entirely for this role. Non-patient roles may filter by `patient` (numeric).
Other filters: `status` (matched against **derived** status), `overdue=true` (`due_date < today`
AND `paid < total` AND stored status not in `{cancelled, refunded, draft}`), `search` (fields:
`invoice_number`, `patient_name`, `patient_mrn`), `ordering` (default `-issued_at`), `page`,
`page_size`.

### `GET /api/invoices/summary/`
No patient scoping in the mock (any authenticated user can call it) — **confirm with user**
whether to restrict this to staff roles in Django, since exposing hospital-wide revenue to a
patient-role token looks unintentional; flagged as an open question, default to keeping mock
parity (unrestricted) unless told otherwise. Excludes invoices with stored status `cancelled` or
`draft` (note: `refunded` **is** included here, unlike the `overdue` filter). Response:
```
{ total_billed:str, total_collected:str, total_outstanding:str, overdue_count:int,
  by_source: [{source:str, amount:str}, ...] }
```
`by_source` grouped by line-item `source`, summing `round(unit_price*100)*quantity -
round(discount*100)` per line (not capped at gross — can diverge slightly from invoice-level math).

### `POST /api/invoices/`
Body: `{patient, items:[{source?, description, quantity, unit_price, discount?}], tax_rate?, due_date?, notes?}`.
Validation (400, merged), per-item errors use dotted keys `items.{i}.{field}`:
- `patient` not found → `{"patient": ["Select a valid patient."]}`
- `items` empty/not array → `{"items": ["An invoice needs at least one line item."]}`
- `items.{i}.description` blank → `["This field may not be blank."]`
- `items.{i}.quantity` not positive integer → `["Enter a whole quantity greater than 0."]`
- `items.{i}.unit_price` null/negative → `["Enter a valid price."]`
- `items.{i}.discount` > `quantity*unit_price` → `["Discount cannot exceed the line total."]`

Success **201**. `invoice_number` = `"INV-2026-" + id padded to 5 digits` (mock hardcodes year
`2026` literally — same open question as patient MRN generation; recommend deriving the year
dynamically, confirm with user). `status` always `"unpaid"` on creation. `source` per item
defaults `"consultation"`; `unit_price`/`discount` stored `.toFixed(2)`; `reference` always `null`
on create. `tax_rate` = submitted or default `0.05`, stored `.toFixed(4)`. `due_date` = submitted
or `today+14 days`. `payments=[]`.

### `GET /api/invoices/{id}/`
404 `"Invoice not found."` for unknown id **or** when `role=="patient"` and
`invoice.patient != user.patient_id` (masked — same message either way, never leak existence).

### `POST /api/invoices/{id}/payments/`
`role=="patient"` → **403** `{"detail": "Payments are recorded by hospital staff."}`. 404 `"Invoice
not found."`. **409** `{"detail": "A cancelled invoice cannot take payments."}` if stored
status is `cancelled` (checks stored value directly, not derived). Body `{amount, method?,
reference?}`. Validation (400): `amount` not a number `>0` → `{"amount": ["Enter an amount greater
than 0."]}`. Overpayment: `round(amount*100) > (total_paisa - paid_paisa)` → **400**
`{"amount": ["The outstanding balance is ৳{remaining/100 formatted to 2dp}."]}` (literal Bengali
Taka symbol `৳` — must match byte-for-byte). Success **200** (not 201) full `InvoiceDto`. Payment
`id` uses a **flat id space across all invoices' payments** (not per-invoice); `method` defaults
`"cash"`; `reference` defaults `null`; `received_by_name` = caller's full name.

### `POST /api/invoices/{id}/cancel/`
`role=="patient"` → **403** `{"detail": "Only hospital staff can cancel an invoice."}`. 404
`"Invoice not found."`. **409** `{"detail": "An invoice with payments must be refunded, not
cancelled."}` if `paid_paisa > 0` — see `POST /api/invoices/{id}/refund/` immediately below, which
now implements that path. Success: `status="cancelled"` (sticky). Response **200** `InvoiceDto`.

### `POST /api/invoices/{id}/refund/` — **not part of the original mock contract**
Added after the mock/Phase-8 build because `cancel`'s own 409 message promised a path
(refunding a paid invoice) that didn't exist anywhere — a real gap, not a deliberate mock
omission. `role=="patient"` → **403** `{"detail": "Only hospital staff can refund an invoice."}`.
Non-`billing.manage` staff role → **403** `{"detail": "You do not have permission to perform this
action."}` (DRF's default `PermissionDenied` message). 404 `{"detail": "Invoice not found."}`.
**409** cases: stored status `cancelled` → `{"detail": "A cancelled invoice cannot be
refunded."}`; stored status already `refunded` → `{"detail": "This invoice has already been
refunded."}`; `paid_paisa(invoice) <= 0` → `{"detail": "An invoice with no payments cannot be
refunded."}`. Success: `status="refunded"` (sticky, like `cancel`). Response **200** `InvoiceDto`.
**Scope note**: this is a status flag only — it does not create a `Payment`-like money-movement
record or track a refund amount/reason. If partial refunds or a refund history/audit trail are
ever needed, that would be a separate `Refund` model mirroring `Payment`.

### `GET /api/invoices/{id}/download-url/`
404 masked (unknown id or wrong patient) `"Invoice not found."`. No readiness gate (unlike lab
report downloads). Response `DownloadTicketDto`: `url` format `/api/invoices/{id}/file/?sig=<token>`,
`filename` = `"{invoice_number}.pdf"`, `expires_at` = now+5min.

### `GET /api/invoices/{id}/file/?sig=<token>` — **not part of the original mock contract**
The mock never served a real file behind this URL (it was a placeholder string); this endpoint
closes that gap. `sig` is a `django.core.signing.TimestampSigner` token, single-resource and
5-minute-lived, issued by `download-url` above. **The signature is the authorization** — no
Bearer token is required to fetch the file itself, since the caller already passed the
role/ownership check to obtain the signed link (same model as a presigned S3/GCS URL). Missing,
malformed, expired, or resource-mismatched `sig` → **403** `{"detail": "This download link is
invalid or has expired."}`. Unknown invoice id → **404** `{"detail": "Invoice not found."}`.
Success: **200**, `Content-Type: application/pdf`, `Content-Disposition: attachment;
filename="<invoice_number>.pdf"` — a real, generated PDF (via `reportlab`) showing the invoice
header, line items, tax/total/paid/balance, and any payments.

---

## 9. Patient portal (`portal` app) — `/api/portal/**`

All portal routes require authentication **and** `role == "patient"` with a non-null
`patient_id`; otherwise **403** `{"detail": "Only patients can access the portal."}`. The
effective patient id for every portal query is **always** `request.user.patient_id` — never a
client-supplied id. This must be enforced server-side identically in Django.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/portal/profile/` | own `PatientDto`; 404 `"Patient not found."` if link is broken |
| GET | `/api/portal/appointments/` | paginated (page_size 20); **no search/ordering params honored** — fixed sort desc by `date+start_time` |
| GET | `/api/portal/reports/` | paginated (page_size 20); filters `kind`, `status`, `search` (fields: `title`, `related_order_number`), `ordering` (default `-issued_at`) |
| GET | `/api/portal/reports/{id}/download-url/` | see below |
| GET | `/api/portal/reports/{id}/file/` | see below; **not in the original mock** |
| POST | `/api/portal/reports/{id}/downloads/` | marks report downloaded |

Note: there is **no** `/api/portal/invoices/` route. Patient billing reuses the plain
`/api/invoices/` and `/api/invoices/{id}/` endpoints, which self-scope for `role=="patient"` (§8).

### `GET /api/portal/reports/{id}/download-url/`
404 `{"detail": "Report not found."}` if unknown id or belongs to another patient (masked). 409
`{"detail": "This report is not ready yet."}` if `status=="pending"`. Success **200**
`DownloadTicketDto`: `url` format `/api/portal/reports/{id}/file/?sig=<token>`, `filename` =
`"{kind}-{id}.pdf"`.

### `GET /api/portal/reports/{id}/file/?sig=<token>` — **not part of the original mock contract**
Same signed-URL model as `GET /api/invoices/{id}/file/` above — see that entry for the full
reasoning. Success **200** `application/pdf`: for `kind="lab_report"` orders, renders the actual
`LabResult` rows (test, value, unit, reference range, notes) from the linked `LabOrder`; other
report kinds render a generic header (title/kind/status/issued date) since there's no structured
data model for prescriptions/discharge summaries yet.

### `POST /api/portal/reports/{id}/downloads/`
404 `"Report not found."` if not found for this patient. Success **201**: report →
`status="downloaded"`, `downloaded_at`=now; returns updated `ReportDocumentDto`. Also appends a
server-side audit row (never exposed via any API) — implement as an internal audit log table.

---

## 10. Open questions / deviations to confirm before or during implementation

1. **RBAC**: the mock enforces no per-role permission checks on any business endpoint — only
   "authenticated or not". Recommend Django introduce real DRF permission classes mirroring
   `permission.strategies.ts` (§2.3) as a deliberate security improvement. **Needs your
   confirmation** before Phase 2, since it's a behavior change vs. strict mock parity.
2. **`/api/invoices/summary/`** has no role restriction in the mock (any authenticated user,
   including patients, can see hospital-wide totals). Recommend restricting to non-patient roles
   in Django. Confirm.
3. **Hardcoded years** in `mrn` (`HMS-2026-NNNN`) and `invoice_number` (`INV-2026-NNNN`) generation
   — recommend deriving the year dynamically in Django rather than reproducing the literal `2026`.
   Confirm.
4. **`PATCH`/`PUT /api/patients/{id}/` full-replace semantics** (an omitted field resets to its
   empty default) — recommend implementing exactly as the mock does, since the frontend's edit
   forms always submit the full patient object; flag if the team wants true partial-PATCH instead.
5. **`GET /api/patients/{id}/admissions/`** only ever returns the current admission, not history —
   recommend confirming whether Django should expose real history (more useful) or match this
   mock limitation.
6. **Inventory `PATCH` supplier-reset quirk** (§6) — an omitted `supplier` field silently clears
   the existing supplier link. Recommend confirming whether this is intentional before Phase 6, or
   should be fixed to a true partial-update (only overwrite `supplier` when present in the
   payload).
7. **SimpleJWT access/refresh TTLs** are not literally part of the wire contract (only the payload
   *fields* `user_id`/`exp`/`token_type` are); use sensible production defaults unless told
   otherwise.

None of these block starting Phase 1 (project scaffold) — they only need resolving before the
phase that touches the affected domain.
