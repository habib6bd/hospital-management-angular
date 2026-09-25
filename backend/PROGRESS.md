# Django API — Build Progress

Tracks the phased build described in the task brief. See `backend/docs/API_CONTRACT.md` for the
full endpoint spec every phase implements against.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

## Phase 0 — Contract & planning
- [x] Read all mock handlers, DTOs, seeds, auth files
- [x] Write `backend/docs/API_CONTRACT.md`
- [x] Write `backend/PROGRESS.md`
- [x] No code written this phase
- Open questions raised (see API_CONTRACT.md §10): RBAC enforcement scope, `/invoices/summary/`
  access, hardcoded MRN/invoice years, patient full-replace PATCH semantics, admissions-history
  endpoint scope, inventory PATCH supplier-reset quirk. **Awaiting answers before phases that
  touch these.**

## Phase 1 — Project scaffold
- [x] Django project layout under `backend/` (settings split: base/dev/prod)
- [x] `.env.example`, `requirements.txt`
- [x] CORS for `http://localhost:4200`
- [x] Custom `User` model in `accounts` (before first migration)
- [x] DRF pagination/filter defaults (PAGE_SIZE=20, SearchFilter, OrderingFilter)
- [x] drf-spectacular (`/api/schema/`, `/api/docs/`)
- [x] pytest + pytest-django setup
- [x] `backend/README.md` with run instructions
- Checks: `python manage.py check` ✅, `makemigrations --check` ✅, `pytest` (1 passed) ✅
- Deviations: `User.patient_id` is a plain `PositiveIntegerField` for now (not yet a FK to
  `patients.Patient`, which doesn't exist until Phase 4) to avoid a premature cross-app migration
  dependency; will consider upgrading to a real FK in Phase 4. One app per domain created
  (`accounts, public_site, patients, appointments, inventory, lab, billing, portal`), each with an
  empty `urls.py` placeholder wired into `config/urls.py`, filled in as its phase lands.

## Phase 2 — accounts
- [x] JWT endpoints (`/api/token/`, `/api/token/refresh/`, `/api/token/blacklist/`) — stock
  SimpleJWT views; their default error messages already match the mock exactly
- [x] `/api/auth/me/`
- [x] Role permission classes mirroring `permission.strategies.ts` (`accounts/permissions.py`,
  `require(<permission>)`) — enforced server-side from Phase 3 onward; see README "Design
  decisions" for why this deliberately goes beyond the mock's "authenticated only" behavior
- [x] Tests: happy path (login/refresh/blacklist/me), 401 anonymous, 403 wrong role, full role
  matrix transcription test
- Checks: `python manage.py check` ✅, `makemigrations --check` ✅, `pytest` (16 passed) ✅
- No contract deviations in wire shape — `/api/token/`, `/api/token/refresh/`,
  `/api/token/blacklist/`, `/api/auth/me/` match paths/payloads/status codes/messages exactly.

## Phase 3 — public_site
- [x] departments, doctors, slots, services, packages, testimonials
- [x] guest booking + lookup, contact
- [x] Tests per endpoint (happy path, validation, 404/400 cases) — 34 tests total across
  accounts + public_site
- Checks: `python manage.py check` ✅, `makemigrations --check` ✅, `pytest` (34 passed) ✅
- Also added (ahead of their own phases, since public-site booking needs them): `appointments`
  app's `Doctor`, `DoctorSchedule`, `Appointment` models and a shared `appointments/services.py`
  (`compute_slots`, `next_token_number`) reused by both public_site now and the staff-side
  appointments endpoints in Phase 5. `Appointment.patient_id` is a plain integer for the same
  reason as `accounts.User.patient_id` (Phase 4 dependency) — guest bookings use the mock's
  `patient_id=0` sentinel with no real patient record either way.
- Deviations from strict mock parity: `GET /api/public/departments/`,
  `/api/public/services/`, `/api/public/packages/`, `/api/public/testimonials/` return DRF's
  full pagination envelope (`{count,next,previous,results}`) with `next`/`previous` always
  `null` rather than a bare array — matches the mock's actual wire shape (it also wraps these in
  the same 4-key envelope), just implemented via a fixed large `page_size` instead of skipping
  pagination outright.

## Phase 4 — patients
- [ ] patients CRUD, history
- [ ] admissions (admit/discharge), wards, beds, bed release
- [ ] Tests incl. admit/discharge state transitions (valid + 409 invalid)

## Phase 5 — appointments
- [ ] doctors, schedules, slots
- [ ] appointments CRUD + state-transition actions (check-in/start/complete/cancel/no-show)
- [ ] Tests for every transition (valid + 409 invalid)

## Phase 6 — inventory
- [ ] items, batches, movements, stock-movements, suppliers, alerts
- [ ] FEFO batch consumption logic
- [ ] Tests incl. stock-out insufficient-stock 400, FEFO ordering

## Phase 7 — lab
- [ ] lab-tests, lab-orders + collect-sample/start/results/cancel
- [ ] reports
- [ ] Tests for full state machine (valid + 409 invalid transitions)

## Phase 8 — billing
- [ ] invoices, line items, payments, cancel, summary, download-url
- [ ] Paisa-precision derived status/total logic
- [ ] Tests incl. overpayment 400, cancel-with-payments 409, sticky statuses

## Phase 9 — portal
- [ ] `/portal/profile`, appointments, reports, download-url, downloads
- [ ] Patient-scoped access enforced server-side (never trust client patient id)
- [ ] Tests incl. 403 non-patient, 404-masking for other patients' records

## Phase 10 — seed data & integration
- [ ] `python manage.py seed_demo` management command (ports `db.ts` seeds + demo users/passwords)
- [ ] `proxy.conf.json` in Angular root (`/api` → `http://localhost:8000`)
- [ ] Final end-to-end check with `useMockApi: false`

## Definition of done (every phase)
1. Match mock handler + DTO exactly (paths, fields, statuses, messages)
2. Models w/ constraints/indexes, serializers, ViewSets/APIViews, `@transaction.atomic` for
   multi-step ops
3. pytest: happy path, validation error shape, 401 anonymous, 403 wrong role, every state
   transition (valid + invalid → 409)
4. `python manage.py check`, `makemigrations --check`, `pytest` all pass
5. Tick this file, note any contract deviation and why
6. Commit, push branch
7. Stop and report; wait for "continue"
