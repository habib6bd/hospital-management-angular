# Full-stack workflow: how the frontend and backend fit together

This is the map for a developer who is new to this repo: how a request actually travels from a
click in the browser to a row in the database and back, how auth works end to end, and where to
look when something needs fixing or a new endpoint needs adding.

Two other docs complement this one and are the source of truth for their own scope — this file
does not repeat them, it links to them:

- **`backend/docs/API_CONTRACT.md`** — the exact wire contract (every path, payload, status
  code, error message) that the mock and the real Django API both implement.
- **`backend/PROGRESS.md`** / **`backend/README.md`** — what's been built, in what order, and
  every deliberate deviation from the mock with its reasoning.

---

## 1. The two halves

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  Angular 22 SPA (src/)       │  HTTP  │  Django 5 + DRF (backend/)   │
│  - standalone components     │ ─────► │  - one app per domain        │
│  - signals for state         │ ◄───── │  - SimpleJWT auth            │
│  - HttpClient + interceptors │  JSON  │  - PostgreSQL (SQLite in dev)│
└──────────────────────────────┘        └──────────────────────────────┘
```

- **Frontend**: standalone Angular components, feature-folder layout, signals (not NgRx) for
  state, lazy-loaded routes per feature.
- **Backend**: Django REST Framework, one app per business domain (`accounts`, `public_site`,
  `patients`, `appointments`, `inventory`, `lab`, `billing`, `portal`), JWT auth via
  `djangorestframework-simplejwt`.
- **They never share a process.** In dev, `ng serve`'s built-in proxy (`proxy.conf.json`) forwards
  `/api/**` to `http://localhost:8000` so the browser only ever talks to one origin. In
  production they'd sit behind the same reverse proxy the same way.

### Repo layout, the parts that matter

```
src/app/
  core/               # cross-cutting: auth, http interceptors, config, i18n
    auth/             # AuthService, PermissionService, guards, role model
    interceptors/      # error / auth / loading / mock-api — HTTP pipeline
    http/             # ApiError normalisation, pagination types
    mock/             # the in-memory mock API (see §6)
    config/           # AppConfig — apiBaseUrl, useMockApi flag
  features/           # one folder per screen/domain — the actual UI + services
  layout/             # shells (staff app shell, public site shell)
  shared/             # dumb reusable UI components (card, table, empty-state, ...)

backend/
  config/             # settings/{base,dev,prod}.py, urls.py, pagination, download tokens
  accounts/           # User model, JWT endpoints, /auth/me/, role permission table
  public_site/        # anonymous website: departments, doctors, booking, contact
  patients/           # patients, wards, beds, admissions, history
  appointments/       # doctors, schedules, slots, appointment lifecycle
  inventory/          # items, batches, stock movements, suppliers
  lab/                # lab tests, orders, results, reports (+ PDF rendering)
  billing/            # invoices, payments, refund, PDF rendering
  portal/             # patient-only endpoints (own data only)
  docs/               # API_CONTRACT.md, DEMO_LOGINS.md
```

---

## 2. What happens on every single API call (frontend side)

A component never calls `HttpClient` directly — it goes through a feature service
(`patient.service.ts`, `billing.service.ts`, …), which builds the URL from
`AppConfig.apiBaseUrl` (`/api` by default) and calls `HttpClient`. From there, every request and
response passes through the same four interceptors, registered in `app.config.ts` in this exact
order (outermost first):

```
errorInterceptor → authInterceptor → loadingInterceptor → mockApiInterceptor → (network)
```

Requests travel down that list; responses travel back up it. What each one does:

1. **`mockApiInterceptor`** (innermost) — when `AppConfig.useMockApi` is `true`, this intercepts
   every request whose path starts with `apiBaseUrl` and answers it itself from
   `core/mock/handlers/*.ts`, simulating network latency. When `useMockApi` is `false` (the
   current setting), it's a no-op and the request actually goes to the network — to Django via
   the dev proxy or a configured `apiBaseUrl` in production.
2. **`loadingInterceptor`** — flips a global "in flight" signal a top-level spinner reads. Does
   not touch the request/response body.
3. **`authInterceptor`** — attaches `Authorization: Bearer <access token>` (read from
   `AuthService`). If the response comes back `401`, it calls `AuthService.refreshSession()`
   (single-flight — concurrent 401s share one refresh call) and replays the original request with
   the new token. A second `401` after a successful refresh means the refresh token itself is
   dead, so it signs the user out.
4. **`errorInterceptor`** (outermost) — normalises whatever DRF sent (`{"detail": ...}`,
   `{"field": [...]}`, `{"non_field_errors": [...]}` — see `core/http/api-error.ts`) into one
   `ApiError` shape the rest of the app deals with, and raises a toast unless the caller opted
   out (`SKIP_ERROR_TOAST`) or the status was `401` (handled silently by step 3).

A request can skip auth/error handling via `HttpContext` tokens (`SKIP_AUTH`,
`SKIP_ERROR_TOAST`) — used for the login/refresh calls themselves, since those can't carry a
bearer token or shouldn't toast on a bad password.

---

## 3. What happens on every single API call (backend side)

```
config/urls.py  →  <app>/urls.py  →  DRF View  →  Permission check  →  Serializer  →  Response
```

1. **`config/urls.py`** routes every path under a per-domain prefix into that app's own
   `urls.py` (e.g. everything under `/api/patients/` and `/api/wards/` into `patients/urls.py`).
2. Each **view** is a DRF `generics.*APIView` or plain `APIView`. `get_permissions()` (or a class
   attribute) picks a permission class per HTTP method — almost always
   `accounts/permissions.py`'s `require(<permission>)`, a factory built from a **role →
   permission table that mirrors the frontend's `permission.strategies.ts` exactly** (see §5).
3. Validation happens by hand in most `create()`/`post()` methods (not full DRF serializers),
   because the wire contract needs exact DRF-native error shapes and specific field-by-field
   messages that had to match the mock precisely — see `API_CONTRACT.md` for why.
4. The response is built by a `ModelSerializer` (read paths) and returned as a plain
   `Response(...)` (write/action paths), always as the snake_case JSON shape the contract
   defines — never the frontend's camelCase domain models. That translation happens back on the
   frontend (see §4).

---

## 4. DTOs vs domain models — the translation layer

The backend only ever speaks the wire contract: snake_case, DRF pagination envelopes, DRF error
shapes. The frontend never uses that shape directly in a component or template. Each feature has
a `*.dto.ts` (the exact wire shape, e.g. `PatientDto`) and a `*.model.ts` (a camelCase domain
type, e.g. `Patient`), with a pure mapping function between them (`toPatient(dto)`,
`toPatientDto(model)`). Feature services return the domain model; only the service itself ever
imports the DTO type. If you're adding a field to an endpoint, you touch it in **three** places on
the frontend (DTO, model, mapper) in addition to the backend serializer.

---

## 5. Authorization: two independent layers, one source of truth

- **Frontend** (`core/auth/permission.strategies.ts`): a `Role → Permission[]` table drives
  nav visibility, dashboard widgets, and route guards (`canMatch`/`canActivate` in
  `app.routes.ts`). This is UX only — it decides what a user *sees*, not what they're allowed to
  *do*. A determined user could bypass every guard from devtools.
- **Backend** (`accounts/permissions.py`): the same table, transcribed, drives `require(<perm>)`
  on every business endpoint. **This is the real security boundary.** The mock API this whole
  backend replaces enforced no RBAC at all (any authenticated role could call anything) — adding
  real enforcement here was a deliberate improvement, documented in
  `backend/README.md` "Design decisions".
- **They are two files that must be kept in sync by hand.** There's a test
  (`accounts/tests.py::TestRolePermissionMatrix`) that transcribes the table as a guard, but
  nothing currently fails automatically if the frontend's table changes and the backend's
  doesn't. If you change who can do what, change both, and re-run that test.

---

## 6. The mock API, and how to switch off it

`src/app/core/mock/` is a complete in-memory reimplementation of the wire contract — the same
paths, payloads, and error messages the real Django API implements, backed by
`core/mock/db.ts` (an in-memory object) instead of a database. It exists so the frontend can be
built and tested with zero backend running.

- **Toggle**: `AppConfig.useMockApi` in `src/app/core/config/app-config.ts`. It's `false` today —
  the app talks to the real Django API.
- **When `true`**: `mockApiInterceptor` answers every `/api/**` call itself; Django never sees a
  request.
- **When `false`**: that interceptor is a no-op; requests go over the network, through
  `proxy.conf.json` in dev (`/api` → `http://localhost:8000`) or directly to `apiBaseUrl` in a
  built app.
- The mock is also the **spec**: `backend/docs/API_CONTRACT.md` was written by reading every
  mock handler, and the real backend was built to match it byte-for-byte except where documented
  otherwise. If frontend and backend ever disagree on a shape, the mock handler
  (`core/mock/handlers/*.ts`) is the tiebreaker unless a documented deviation says otherwise.

---

## 7. Concrete end-to-end flows

Each of these names the actual files involved, in call order, so you can trace a real feature
instead of a hypothetical one.

### 7.1 Staff login → dashboard

1. `features/site/auth/login.component.ts` calls `AuthService.login({username, password})`.
2. `AuthService` → `POST /api/token/` (skips auth/error-toast context) →
   `accounts/urls.py` → stock SimpleJWT `TokenObtainPairView` → `accounts.User` lookup →
   `{access, refresh}`.
3. `AuthService.fetchCurrentUser()` → `GET /api/auth/me/` with the new access token →
   `accounts/views.py::MeView` → `AuthUserSerializer` → `AuthUserDto`
   (`id, username, role, staff_id, patient_id, doctor_id, avatar_url, ...`).
4. `toAuthUser(dto)` maps it to the camelCase `AuthUser`; `AuthService` commits
   `{status: 'authenticated', user, tokens}` into its signal and persists tokens via
   `TokenStorageService` (localStorage).
5. `app.routes.ts`'s `/app` redirect resolves `PermissionService.landingRoute()` (from the same
   role table as §5) and navigates there; `roleGuard`/`canMatch` on each feature route re-checks
   the role before that lazy chunk even downloads.
6. The dashboard's widgets (`features/dashboard/widgets/*`) each call their own domain service
   (e.g. `AppointmentService` for "my appointments today", filtered client-side by the session's
   `doctor_id` for a doctor role) — see §7.4 for one of those underlying calls in full.

### 7.2 Guest books an appointment from the public site (no login)

1. `features/site/booking/booking.component.ts` calls `PublicSiteService.book(...)`.
2. `POST /api/public/appointments/` — no auth required (`public_site/urls.py` routes never
   require a token).
3. `public_site/views.py::GuestBookingCreateView` validates every field by hand (date window,
   phone format, age range — see `API_CONTRACT.md` §3 for the exact messages), computes the
   doctor's real slot availability via `appointments/services.py::compute_slots()` (the same
   function the staff-side booking screen uses — one implementation, not two), then creates an
   `Appointment` (`patient_id=0`, `patient_mrn="GUEST"`) and a `GuestBooking` lookup row.
4. Response is a `BookingConfirmationDto` with a human-readable reference (`CW-YYMMDD-NNNN`); the
   frontend navigates to `booking-confirmation.component.ts` showing it.
5. The guest can later look themselves up (`GET /api/public/appointments/lookup/?reference=&phone=`)
   without ever creating an account.

### 7.3 Admitting a patient (staff)

1. `features/patients/patient-detail-component` (or similar) calls `PatientService.admit(id, {bed})`.
2. `POST /api/patients/{id}/admit/`, gated by `patients.admit` (nurse/doctor/admin have it —
   receptionist and lab_technician don't).
3. `patients/views.py::PatientAdmitView`: checks the patient isn't already admitted (409 if so),
   validates the chosen `Bed` is `available` (400 if not), then in one method: creates an
   `Admission` row, flips the `Bed` to `occupied`, and flips the `Patient` to `patient_type="ipd"`
   with `current_admission` pointing at the new row.
4. Response is the updated `PatientDto` (with `current_admission` embedded); the frontend updates
   its local signal/service state from that response rather than refetching the list.

### 7.4 Lab order → results → report → signed PDF download

1. Doctor orders tests: `POST /api/lab-orders/` (`lab.order` permission) — creates a `LabOrder`
   with `status="ordered"`.
2. Lab technician progresses it: `POST /api/lab-orders/{id}/collect-sample/` →
   `sample_collected`, then `POST /.../start/` → `in_progress` (both need `lab.result`). Each
   invalid transition returns a specific `409` (see `API_CONTRACT.md` §7's `TRANSITIONS` table —
   this state machine is enforced only server-side; there is no separate frontend state machine
   to keep in sync).
3. Results entered: `POST /.../results/` with every ordered test's value. In one method:
   validates every test has a value (400 if not), creates `LabResult` rows (snapshotting the
   test's reference range at that moment), creates a `ReportDocument`
   (`status="ready"`), and flips the order to `completed`.
4. Patient views it in the portal: `GET /api/portal/reports/` (self-scoped to
   `request.user.patient_id`, never a client-supplied id — see `portal/permissions.py`).
5. Patient requests a download link: `GET /api/portal/reports/{id}/download-url/` → a signed,
   5-minute, single-resource token (`config/download_tokens.py`, built on
   `django.core.signing.TimestampSigner`) embedded in a `url` field.
6. Patient (or anyone holding that link within 5 minutes) fetches it:
   `GET /api/portal/reports/{id}/file/?sig=...` — **no bearer token needed here**; the signature
   itself is the authorization, since the caller already passed the ownership check in step 5.
   `lab/pdf.py::render_report_pdf()` builds an actual PDF (via `reportlab`) from the `LabResult`
   rows and streams it back.

### 7.5 Invoice → payment → refund

1. `POST /api/invoices/` (`billing.manage`) creates the invoice with computed totals done in
   **integer paisa** throughout (`billing/services.py`) to avoid float drift.
2. `POST /api/invoices/{id}/payments/` records a `Payment`; `status` (`unpaid`/`partial`/`paid`)
   is *derived*, not stored directly, from `paid_paisa` vs `invoice_total_paisa` — except three
   "sticky" statuses (`draft`, `cancelled`, `refunded`) that a payment never overwrites.
3. If the invoice needs undoing: `POST /.../cancel/` (only legal with **no** payments) or
   `POST /.../refund/` (only legal **with** payments) — added after the mock's `cancel` error
   message referenced a refund path that never existed anywhere; see
   `backend/README.md` "Design decisions" for the full story.
4. `GET /.../download-url/` + `GET /.../file/` work exactly like the report flow in §7.4 —
   `billing/pdf.py` renders the invoice (line items, tax, total, paid, balance, payment history)
   as a real PDF.

---

## 8. Adding a new endpoint — the checklist

If a feature needs a backend capability that doesn't exist yet:

1. **Check the contract first**: is this in `backend/docs/API_CONTRACT.md`? If the frontend
   mock (`src/app/core/mock/handlers/*.ts`) already has it, copy its exact path, payload, status
   codes and error messages — don't invent a new shape.
2. **Model** (if needed) in the right domain app's `models.py`, then
   `python manage.py makemigrations <app>`.
3. **Serializer** in `serializers.py` — snake_case fields matching the DTO exactly.
4. **View** in `views.py` — pick the right `require(<permission>)` from
   `accounts/permissions.py` (add a new permission constant there first if none fits, and update
   both the frontend's `permission.strategies.ts` and this backend table together — see §5).
5. **URL** in that app's `urls.py`.
6. **Tests**: happy path, validation error shape, `401` anonymous, `403` wrong role, and every
   state transition if there's a status machine involved.
7. Run `python manage.py check`, `makemigrations --check`, and `pytest` — all must pass.
8. **Update `API_CONTRACT.md`** and, if this is new/deviates from the mock, say so explicitly
   there and in `PROGRESS.md`/`README.md` "Design decisions" — future readers (including a future
   you) need to know which parts were invented versus ported.
9. On the frontend: add/update the `*.dto.ts`, `*.model.ts`, mapper, and the feature service
   method that calls it.

---

## 9. Local dev quick start

Full details are in `backend/README.md`; the short version:

```bash
# terminal 1 — backend
cd backend && source .venv/bin/activate
python manage.py migrate && python manage.py seed_demo && python manage.py runserver

# terminal 2 — frontend, repo root
npm install && npm start   # ng serve, proxies /api to localhost:8000
```

Demo logins are in `backend/docs/DEMO_LOGINS.md` (password `demo1234` for every seeded account).
