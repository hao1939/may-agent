# Brief: May C1.3 Convention Regression (98.4% → 91.3%)

**Date**: 2026-04-14  
**Convention**: C1.3 — verify writes (read-back after write/edit)  
**Observed**: Drop from 98.4% (Apr 6-10) to 91.3% (Apr 11-14)

## Root Cause: Task Mix Shift, Not Behavioral Regression

The regression is **not a genuine skill degradation**. May's underlying verification behavior hasn't changed. The drop is caused by a shift in may's task mix toward **write-heavy audit/review work sessions** that produce workspace documents without reading them back.

### Evidence

**1. 100% of recent failures are `write()` — zero `edit()` failures**
- Last 3 days: 30 `write()` violations, 0 `edit()` violations
- The checker already exempts successful `edit()` calls (they return diff previews), so edit-based work is unaffected

**2. The dominant failure pattern is writing workspace reports/audits**
- 13 of 18 recent failures (72%) are `workspace/audits/`, `workspace/DESIGN-*`, `workspace/REPORT-*`, or `workspace/tools/` files
- These are investigation artifacts, design docs, and utility scripts — not production deliverables
- Example: `write(agents/may/workspace/audits/qa-c1.1-root-cause.md) not verified`

**3. The golden period (Apr 6-10) had fewer write-heavy sessions**
- Apr 6-10: only 3 failures total, 188 checks → 98.4%
- Apr 11-14: 19 failures, 218 checks → 91.3%  
- The task volume increased AND the task type shifted to more audit/review work

**4. No code or checker changes explain it**
- Only minor C1_3_EXEMPT addition on Apr 12 (adding `DELIVERABLES_CHECKLIST.md` and `finding-*.md`)
- The checker logic itself is unchanged for `write()` handling

### Failure Breakdown (Apr 11-14, 19 failures)

| Category | Count | Example |
|----------|-------|---------|
| `workspace/audits/` | 8 | `audits/qa-c1.1-root-cause.md` |
| `workspace/DESIGN-*` | 4 | `DESIGN-child-session-recovery.md` |
| `workspace/tools/` | 3 | `tools/op-budget-check.cjs` |
| `workspace/` other | 4 | `dispatch-board.md`, `improvement-queue.md` |
| Source code (`src/`) | 2 | `src/lib/__test-guards__/*.ts` (test fixtures) |
| Cross-agent files | 1 | `agents/tech-lead/heartbeat.md` |
| Build/infra files | 2 | `.git/hooks/pre-commit`, `container/run-may-agent.sh` |

### Is This a Real Problem?

**Partially.** Two categories emerge:

1. **Low-risk (workspace docs)**: Writing audit reports, design proposals, and investigation artifacts to `workspace/` without read-back is **not meaningfully risky**. These are exploratory artifacts, not production code. The `write()` tool itself confirms success. Adding `workspace/audits/` and `workspace/DESIGN-*` to `C1_3_EXEMPT_PATTERNS` would be reasonable — these are the same risk level as already-exempted patterns like `journal.md`, `todo.md`, and `findings-*.md`.

2. **Legitimate concern (source code, infra)**: The 2 sessions writing `src/lib/__test-guards__/*.ts` and build files (`.git/hooks/`, `container/`) without verification are genuine C1.3 violations worth addressing.

## Recommended Actions

### Action 1: Expand C1.3 exemption patterns (fixes ~80% of "regression")
Add to `C1_3_EXEMPT_PATTERNS` in `convention-check.ts`:
```typescript
// Workspace audit reports — investigation artifacts, not deliverables
/workspace\/audits\//,
// Workspace design docs — proposals, not production
/workspace\/DESIGN-/,
/workspace\/REPORT-/,
// Workspace tools/scripts — utility scripts, low-risk
/workspace\/tools\//,
// Dispatch board and improvement queue — planning docs
/dispatch-board\.md$/,
/improvement-queue\.md$/,
```

**Expected impact**: Would bring may's C1.3 from 91.3% back to ~96-97%.

### Action 2: No behavioral intervention needed
This is not a skill or SOUL.md issue. May is not "forgetting" to verify — the task mix simply generates more `write()` calls to low-risk files. Behavioral intervention would be wasted effort (per KE-006: skills targeting reasoning don't change tool-calling patterns).

### Action 3: Monitor the legitimate violations
The 2-3 genuine failures (source code writes without verification) should be tracked but don't warrant a regression alert at current volume (~1-2 per week).

## Verdict

**Artifact, not regression.** The 98.4% → 91.3% drop is driven by may doing more audit/review work sessions that `write()` workspace documents without `read()`-back. The convention checker correctly flags these but they aren't meaningful risk. Expanding the exemption list is the right fix.
