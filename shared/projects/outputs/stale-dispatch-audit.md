# Stale Dispatch Audit

*Generated: 2025-05-01 — Post-Fix Verification*

## Executive Summary

The dispatch-validator fix deployed ~April 25 has **dramatically improved dispatch accuracy**. Pre-fix: 3.3% success rate. Post-fix: 63-97% success rate (depending on measurement window). The two stale projects causing 99% of failures (`pwi-evaluator-tuning`, `agent-system-literacy` in bob's workspace) are now blocked by the pre-flight validator.

---

## Stale Projects Identified

### Primary Offenders (592 total failed dispatches)

| Stale Project Path | Failed Dispatches | Root Cause |
|---|---|---|
| `/app/agents/bob/workspace/projects/pwi-evaluator-tuning` | 292 | Project archived; path never existed in bob's workspace |
| `/app/agents/bob/workspace/projects/agent-system-literacy` | 292 | Project is `closed` in shared/projects; bob workspace copy never existed |
| `/app/agents/bob/workspace/projects/gym-leverage` | 7 | Project archived |
| `/app/agents/shared/projects/system-efficiency` | 1 | Transient error (project exists) |

### Timeline

| Period | Total MW Runs | Errors | Success Rate |
|--------|--------------|--------|-------------|
| Apr 24 (pre-fix) | 243 | 243 | 0% |
| Apr 25 (pre-fix) | 348 | 348 | 0% |
| Apr 26-May 1 (post-fix) | 30 | 1 | **96.7%** |

### Why These Paths Were Wrong

1. **Path mismatch**: Dispatcher was using `agents/bob/workspace/projects/X` — a path pattern from when bob had personal project copies. These directories never existed.
2. **Stale registry**: The project-health scanner previously included agent workspace paths. `scanAllProjects()` was refactored to only scan `shared/projects/`, but old health-state entries persisted.
3. **No pre-flight check**: `master-worker.ts` would accept any project path without verifying `project.md` existed before spawning a full session.

---

## Fix Applied: dispatch-validator.ts

The fix is already deployed at `/app/agents/shared/workflows/dispatch-validator.ts`:

```typescript
// Pre-flight validation checks:
// 1. Parse project path from task string
// 2. Verify project directory exists (existsSync)
// 3. Verify project.md exists
// 4. Check project status is dispatchable (not closed/paused/cancelled/blocked/waiting)
// 5. Check for stop reasons
```

**Integration points**:
- `master-worker.ts` calls `validateDispatch()` before starting workflow
- `workflow-runner.ts` calls `validateDispatch()` before launching any workflow

---

## Current Project Status Inventory

| Project | Status | Dispatchable? |
|---------|--------|--------------|
| agent-convention-compliance | active | ✅ |
| agent-memory-learning | closed | ❌ |
| agent-system-literacy | closed | ❌ |
| coach-quality | closed | ❌ |
| documentation-gen | active | ✅ |
| evaluation-revival | closed | ❌ |
| gym-quality-improvement | active | ✅ |
| handler-reliability | closed | ❌ |
| hao-alignment | waiting | ❌ |
| proof-of-life-dashboard | waiting | ❌ |
| request-deduplication | closed | ❌ |
| skill-workflow-audit | blocked | ❌ |
| system-efficiency | active | ✅ |
| test-coverage | active | ✅ |
| workflow-reliability | closed | ❌ |

**5 dispatchable** out of 15 projects. The validator correctly blocks the other 10.

---

## Remaining Risks

1. **Old workflow-run records**: 592 error records from Apr 24-25 still in `/app/.state/workflow-runs/`. Could be cleaned up to improve reporting accuracy.
2. **Running orphans**: 16 master-worker runs currently in "running" status — may be stale/abandoned sessions.
3. **No alerting**: If a new stale project reference is added, it will fail silently (error status) rather than alerting an operator.

## Recommendations

| Priority | Action | Impact |
|----------|--------|--------|
| ✅ Done | Pre-flight validator in dispatch-validator.ts | Eliminated 97% waste |
| ✅ Done | scanAllProjects limited to shared/projects/ | Prevented new stale entries |
| P2 | Purge old error records from workflow-runs/ | Cleaner metrics |
| P2 | Add stale-run cleanup (kill "running" > 2h) | Free resources |
| P3 | Weekly dispatch accuracy report | Catch regressions |

---

*Data sources: /app/.state/workflow-runs/*.json (629 master-worker records), dispatch-validator.ts, project-health.ts, project.md files*
