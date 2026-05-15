# Common Sense Infra Review — 2026-07-28 (Session B)

## Findings

### Highest Priority Unbuilt: Evaluator Pipeline (IT-87) — Still Broken

**Root cause identified:** The `session-eval` handler in `agents/may/cron.json` subscribes to `session.completed` events, but these events are never emitted by core infrastructure. Evidence:
- `context-learn-poller` (line 378 of cron.json) explicitly states: "Workaround for missing session.completed event emission."
- Last evaluation output: Apr 20 (`cold-start-fix-eval.md` — trivial). Last real eval: Mar 24.
- The evaluator code itself (`agents/shared/evaluation/evaluator.ts`, 1032 lines) is complete and functional.

**The fix is not rebuilding the evaluator — it's emitting the event.** Somewhere in the session lifecycle (likely `SubagentManager.completeSession` or equivalent), a `session.completed` event needs to be dispatched when a child session finishes.

**Alternatively:** Mirror the `context-learn-poller` pattern — add an `eval-poller` that runs every 30min, finds recently completed sessions with parents that haven't been evaluated, and calls `evaluateTask()` directly. This is the faster fix (no core changes needed).

### Coach Status: No Infra Help Flagged

Coach's `common-sense-status.md` shows active verification of all behavioral items. Key gaps:
- **C1.3 (Verify every write):** 6 consecutive ❌ — 15% compliance. Coach has not escalated for infra help, but an advisory nudge after write() would help.
- **#4 (Verify delegated work):** May at 0/6 due to heartbeat.md instruction conflict. This is a May heartbeat.md edit, not infra.
- **#5 (Claim then act):** QA at 0% narration. Coach issue, not infra.

No new infra help requests from coach in recent sessions.

### C12.1 Convention Checker — Cannot Locate

`agents/may/handlers/convention-check.ts` does not exist (only `session-eval.ts`, `session-recovery.ts`, `context-learn-poller.ts`, `run-workflow.ts`, `escalation.ts` present). Either moved, renamed, or the prior brief referenced a stale path. Not actionable until located.

## Design Brief: Eval-Poller (recommended fix for IT-87)

**Goal:** Restore automated session evaluation without modifying core event emission.

**Approach:** New handler `eval-poller` (or extend `context-learn-poller`):
1. Every 30 min, query `.state/may.db` sessions table for sessions completed in last 35 min that have a `parentSessionId` and no corresponding eval in `.state/evaluations/`.
2. For each, call `evaluateTask({ manager, ctx, parentSessionId })`.
3. Log results; emit `context-learn` event for downstream processing.

**Implementation:** ~40 lines. Copy `context-learn-poller` pattern. Register in `cron.json`.

**Success criteria:**
- `.state/evaluations/` gets new files within 35min of session completion
- Coach can query evaluation results for behavioral verification (closes the loop)

## Ownership Updates

None needed. common-sense.md is unchanged (human-controlled). No recently-built items require ownership transfer.

## Actions

| Priority | Item | Owner | Status |
|----------|------|-------|--------|
| P0 | IT-87: eval-poller (restore evaluations) | tech-lead | **Design ready — implement** |
| P1 | C1.3: write-readback advisory nudge | tech-lead | Design exists, unbuilt |
| P1 | #4: May heartbeat.md §1c amendment | may | Coach recommendation, not infra |
| P2 | IT-86/90: structural enforcement | bob | Deferred |
