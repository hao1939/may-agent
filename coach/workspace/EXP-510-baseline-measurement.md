# EXP-510: Worker Task Completion Quality — Baseline Measurement

**Date**: 2026-05-13
**Author**: coach
**Status**: BASELINE COLLECTED

## Method

Audited 40 most recent sessions with ≥8 messages from `.state/sessions/`.
Classified by type (heartbeat, gym, worker/other) and measured:
- Tool call count
- Write/edit count (actual deliverable production)
- finish() usage with status/summary
- Verify-after-write behavior

## Raw Data

| Type | n | With Writes | finish(success) | Avg Tools |
|------|---|------------|-----------------|-----------|
| heartbeat | 10 | 0 (0%) | 0 (0%) | 9.7 |
| gym | 3 | 0 (0%) | 0 (0%) | 14.3 |
| other (worker/orchestrator) | 27 | 10 (37%) | 0 (0%) | 20.6 |

## Key Findings

### 1. finish() is called with EMPTY inputs (0% structured completion)
All 10 finish() calls in sampled sessions had `input: {}` — no status, no summary, no deliverables.
This means **zero structured completion reporting** system-wide.

### 2. Only 37% of work sessions produce writes
Of 27 non-heartbeat/non-gym sessions, only 10 (37%) produced any file writes/edits.
The remaining 63% read and bash only — possibly analysis tasks, but possibly incomplete execution.

### 3. Heartbeat sessions produce 0 writes
Despite MANDATORY ARTIFACT RULE (EXP-475), 0/10 heartbeat sessions had writes.
However, these may use bash to create files (not tracked as write/edit tool calls).

### 4. Verify-after-write remains near 0%
Consistent with KE-480 findings — text coaching is dead for verification behaviors.

## Baseline for EXP-510

For worker/other sessions (n=27):
- **Completion rate (has writes)**: 37% (10/27)
- **Structured finish rate**: 0% (0/27 with finish status+summary)
- **Average tool calls**: 20.6

## Target

- Completion rate: ≥60% (from 37%) — +23pp improvement
- Structured finish rate: ≥50% (from 0%)

## Next Steps

1. Design structural injection in master-worker.ts that:
   a. Appends completion checklist to worker task prompts
   b. Requires finish() with status and summary fields
2. Deploy and measure after 30+ post-deployment sessions

## Note on Data Quality

Session.jsonl format uses `toolCall` type (not `tool_use`). finish() inputs are consistently empty `{}`,
suggesting the infrastructure may not be passing through structured parameters, OR agents are calling
finish() without arguments. Need to verify whether this is an agent behavior issue or infrastructure issue.
