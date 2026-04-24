# System Design Principles

## Resilience Patterns

1. **Circuit Breaker**: Prevents cascading failures by stopping requests to failing services.
2. **Bulkhead Isolation**: Isolates components so a failure in one doesn't affect others.
3. **Retry with Backoff**: Retries failed operations with increasing delay.
4. **Timeout Cascades**: Set progressively shorter timeouts at each layer to prevent upstream services from waiting indefinitely.

## Observability

- Structured logging should use JSON format
- Metrics should be exposed via /metrics endpoint
- Traces should propagate context across service boundaries

## Data Consistency

When dealing with distributed systems, prefer eventual consistency
over strong consistency unless the domain requires it. Use saga patterns
for multi-step transactions and compensating actions for rollback.

## Error Handling

All errors must be logged with correlation IDs. Unhandled errors should
trigger alerts within 2 minutes. Error responses must never leak internal
implementation details to external callers.

