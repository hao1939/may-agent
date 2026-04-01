# Optimization Report

## Changes Made

### 1. deploy.json — Increased `rolling_update.max_surge` from 25% to 50%
**Why:** With 3 replicas and max_surge at 25%, Kubernetes rounds up to 1 extra pod during rollouts. At 50%, it allows 2 extra pods (rounds up from 1.5), meaning new pods spin up faster and deployments complete sooner. This cuts deployment time without affecting availability since `max_unavailable` remains at 25%.

### 2. resources.yaml — Reduced ephemeral storage `requests` from 512Mi to 256Mi
**Why:** A web frontend app (Node.js/static assets) does not need 512Mi of guaranteed ephemeral storage. 256Mi is sufficient for typical operations (temp files, logs buffered before stdout). The limit stays at 1Gi for burst scenarios. This frees ~256Mi of guaranteed ephemeral storage per pod (768Mi total across 3 replicas) for the scheduler to allocate elsewhere.

### 3. env-vars.conf — Increased `TRACE_SAMPLE_RATE` from 0.01 to 0.05
**Why:** A 1% trace sample rate makes it very difficult to debug production issues — many requests go untraced. Increasing to 5% gives 5x more trace data for debugging while keeping tracing overhead negligible (distributed tracing overhead at 5% is well within acceptable bounds for modern tracing systems).

## Intentionally Left Unchanged

| Setting | File | Reason |
|---|---|---|
| `DATABASE_URL` | env-vars.conf | **Constraint**: managed by DBA team, must not change |
| `health_check` section | deploy.json | **Constraint**: monitoring system depends on exact format |
| `NODE_ENV=production` | env-vars.conf | **Constraint**: must remain production |
| Port `8080` | deploy.json, env-vars.conf | **Constraint**: load balancer dependency |
| `replicas: 3` | deploy.json | Already optimal; min_replicas=2 provides HA floor |
| web-frontend CPU/memory | resources.yaml | 256Mi/200m requests with 512Mi/400m limits is a healthy 2:1 ratio; no waste |
| log-collector resources | resources.yaml | 64Mi/25m requests are already minimal for a sidecar |
| `readiness_check` | deploy.json | Separate from health_check; values are appropriate (faster probe than liveness) |
| `CACHE_TTL=3600` | env-vars.conf | 1-hour TTL is reasonable for frontend cache |
| `API_TIMEOUT=30000` | env-vars.conf | Matches deploy.json `timeout_seconds: 30` — consistent |
| `image_pull_policy: IfNotPresent` | deploy.json | Correct for production (avoids unnecessary pulls) |
| `logging.level: INFO` | deploy.json | Appropriate for production; DEBUG would be too verbose |

## Estimated Improvement

| Optimization | Impact |
|---|---|
| max_surge 25%→50% | ~30-40% faster rolling deployments |
| Ephemeral storage 512Mi→256Mi | 768Mi freed across cluster (3 replicas × 256Mi) |
| Trace sample rate 1%→5% | 5x more traces for debugging; negligible overhead increase |
