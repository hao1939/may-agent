# FlashCart API

E-commerce platform API powering flashcart.io.

## Architecture
- Express.js API with rate limiting middleware
- Auth: bcrypt + JWT (15min expiry)
- Rate limits: per-IP token bucket

## Rate Limits
| Endpoint | Limit |
|----------|-------|
| /auth/* | 5 req/s |
| /admin/* | 20 req/s |  
| /api/* | 100 req/s |

## Recent Issues
- **2026-03-28**: Flash sale — 4,200 users got 429 errors on /auth/login during peak
- **2026-03-15**: Flash sale — 2,800 users got 429 errors
- **2026-02-20**: Normal day — no rate limit issues
- Revenue impact estimated at $180K for the March 28th event

## Security
See `docs/security-audit.md` for the Q1 security assessment.

JIRA-4521: Account lockout feature — **not yet implemented** (scheduled for Q3 2026)
