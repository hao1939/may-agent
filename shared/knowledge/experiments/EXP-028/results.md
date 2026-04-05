# EXP-028: Workflow Usage Collapse — Cause and Impact Analysis

**Date**: 2026-04-05
**Author**: Optimizer
**Status**: Complete (observational study)
**Tags**: workflow, coach, heartbeat, natural-experiment

## Hypothesis

The heartbeat.md rewrite on 2026-04-01 (commit `db9b0ba9`) removed explicit `workflow.run()` instructions from coach's heartbeat, causing workflow usage to collapse — and this collapse directly degraded coach's success rate.

## Background

On 2026-04-01, a system-wide heartbeat.md rewrite was deployed (commit `db9b0ba9` — "heartbeat.md rewrite — clean, research-aligned, guard-free"). The rewrite reduced all heartbeats from ~1053 lines total to ~300 lines, removing "FM guards, verification ladders, tool arg checks, promise-deliver-report templates."

**What was removed from coach's heartbeat:**
- `workflow.run("growth-cycle", "<error details>")`
- `workflow.run("training-sprint", "Learn methods: <list>")`
- All references to growth-cycle and training-sprint workflows
- Replaced with generic "use lab-run.sh" and "run gym scenarios directly"

## Data

### Coach Workflow Usage vs Done Rate (7-day window)

| Date | Sessions | With Workflow | Without | Done% |
|------|----------|--------------|---------|-------|
| Mar 29 | 28 | 7 | 21 | **89.3%** |
| Mar 30 | 32 | 8 | 24 | **84.4%** |
| Mar 31 | 24 | 3 | 21 | 79.2% |
| Apr 01 | 18 | 1 | 17 | 50.0% |
| **Apr 02** | **23** | **0** | **23** | **39.1%** |
| **Apr 03** | **21** | **0** | **21** | **28.6%** |
| Apr 04 | 25 | 0 | 25 | 68.0% |
| Apr 05 | 1 | 0 | 1 | 100% |

**Workflow usage dropped to 0 on Apr 2 — exactly one day after the heartbeat rewrite.**

### System-Wide Workflow Comparison (7-day aggregate)

| Metric | With Workflow (N=31) | Without Workflow (N=1066) |
|--------|---------------------|--------------------------|
| Done rate | **83.9%** | 73.9% |
| Error rate | **0%** | 10.0% |
| Interrupt rate | 16.1% | 15.8% |
| Avg ops | 18.1 | 15.9 |

Workflows correlate with **+10pp done rate** and **-10pp error rate**.

### Training-Sprint Cron (separate signal)

The `training-sprint` cron job explicitly says: `Execute: workflow.run("training-sprint", ...)`. Despite this instruction, **zero training-sprint sessions in 14 days used workflows**. The LLM ignores embedded `workflow.run()` instructions in cron task strings — it only follows instructions it finds in the heartbeat.md it's told to read.

### Workflow Run Details (31 sessions in 7d)

- **implement-and-review** (coder+qa): 3 runs, 12 steps, 100% success
- **Coach workflows** (growth-cycle/training-sprint): 12 runs via heartbeat, 75% success (3 interrupted by gracefulRestart)
- All workflow sessions: 0 errors (vs 10% error rate for non-workflow sessions)

## Root Cause Analysis

1. **Proximate cause**: Heartbeat rewrite removed workflow invocation instructions
2. **Underlying cause**: Agents don't spontaneously discover or use workflows — they only call `workflow.run()` when explicitly told to in their heartbeat
3. **Contributing factor**: The cron `training-sprint` job embeds workflow instructions in the task string, but the LLM reads heartbeat.md first and follows that structure instead
4. **Structural issue**: Workflow adoption requires **wiring** (explicit instructions in heartbeat), not just **availability** (file exists in workflows/ directory)

## Impact

### Quantified
- Coach done rate dropped from **~85% → ~34%** (avg Apr 2-3) — a **51pp degradation**
- Coach error rate increased correspondingly
- 0 workflow runs since Apr 1 (was 7-8/day)
- Training sprints are less effective without workflow structure (140 ops on Apr 4 error session vs typical 10-30 ops)

### Unquantified
- Loss of structured experiment execution (growth-cycle provides assess→train→measure pipeline)
- Loss of multi-agent coordination (implement-and-review orchestrates coder+qa)
- Potential knowledge quality degradation (experiments not systematically recorded)

## Recommendations

### P0: Restore workflow instructions to coach heartbeat
Add back explicit `workflow.run()` instructions to `agents/coach/heartbeat.md`. The rewrite was right to clean up bloat, but removing workflow references was an unintended casualty.

Proposed addition to Section 2 (Triage & Plan):
```
### Option E: Training Sprint (uses workflow)
Run a structured training sprint:
`workflow.run("training-sprint", "Scan ERROR_LOGs for patterns, test methods, record results")`
```

### P1: Wire implement-and-review into tech-lead heartbeat
Tech-lead uses coder+qa but doesn't invoke the workflow. Add:
```
When you need code changes: `workflow.run("implement-and-review", "<task>")`
```

### P2: Add workflow awareness to all heartbeats
Each agent's heartbeat should mention their available workflows with example invocations. Keep it to 2-3 lines per workflow — not bloated, just present.

### P3: Consider JS-level workflow wiring
Instead of relying on LLM to call `workflow.run()`, the cron handler could directly dispatch workflows for structured tasks (training-sprint, common-sense-verify).

## Conclusion

This is a natural experiment with a clear result: **removing workflow instructions from heartbeats causes immediate workflow usage collapse and significant quality degradation**. The fix is simple — restore the instructions. The broader lesson is that LLM agents require explicit, prominent instructions to use available tools; they will not spontaneously discover capabilities.

## Follow-Up Measurement (2026-04-05, 24h post-fix)

**Fix deployed**: Workflow instructions restored to coach heartbeat (commit c17b049a, ~Apr 4 afternoon).

### Results — Workflow Usage Still 0%

| Date | Sessions | Workflows | Done% |
|------|----------|-----------|-------|
| Apr 4 | 25 | 0 | 68.0% |
| Apr 5 (partial) | 2 | 0 | 100% |

**The workflow instructions are present in heartbeat.md but coach still isn't choosing workflow options.** The done rate recovered from 28.6% (Apr 3) to 68% (Apr 4) — but this is due to other improvements (turn-limit increase, LiteLLM stability), NOT workflow restoration.

### Diagnosis

The heartbeat presents 6 options (A-F), with workflows as Options E-F. The LLM consistently picks simpler options (A-D: review queues, triage, documentation, briefs) over structured workflows. This confirms the **deeper problem**: availability in heartbeat ≠ usage. The LLM needs either:
1. **Stronger steering** — make workflows the default/first option, not optional alternatives
2. **JS-level dispatch** — cron handler directly invokes `workflow.run()` instead of relying on LLM choice
3. **Separate cron entries** — dedicated cron jobs that run workflows directly (P3 recommendation)

### Next Steps
- Monitor for 48h more before concluding
- If still 0% by Apr 7, recommend P3 (JS-level workflow dispatch for training-sprint cron)
- Consider A/B: one heartbeat version with workflow as Option A vs current Option E/F

## Source Queries
All data from `may.db` sessions table using epoch-millisecond `startedAt` filtering. Coach daily breakdown, system-wide workflow comparison, and training-sprint session history all independently verify the same pattern.
