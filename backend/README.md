# Hospital Management API (Django)

Drop-in Django REST backend for the `hospital-management-angular` frontend. The wire contract it
implements is documented in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md); build progress is
tracked in [`PROGRESS.md`](PROGRESS.md).

## Requirements

- Python 3.12+
- SQLite (bundled) for local dev; PostgreSQL in production

## Setup

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then edit SECRET_KEY etc.
python manage.py migrate
python manage.py seed_demo   # demo users/patients/doctors/etc — safe to re-run
python manage.py runserver
```

The API is served at `http://localhost:8000/api/`. Interactive docs:

- OpenAPI schema: `http://localhost:8000/api/schema/`
- Swagger UI: `http://localhost:8000/api/docs/`

## Settings

Settings are split under `config/settings/`:

- `base.py` — shared configuration
- `dev.py` — local development (SQLite, `DEBUG=True`); used by `manage.py`
- `prod.py` — production (PostgreSQL via `DATABASE_URL`, HTTPS enforcement); used by `wsgi.py`/`asgi.py`

Override `DJANGO_SETTINGS_MODULE` to switch explicitly, e.g.:

```bash
DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py migrate
```

## Running tests

```bash
pytest
```

Every phase's definition of done requires `python manage.py check`,
`python manage.py makemigrations --check`, and `pytest` to all pass before committing.

## Connecting the Angular frontend

`useMockApi` is now `false` in `src/app/core/config/app-config.ts`, and `proxy.conf.json` at the
repo root (wired into `angular.json`'s `serve.options.proxyConfig`) forwards `/api/**` from
`ng serve` to `http://localhost:8000`. With both servers running:

```bash
# terminal 1
cd backend && source .venv/bin/activate && python manage.py runserver

# terminal 2, repo root
npm install
npm start   # ng serve, now proxying /api to Django
```

Verified end-to-end (Phase 10): JWT login, `/api/auth/me/`, public departments/doctors listing,
staff patients/doctors lists, the patient portal profile, and the public contact form all round-
trip correctly through `ng serve`'s proxy to the real Django API.

## Demo accounts

Seeded by `python manage.py seed_demo`, porting the demo users and password from
`src/app/core/mock/db.ts`. All demo users share the password `demo1234`: `admin`, `doctor`,
`nurse`, `reception`, `lab`, `pharmacy` (one per role), and `patient` (linked to the first seeded
patient record, `HMS-2026-0001`). The command also seeds a representative — not exhaustive —
set of departments, doctors with schedules, patients, wards/beds, inventory items, lab tests,
and one invoice, so every endpoint has something to return. It's idempotent: safe to re-run.

Scope note: the mock generates a rolling 15-day window of randomized appointments/lab
orders/invoices from a seeded PRNG — that's inherently time-relative and wasn't worth
reproducing verbatim. `seed_demo` instead seeds a small, fixed set of realistic rows covering
every status a demo would want to click through.

## Design decisions (deviations from strict mock parity)

The mock API is the wire-contract source of truth for paths, payloads, status codes and error
messages (see `docs/API_CONTRACT.md`). Where the mock's *behavior* looked like an oversight rather
than an intentional part of the contract, reasonable calls were made autonomously and are recorded
here instead of blocking on confirmation:

- **Real per-role authorization (Phase 2).** The mock enforces no RBAC on any business endpoint —
  any authenticated user, any role, can call any endpoint. That's a real security gap, not
  something the frontend depends on (the frontend already hides/guards by role client-side via
  `permission.strategies.ts`). `accounts/permissions.py` mirrors that same role → permission table
  server-side, and every business endpoint from Phase 3 onward is gated with
  `require(<permission>)`. Wire shapes (paths, payloads, status codes, error messages) are still
  matched exactly; only "which roles may call this endpoint" is stricter than the mock.
- **`/api/invoices/summary/` restricted to staff roles** (Phase 8) rather than any authenticated
  user, since the mock's version would let a patient token see hospital-wide revenue — an
  oversight, not a feature to preserve.
- **MRN/invoice number year derived dynamically** (`HMS-<year>-NNNN`, `INV-<year>-NNNN`) instead of
  the mock's hardcoded literal `2026` (Phases 4 & 8).
- **Patient `PATCH`/`PUT` kept as full-replace**, matching the mock exactly (an omitted field
  resets to its default) — the frontend's edit forms always submit the complete object, so
  changing this would be a real behavior change for no benefit (Phase 4).
- **`GET /patients/{id}/admissions/`**: exposes full admission history rather than the mock's
  "current admission only" limitation, since the model naturally supports it and it's strictly
  more useful with no wire-shape cost (Phase 4).
- **Inventory `PATCH` supplier field**: only overwrites `supplier`/`supplier_name` when the field
  is present in the payload, rather than the mock's quirk of clearing it on every omitted-field
  PATCH (Phase 6) — the mock's behavior looks like a bug the frontend doesn't intentionally rely
  on.
- **`doctor_id` added to `/api/auth/me/`** (post-Phase-10), on request from the frontend team, so
  a doctor's own session can resolve their `Doctor` id directly instead of matching by name. Not
  present in the original mock's `AuthUserDto` — additive, doesn't remove or rename any existing
  field, so it's safe even if the frontend hasn't updated its type yet.
- **`POST /api/invoices/{id}/refund/` added** (post-Phase-10) — not part of the original mock.
  `cancel`'s own 409 message ("must be refunded, not cancelled") pointed at a path that never
  existed anywhere, mock included; that's a real dead end, not an intentional gap. Implemented as
  a status flag only (`status="refunded"`, sticky, same shape as `cancel`) — it does not model
  money movement or a refund amount/reason. If that's ever needed, it wants a `Refund` model
  mirroring `Payment`, not a bigger `cancel`/`refund` view.

Each of these is also noted at the point it lands in `PROGRESS.md`.
