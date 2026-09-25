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
python manage.py createsuperuser
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

1. Set `useMockApi: false` in `src/app/core/config/app-config.ts` (Phase 10).
2. Use the provided `proxy.conf.json` (added in Phase 10) so `/api` requests from
   `ng serve` reach `http://localhost:8000`.

## Demo accounts

Seeded by `python manage.py seed_demo` (Phase 10), porting the accounts and password from
`src/app/core/mock/db.ts`. All demo users share the password `demo1234`.
