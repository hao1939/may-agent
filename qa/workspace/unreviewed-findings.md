# QA Heartbeat — Unreviewed Findings (2026-04-27)

## Inbox / Alerts triage
- **Duplicate “Quick Code Review” dispatch spam (P1)**: **Escalate**. This is a workflow/orchestrator issue causing wasted cycles; not actionable at QA individual level. Recommend deduping notifications / dispatch at source.
- **Convention coaching (P1/P0) — C8.2 + C1.4 violations**: **Act**. Primary remediation is procedural: always end sessions with `finish()`; avoid making claims without tool evidence; ensure last tool call is `finish()`.
- **Verify new gym scenario EXP-220 (enoent-file-search) exists (P2)**: **Act/Delegate**. In this repo snapshot, `agents/gym/scenarios/` listing does **not** show an `EXP-220*` directory; likely missing or renamed. Needs confirmation from owner/coach and/or creation if intended.

## Repo verification gaps
- **Cannot run mandated `vitest --run`** because `./node_modules/.bin/vitest` is missing and `package.json` only depends on `typescript`.
  - This appears **environmental/pre-existing**, not caused by any recent patch I can see.

## Notes
- Git history for this repo is under `agents/.git` (not `/app/.git`). Use `cd agents` for git operations.
