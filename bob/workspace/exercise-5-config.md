# Configuration Standards

## Environment Variables

- All secrets must come from environment variables, never config files
- Use `_URL` suffix for connection strings (e.g., `DATABASE_URL`)
- Use `_KEY` suffix for API keys (e.g., `OPENAI_KEY`)

## Feature Flags

Feature flags should be stored in a centralized service.
Local overrides are permitted in development only.
Production feature flags must be auditable and have an owner.

## Timeouts

- HTTP client timeout: 15 seconds
- Database query timeout: 10 seconds  
- Background job timeout: 5 minutes
- WebSocket idle timeout: 60 seconds
