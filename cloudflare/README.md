# Cloudflare Worker API (staged implementation)

This folder contains the proposed API implementation. It is **not deployed by GitHub Pages**. The additive D1 tables/indexes were applied to the connected `school-attendance-db` on 2026-10-20 after checking the existing personnel, attendance, and audit tables were empty. The live Worker has not been replaced.

## Components
- `worker.js`: API source for registration, login, profile, attendance, work location, and admin approval.
- `schema.sql`: additive D1 schema for work locations, shifts, leave requests, and indexes.

## Before deployment
1. Back up the D1 database.
2. Apply `schema.sql` to the existing `school-attendance-db`. This migration is additive; it does not delete existing tables or rows.
3. Configure the Worker D1 binding named `DB`.
4. Add a Cloudflare Worker secret named `JWT_SECRET` containing a cryptographically random value of at least 32 bytes. Do not commit it to GitHub or send it in chat.
5. Add the real work location coordinates and approved radius. Do not use sample coordinates for production.
6. Create the first admin account through a controlled one-time setup procedure. Public registration always creates an inactive `staff` account; users cannot choose their own role.
7. Test login, pending-account rejection, admin-only approval, location rejection, duplicate check-in/out, CORS, and token expiry in staging before replacing the current Worker.

## API routes
- `POST /api/register` — creates a pending staff account; hashes password using PBKDF2-SHA-256.
- `POST /api/login` — validates password and returns a short-lived signed bearer token for active accounts.
- `GET /api/me` — returns authenticated account data.
- `GET /api/work-location` — returns all active work locations.
- `GET /api/attendance` — employee sees their own records; supervisor/admin can see recent records.
- `POST /api/attendance` — validates token, coordinates, reported accuracy, configured geofence, and daily check-in/out sequence before writing to D1.
- `GET /api/admin/personnel` — admin-only personnel list.
- `POST /api/admin/approve` — admin-only account activation/suspension with audit log.\n- `POST /api/admin/personnel/role` — admin-only role changes for staff, supervisor, and admin, with audit log.\n- `GET/POST/PATCH /api/admin/locations` — admin-only location listing, creation, radius changes, and activation/deactivation.\n- `GET/POST /api/admin/shifts` — admin-only shift listing and creation.\n- `POST /api/leave-requests` — authenticated staff leave request submission.\n- `GET /api/admin/leaves` and `POST /api/admin/leaves/review` — admin-only leave review with audit log.

## Important security notes
- Browser GPS is not proof against a determined spoofing attack. The API performs server-side checks, but policy may require managed devices, additional verification, or manual review.
- The browser UI must be updated to call these APIs before the system is considered end-to-end production-ready. Existing dashboard, leave pages, and reports in `app.js` still include demo/localStorage behavior until migrated.
- Password reset, rate limiting, data retention, backups, privacy notice, and audit review still need implementation or policy decisions.
- Never expose `JWT_SECRET`, LINE credentials, or admin test keys in client code or Git.
