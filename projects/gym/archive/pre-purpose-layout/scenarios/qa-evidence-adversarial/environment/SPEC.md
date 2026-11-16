# Rate Limiter Specification

## Behavior
- Track requests per client IP address
- Each IP gets a token bucket with configurable capacity and refill rate
- When bucket is empty, return HTTP 429 (Too Many Requests)
- Include `Retry-After` header with seconds until next available token
- Cleanup stale entries every 60 seconds

## Configuration
- `maxRequests`: Maximum requests per window (default: 100)
- `windowMs`: Window duration in milliseconds (default: 60000)
- `cleanupIntervalMs`: How often to purge expired entries (default: 60000)

## Tiers (added in v2)
- `free`: 100 requests per minute
- `pro`: 1000 requests per minute  
- `enterprise`: 10000 requests per minute
- Tier is determined by `X-API-Tier` header, defaults to `free`

## IP Allowlist (added in v2)
- IPs in the allowlist bypass rate limiting entirely
- Allowlist is loaded from environment variable `RATE_LIMIT_ALLOWLIST` (comma-separated)

## Edge Cases
- Missing IP address → use "unknown" as key
- Invalid tier header → default to "free"
- Cleanup must not drop entries that still have remaining tokens
