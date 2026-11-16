# API Reference

## Authentication

All API endpoints require authentication via JWT bearer tokens.

```
Authorization: Bearer <token>
```

Tokens must be obtained from the identity provider at `/auth/token`.
Tokens expire after 24 hours.

## Endpoints

### GET /api/metrics/:name

Returns the current value of a named metric.

**Parameters:**
- `name` (path) — Metric name (e.g., `page_views`, `active_users`)

**Query Parameters:**
- `granularity` (optional) — Time granularity: `1m`, `5m`, `1h`, `1d`. Default: `1m`

**Response:**
```json
{
  "metric": "page_views",
  "value": 1523,
  "timestamp": "2024-01-15T10:30:00Z",
  "granularity": "1m"
}
```

**Status Codes:**
- 200: Success
- 401: Unauthorized
- 404: Metric not found
- 429: Rate limited
- 500: Internal server error

### GET /api/metrics/:name/history

Returns time series data for a named metric.

**Parameters:**
- `name` (path) — Metric name

**Query Parameters:**
- `start` (required) — Start timestamp (ISO 8601)
- `end` (required) — End timestamp (ISO 8601)
- `granularity` (optional) — Time granularity. Default: auto-selected based on range

**Response:**
```json
{
  "metric": "page_views",
  "granularity": "5m",
  "data": [
    { "timestamp": "2024-01-15T10:00:00Z", "value": 1523, "count": 45 },
    { "timestamp": "2024-01-15T10:05:00Z", "value": 1687, "count": 52 },
    { "timestamp": "2024-01-15T10:10:00Z", "value": 1401, "count": 38 }
  ]
}
```

**Notes:**
- Maximum range: 30 days
- Data is served from cache when available (TTL varies by granularity)
- Large ranges may take longer as they require database queries

### GET /api/dashboard/summary

Returns a pre-computed dashboard summary with key metrics.

**Response:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "metrics": {
    "active_users": { "current": 4521, "change_pct": 12.3 },
    "page_views": { "current": 15234, "change_pct": -2.1 },
    "events_per_second": { "current": 253, "change_pct": 5.7 },
    "error_rate": { "current": 0.02, "change_pct": -15.0 },
    "avg_response_time_ms": { "current": 45, "change_pct": -8.3 }
  },
  "alerts": []
}
```

**Notes:**
- Summary is cached with a 30-second TTL
- `change_pct` is compared to the same time yesterday

### POST /api/events

Submit one or more analytics events.

**Request Body:**
```json
{
  "events": [
    {
      "type": "page_view",
      "properties": {
        "page": "/dashboard",
        "user_id": "u_12345",
        "session_id": "s_abc123"
      },
      "timestamp": "2024-01-15T10:30:15Z"
    }
  ]
}
```

**Validation Rules:**
- Maximum 100 events per request
- Each event must have `type` (string, max 100 chars)
- `properties` must be a JSON object (max 10KB)
- `timestamp` is optional (defaults to server time)
- Duplicate event IDs within a 1-hour window are silently dropped

**Response:**
```json
{
  "accepted": 1,
  "rejected": 0,
  "errors": []
}
```

### GET /health

Health check endpoint. No authentication required.

**Response:**
```json
{
  "status": "ok",
  "uptime": 3600
}
```

### GET /health/ready

Readiness check. Verifies connectivity to Redis and PostgreSQL.

**Response:**
```json
{
  "status": "ready",
  "checks": {
    "redis": "connected",
    "postgres": "connected"
  }
}
```

## Rate Limiting

All authenticated endpoints are rate-limited per user:
- 100 requests per minute per user
- 20 requests per second burst
- Rate limit state is stored in Redis

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705312260
```

When rate limited, the API returns 429 with a `Retry-After` header.

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please retry after 30 seconds.",
    "details": {}
  }
}
```

**Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid JWT token |
| FORBIDDEN | 403 | Valid token but insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 422 | Request body failed validation |
| RATE_LIMITED | 429 | Rate limit exceeded |
| INTERNAL_ERROR | 500 | Unexpected server error |

## Webhooks

The service supports webhook notifications for alert conditions.
Configure webhooks via the admin API (not documented here).

Webhook payload format:
```json
{
  "alert_id": "alert_001",
  "metric": "error_rate",
  "condition": "above_threshold",
  "threshold": 0.05,
  "current_value": 0.08,
  "triggered_at": "2024-01-15T10:30:00Z"
}
```

## SDK Usage Examples

### JavaScript

```javascript
const ADS = require('ads-client');

const client = new ADS({
  baseUrl: 'https://analytics.example.com',
  token: 'your-jwt-token'
});

// Get current metric
const metric = await client.metrics.get('page_views');
console.log(metric.value);

// Get time series
const history = await client.metrics.history('page_views', {
  start: '2024-01-15T00:00:00Z',
  end: '2024-01-15T23:59:59Z',
  granularity: '1h'
});

// Submit events
await client.events.track([
  { type: 'page_view', properties: { page: '/home' } }
]);
```

### Python

```python
from ads_client import ADSClient

client = ADSClient(
    base_url='https://analytics.example.com',
    token='your-jwt-token'
)

# Get current metric
metric = client.metrics.get('page_views')
print(metric['value'])

# Submit events
client.events.track([
    {'type': 'page_view', 'properties': {'page': '/home'}}
])
```

### cURL

```bash
# Get metric
curl -H "Authorization: Bearer $TOKEN" \
  https://analytics.example.com/api/metrics/page_views

# Submit event
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"page_view","properties":{"page":"/home"}}]}' \
  https://analytics.example.com/api/events
```
