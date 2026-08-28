# Firebase Hosting + Cloud Run + Cloud SQL deployment

This project is deployed as:

`Firebase Hosting` → `/api/**` rewrite → `Cloud Run (procurement-api)` → `Cloud SQL for MySQL`

## Before deploying

1. Select the Firebase/Google Cloud project and enable billing.
2. Enable the Cloud Run, Cloud SQL Admin, Artifact Registry, and Secret Manager APIs.
3. Create a Cloud SQL for MySQL instance, database `saint_bernard_procurement`, and a least-privilege database user.
4. Import `backend/migrations/001_init.sql` into the new database. Alternatively, for a brand-new empty database only, set `DB_SYNC=true` on the first Cloud Run revision, then turn it off after the schema is created.
5. Store the database password in Secret Manager. Do not use `backend/lgu-system-*-firebase-adminsdk-*.json` in a deployment.

## Deploy the API

Replace the capitalized placeholders. Use the same region for Cloud Run and Cloud SQL.

```powershell
gcloud config set project PROJECT_ID
gcloud secrets create procurement-db-password --replication-policy=automatic
gcloud secrets versions add procurement-db-password --data-file=PATH_TO_PASSWORD_FILE

gcloud run deploy procurement-api --source backend --region us-central1 --allow-unauthenticated --add-cloudsql-instances PROJECT_ID:us-central1:INSTANCE_ID --set-env-vars DB_NAME=saint_bernard_procurement,DB_USER=app_user,DB_POOL_MAX=5,INSTANCE_UNIX_SOCKET=/cloudsql/PROJECT_ID:us-central1:INSTANCE_ID --set-secrets DB_PASS=procurement-db-password:latest
```

Grant the Cloud Run runtime service account the `Cloud SQL Client` role. It also needs access to the database-password secret (`Secret Manager Secret Accessor`). Firebase Admin uses the Cloud Run service account automatically; grant it only the Firebase permissions the API needs.

## Deploy the frontend

Build and deploy from the repository root:

```powershell
npm run build
firebase use PROJECT_ID
firebase deploy --only hosting
```

The Hosting configuration expects the Cloud Run service name `procurement-api` in `us-central1`. Change both values in `firebase.json` if you use another name or region.

## Important limitation: uploads

The existing upload routes write to the container filesystem. Cloud Run filesystem storage is temporary, so uploaded documents, avatars, and seals will not be durable in production. Move them to Cloud Storage before relying on production uploads; keep only object URLs/metadata in MySQL.
