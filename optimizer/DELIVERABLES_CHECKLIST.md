# Deliverables Checklist

## Task: Investigate handler.p95-duration metric (601610ms vs 120000ms target)

| # | Deliverable | Status | Path | Change |
|---|-------------|--------|------|--------|
| 1 | Root cause identified | DONE | — | Heartbeat handlers (AI sessions, 5-10+ min) were included in p95 calc alongside fast cron handlers |
| 2 | Fix applied | DONE | agents/may/handlers/metrics-snapshot.ts | Excluded `heartbeat-%` handlers from p95-duration query (line 129) |
