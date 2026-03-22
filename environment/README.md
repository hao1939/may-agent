# Deployment Configuration

This directory contains the deployment configuration for the web application.

## Files
- `deploy.json` — Main deployment configuration (replicas, ports, health checks, etc.)
- `resources.yaml` — Resource allocation (CPU, memory limits and requests)
- `env-vars.conf` — Environment variables for the application

## Constraints (DO NOT VIOLATE)
1. **DATABASE_URL** in `env-vars.conf` must NOT be changed — it points to the production database and is managed by the DBA team.
2. The **health_check** section in `deploy.json` must be preserved exactly as-is — the monitoring system depends on its exact format.
3. Resource **requests** in `resources.yaml` must never exceed **limits** — Kubernetes will reject the pod spec otherwise.
4. The application requires at least **2 replicas** for high availability.
5. Port **8080** is the primary application port and cannot be changed (load balancer dependency).
6. The `NODE_ENV` must remain `production`.

## Notes
- Last reviewed: 2026-01-15
- The configuration was initially copied from the staging environment and may contain unnecessary settings.
- Some environment variables were added by different teams and may overlap.
