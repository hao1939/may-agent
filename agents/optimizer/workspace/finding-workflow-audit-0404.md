# Finding: Workflow Audit — Most Shared Workflows Are Dead Weight

**Date**: 2026-04-04T08:30
**Author**: Optimizer
**Severity**: HIGH — REGISTRY has fabricated/misattributed usage data

## Summary

Out of 11 shared workflows, **9 have NEVER been used in production** (0 runs). Of the 2 that have been used, `implement-and-review` has a **6% completion rate** (1/16 done, 14 escalated). The REGISTRY's claims of "89% done rate" and "60 code-review-loop runs" are wrong — they misattribute workflow runs.

## Evidence

### Actual workflow usage (from 59 on-disk workflow run files + 180 DB records):

| Workflow | Location | Runs | Done | Escalated | Done% |
|----------|----------|------|------|-----------|-------|
| growth-cycle | coach/workflows/ | 26 | 26 | 0 | **100%** |
| implement-and-review | shared/workflows/ | 16 | 1 | 14 | **6%** |
| skill-lifecycle | shared/workflows/ | 12 | 12 | 0 | **100%** |
| training-sprint | coach/workflows/ | 4 | 4 | 0 | **100%** |
| verified-coder | tech-lead/workflows/ | 1 | 1 | 0 | 100% |

### NEVER used shared workflows (0 runs in entire history):

| Workflow | Lines | Status |
|----------|-------|--------|
| code-review-loop | 134 | **DEAD** — 0 runs ever. Uses `ctx.summarize()` and `var` keyword. |
| two-phase | 192 | **DEAD** — 0 runs ever. Referenced in may's agent.json hint only. |
| verify-and-finish | 272 | **DEAD** — 0 runs ever. Recently consolidated from duplicates. |
| verify-parallel | 343 | **DEAD** — 0 runs ever. Recently consolidated from duplicates. |
| evidence-gate | 217 | **DEAD** — 0 runs ever. Has gym scenarios but never used in production. |
| predict-then-verify | 221 | **DEAD** — 0 runs ever. |
| reviewed-delivery | 89 | **DEAD** — 0 runs ever. |
| context-learn | 276 | **MISLEADING** — the src/lib/context-learn.ts module is used, but the workflow file is not. |
| gated-exploration | 329 | **DEAD** — 0 runs ever. |

### REGISTRY errors identified:

1. **"60 code-review-loop runs"** — FALSE. These are actually 60 workflow runs with coder+qa sessions, which are `implement-and-review` runs. `code-review-loop` has 0 runs.
2. **"65 two-phase (coach) runs"** — FALSE. These are `growth-cycle` and `training-sprint` runs. `two-phase` workflow has 0 runs.
3. **"89% done rate for workflow sessions"** — MISLEADING. This counts sub-sessions (464 sessions in 180 runs). Individual sessions complete, but the *runs* are: growth-cycle 100%, implement-and-review 6%, skill-lifecycle 100%.
4. **"97% completion for code-review-loop"** — FABRICATED. Workflow has never run.

### Why `implement-and-review` fails (14/16 escalated):

The `getVerdict()` function defaults to "fail" when QA doesn't use the exact `### Verdict\n**PASS**` format. QA often writes more nuanced verdicts that don't match. Combined with the `isCriticalRejection` check (which matches broad terms like "contradicts"), virtually all runs escalate.

### Why 9 workflows have never been used:

Workflows are only invoked when an LLM explicitly calls `workflow.run("name", task)`. No handler or cron job references these workflows. They rely entirely on agent spontaneous adoption — which never happens because:
1. Agents have no incentive to use them
2. Agents don't know they exist (not in SOUL.md or context files)
3. The `workflow` tool lists them, but agents rarely call `workflow list`

## Recommendations

### Immediate: Correct the REGISTRY
- Remove fabricated usage data
- Report actual run counts from workflow run files

### Short-term: Delete dead workflows or wire them up
- **Option A (clean)**: Delete the 9 unused workflows. They add cognitive load and maintenance burden for zero value.
- **Option B (activate)**: Wire workflows into handlers/cron jobs so they're actually invoked. But this requires code changes to the system.

### Fix implement-and-review:
1. Fix `getVerdict()` to be more lenient (treat ambiguous as conditional pass, not fail)
2. Reduce `isCriticalRejection` scope — "contradicts" is too broad
3. Consider: if all 4 steps complete without error, that's good enough

### Preserve what works:
- `growth-cycle` and `skill-lifecycle` are excellent (100% done rate)
- `training-sprint` works well when it runs
- These are all **coach-specific** — the coaching pipeline is the system's best-engineered workflow infrastructure

## Impact

- **9 dead workflow files** = 2,224 lines of unmaintained code
- **Misleading REGISTRY** → bad decisions about what to consolidate/improve
- **6% implement-and-review done rate** → tech-lead code pipeline broken since it was deployed
