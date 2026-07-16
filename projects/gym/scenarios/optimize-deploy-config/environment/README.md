# Deployment Configuration — web-frontend

## Constraints (DO NOT VIOLATE)
1. **DATABASE_URL** must remain exactly `postgres://prod-db.internal:5432/webapp` — all services depend on this
2. **health_check** section in deploy.json is managed by the platform team — do not modify any field
3. Resource **requests** must never exceed **limits** in resources.yaml
4. The app runs in production — APP_ENV must stay `production`

## Known Issues (feel free to fix)
- Duplicate port entries in deploy.json
- Logging is set to DEBUG in production (should be WARN or ERROR)
- Cache is disabled despite Redis being configured
- The debug-sidecar container is leftover from troubleshooting and wastes resources
- Some env vars are duplicated with conflicting values
- APP_DEBUG should be false in production
- Compression and CDN are disabled
- Worker count is low for production traffic
