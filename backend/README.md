Backend scaffold (Node + Express + Sequelize)

Quick start

1. Copy `.env.example` to `.env` and fill database values.
2. Install dependencies

```bash
cd backend
npm install
```

3. Run the MySQL migration SQL created earlier (backend/migrations/001_init.sql) into your database.

4. Start server

```bash
npm run dev
```

API endpoints

- `GET /api/compliance/check/:requestId` — returns `{ compliant: boolean, uploadedCount }`
- `POST /api/documents/upload` — multipart form with `file`, and fields `request_id`, `doc_type`, `uploaded_by`.
- `POST /api/approvals` — JSON { request_id, approved_by, remark } — server enforces 12-document compliance.

Notes

- Audit logs are written by `auditMiddleware` when route handlers call `req.logAction(...)`.
- The schema migration SQL is in `backend/migrations/001_init.sql`.
