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
- [ ] Django project layout under `backend/` (settings split: base/dev/prod)
- [ ] `.env.example`, `requirements.txt`
- [ ] CORS for `http://localhost:4200`
- [ ] Custom `User` model in `accounts` (before first migration)
- [ ] DRF pagination/filter defaults (PAGE_SIZE=20, SearchFilter, OrderingFilter)
- [ ] drf-spectacular (`/api/schema/`, `/api/docs/`)
- [ ] pytest + pytest-django setup
- [ ] `backend/README.md` with run instructions

## Phase 2 — accounts
- [ ] JWT endpoints (`/api/token/`, `/api/token/refresh/`, `/api/token/blacklist/`)
- [ ] `/api/auth/me/`
- [ ] Role permission classes mirroring `permission.strategies.ts` (pending confirmation of scope)
- [ ] Tests: happy path, validation, 401, 403, role matrix

## Phase 3 — public_site
- [ ] departments, doctors, slots, services, packages, testimonials
- [ ] guest booking + lookup, contact
- [ ] Tests per endpoint (happy path, validation, 404/400 cases)

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
