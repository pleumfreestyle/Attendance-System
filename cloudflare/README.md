# Cloudflare Worker API (staged implementation)

This folder contains the proposed API implementation. It is **not deployed by GitHub Pages**, and the live Worker has not been replaced. The additive D1 tables/indexes and `personnel.token_version` migration were applied to `school-attendance-db` on 2026-10-20 after checking the existing tables were empty.

## Components
- `worker.js`: API source for registration, login, profile, attendance, work location, leave requests, and admin management.
- `schema.sql`: additive D1 schema for work locations, shifts, leave requests, and indexes.
- `migrations/20261020_token_version.sql`: one-time migration adding `personnel.token_version`; do not rerun blindly if it has already been applied.

## Before deployment

1. Confirm the Worker D1 binding is named `DB`.
2. Confirm Worker secret `JWT_SECRET` contains a cryptographically random value of at least 32 bytes. Never commit or share it.
3. Configure the real work location coordinates and approved radius through the admin page; do not use sample coordinates in production.
4. Create the first admin account through a controlled one-time setup procedure. Public registration creates an inactive `staff` account; users cannot choose their own role.
5. The proposed `worker.js` includes the existing LINE `/webhook` signature-verification route and `/test-send` push route. **Their presence in source does not prove live delivery works.** Test webhook signature handling and a real test push against a staging deployment before replacing the live Worker.
6. The webhook currently validates the LINE signature and acknowledges the request; it does not process LINE events or trigger attendance notifications.
7. Test login, pending-account rejection, admin-only approval, location rejection, duplicate check-in/out, CORS, token expiry, password reset, and role-based access before replacing the current Worker.
8. Deploy the Worker only after the above checks pass, then verify the live API and LINE delivery again.

## API routes
- `POST /api/register` — creates a pending staff account; hashes password using PBKDF2-SHA-256.
- `POST /api/login` — validates password and returns a short-lived signed bearer token for active accounts.
- `GET /api/me` — returns authenticated account data.
- `GET /api/work-location` — returns active work locations.
- `GET /api/attendance` — employee sees their own records; supervisor/admin can see recent records.
- `POST /api/attendance` — validates token, coordinates, reported accuracy, configured geofence, and daily check-in/out sequence before writing to D1.
- `GET /api/admin/personnel` — admin-only personnel list.
- `POST /api/admin/approve` — admin-only account activation/suspension with audit log.
- `POST /api/admin/personnel/role` — admin-only role changes for staff, supervisor, and admin, with audit log.
- `GET/POST/PATCH /api/admin/locations` — admin-only location listing, creation, radius changes, and activation/deactivation.
- `GET/POST /api/admin/shifts` — admin-only shift listing and creation.
- `POST /api/leave-requests` — authenticated staff leave request submission.
- `GET /api/admin/leaves` and `POST /api/admin/leaves/review` — admin-only leave review with audit log.

## Important limitations and security notes
- Browser GPS is not proof against a determined spoofing attack. The API performs server-side checks, but policy may require managed devices, additional verification, or manual review.
- The frontend has API-backed login, registration, attendance history and several management pages, but the attendance flow and some other UI paths still need end-to-end verification against the deployed Worker. Do not treat the system as production-ready until those tests pass.
- Password-reset requests use an admin-reviewed flow; there is no email provider configured, so the temporary password must be delivered through a verified channel.
- Report export currently covers the API's latest-record limit (up to 500 rows), not paginated history.
- Rate limiting, data retention, backups, privacy notice, and audit review still need implementation or policy decisions.
- Never expose `JWT_SECRET`, LINE credentials, or admin test keys in client code or Git.
