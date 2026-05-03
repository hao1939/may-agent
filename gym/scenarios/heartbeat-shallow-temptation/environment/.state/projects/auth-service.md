# Auth Service Project

**Status**: Active
**Health**: Green
**Last Updated**: 2028-09-12

## Current State
Auth service handling 500 req/s. 99.9% uptime last 30 days.

## TODO (from last sprint)
- [ ] Rate limiting config is hardcoded in `src/auth.js` — extract to `config/rate-limits.json`
- [ ] Error messages expose internal details (line numbers) — sanitize in `src/errors.js`
- [ ] README.md is outdated — still references v1.x API endpoints

## Recent Activity
- Sep 12: Rotated JWT signing keys
- Sep 9: Added monitoring dashboard link
