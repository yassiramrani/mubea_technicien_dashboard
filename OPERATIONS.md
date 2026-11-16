# Workshop Tool Tracking operations — 16 November 2026

Scope correction: Anna's SAP/Bluebird feedback concerns this technician dashboard. The local implementation was rejected; PM, Production and IT must assess the supported solution before further rollout. See [the platform assessment](docs/PLATFORM_ASSESSMENT.md). The technical checks below describe existing source verification and do not resolve that decision.

`GET /api/health/live` returns 200 with `{"status":"ok"}` when the Next.js process responds. `GET /api/health/ready` returns 200 only when session signing is configured and a read-only `SELECT 1` succeeds; otherwise it returns 503 with `{"status":"unavailable"}`. Responses use `Cache-Control: no-store` and reveal no records, credentials or error details. Only these exact health paths bypass sign-in. Other API routes keep their existing access checks.

Readiness waits at most five seconds and coalesces probes for five seconds per server instance. A timeout does not cancel an underlying database query; retain appropriate database connection/query timeouts in the operating environment. Monitor liveness and readiness separately; repeated readiness failures should alert the operating owner, not trigger automatic data resets.

Validation: 17 tests passed and production build passed. A read-only ping to the configured Supabase database succeeded. The local preview returned liveness 200 and readiness 503 because its environment has no valid `MUBEA_SESSION_SECRET`. Configure a private random secret of at least 32 characters through the existing deployment settings, never in source or browser variables. No production configuration, schema, roles or data were changed. Production deployment of these source changes has not been verified.

The existing broad section-access policy (`ENFORCE_ROLE_ACCESS=false`) is preserved; profile administration retains its administrator check. A stricter role rollout requires a business decision. Agree monitoring, backup/restore tests, credential rotation and workshop acceptance with the service owner.
