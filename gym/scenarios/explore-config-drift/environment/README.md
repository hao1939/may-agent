# MicroAuth Service

A microservice handling authentication and user management.

## Configuration

Configuration is loaded from environment-specific files:
- `.env` — default/development settings
- `.env.staging` — staging overrides
- `.env.production` — production overrides (not included in repo)

The service also reads `config/default.json` for non-secret config and `docker-compose.yml` for container settings.

## Architecture

- **Auth Service** (port 3000) — handles login, token refresh, user CRUD
- **Redis** — session store and rate limiting  
- **PostgreSQL** — user data
- **Nginx** — reverse proxy with SSL termination

## Deployment

```bash
# Development
docker-compose up

# Staging  
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up
```

## Known Issues

- Rate limiting occasionally triggers false positives under load
- Session expiry sometimes doesn't propagate to all replicas
