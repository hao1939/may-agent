# Investigate Error Reports

Users have reported seeing "Rate limit exceeded" errors in the application logs. Your task is to investigate and fix the issue.

## Context

The application is a simple API server (`server.js`) that processes requests. It has a rate limiter module (`rate-limiter.js`).

**Recent history**: The team recently upgraded the rate limiter to use a sliding window algorithm (see git log for details).

## Available Resources

- `server.js` — the main application
- `rate-limiter.js` — the rate limiting module
- `error-log.db` — SQLite database with error records
- `deploy-log.txt` — deployment timeline
- `git log` — shows recent changes to the codebase
- `test-server.sh` — runs the current server and checks for rate limit errors

## What to Do

1. Investigate the error reports
2. Determine the root cause
3. Fix the issue if one exists
4. Verify your fix works

Write your findings to `investigation-report.md`.
