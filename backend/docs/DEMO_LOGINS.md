# Demo logins

Seeded by `python manage.py seed_demo` (see `backend/README.md`). Password is `demo1234` for
every account.

| username    | role           | notes                                          |
|-------------|----------------|-------------------------------------------------|
| `admin`     | Administrator  |                                                 |
| `doctor`    | Doctor         | linked to demo doctor "Dr. Imran Hossain" (id 1) |
| `nurse`     | Nurse          |                                                 |
| `reception` | Receptionist   |                                                 |
| `lab`       | Lab Technician |                                                 |
| `pharmacy`  | Pharmacist     |                                                 |
| `patient`   | Patient        | linked to demo patient `HMS-2026-0001`         |

Front end: `http://localhost:4200/login`
API directly: `POST /api/token/` with `{"username": "...", "password": "demo1234"}`

None of these are Django-admin (`/admin/`) accounts — that's a separate login. To get into
`/admin/`, create a real superuser:

```bash
cd backend
source .venv/bin/activate
python manage.py createsuperuser
```
