# Unreviewed findings (qa heartbeat)

## Inbox triage (agent.notification)
- Duplicate “Quick Code Review” waste alerts: **DISMISSED** as stale/duplicate notifications (no active review requests found in this heartbeat).
- Convention coaching (C8.2 no finish call, C1.4 last tool call must be finish): **ACT** — I am calling `finish()` at the end of this heartbeat and documenting environment constraints.
- Verify new gym scenario EXP-220 (enoent-file-search): **ACT (partial)** — not enough context in inbox payload to verify; needs scenario path/id.

## Repo verification sweep
### Recent changes
- Latest commit in `/app/agents`: `3ac015038` modifies `agents/scout/last-session.md`.

### Read
- `agents/scout/last-session.md` contains a generic statement “File looks correct and complete.” (No actionable evidence.)

### Tooling checks
- `tsc --noEmit` in `/app/agents`: PASS.
- `vitest --run` in `/app/agents`: FAIL — vitest binary missing (not installed in deps).

## Follow-ups
- If this repo expects vitest-based testing, add `vitest` to devDependencies or document the intended test runner.
- Provide the exact EXP-220 scenario file path so QA can verify it exists and is wired correctly.
