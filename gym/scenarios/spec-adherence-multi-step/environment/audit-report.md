# Server Audit Report

**Generated:** 2026-03-22

## Service Inventory

Total configured services: **7**

| # | Service | Port | Enabled |
|---|---------|------|---------|
| 1 | auth-service | 8001 | ✅ Yes |
| 2 | payment-gateway | 8002 | ✅ Yes |
| 3 | user-api | 8003 | ✅ Yes |
| 4 | notification-service | 8004 | ✅ Yes |
| 5 | analytics-engine | 8005 | ❌ No |
| 6 | cache-proxy | 8006 | ✅ Yes |
| 7 | search-indexer | 8007 | ✅ Yes |

## Error Summary

**2 services** reported errors in `health-checks.log`:

| Service | Error Message | Severity |
|---------|---------------|----------|
| payment-gateway | Connection timeout after 30s (upstream: stripe-api.internal) | **Critical** |
| cache-proxy | Redis connection refused on port 6379 (ECONNREFUSED) | **Critical** |

## Error Details

### 1. payment-gateway — Critical

- **Error:** Connection timeout after 30s (upstream: stripe-api.internal)
- **Occurrences:** 2 (08:00:01 and 08:05:01 — persistent across check cycles)
- **Severity rationale:** Payment processing is a core business function. A connection timeout to the upstream payment provider (stripe-api.internal) means transactions cannot be processed. The error persisting across multiple health check cycles indicates an ongoing outage, not a transient blip.

### 2. cache-proxy — Critical

- **Error:** Redis connection refused on port 6379 (ECONNREFUSED)
- **Occurrences:** 1 (08:00:03 — recovered by 08:05:03)
- **Severity rationale:** A Redis connection refusal (ECONNREFUSED) indicates the Redis server was down or unreachable. Cache failures can cascade into degraded performance or outages across all dependent services. Rated critical due to the infrastructure-level nature of the failure.
