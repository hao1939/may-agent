# EXP-511 Run Plan

**Status**: SCENARIOS CREATED — ready for gym execution
**Date**: 2026-07-03

## Gym Scenarios Created

1. `empty-response-loop-exp511-baseline/` — Arm A (escalating pressure retry)
2. `empty-response-loop-exp511-treatment/` — Arm B (clean-slate retry)

## Retry Logic Audit (from master-worker.ts:517)

Current production retry prompt:
```
🚨 YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES. This is iteration ${iteration} retry.
Your FIRST tool call MUST be write(). Do NOT use read() or bash() first. Do NOT claim files already exist.
Original task:\n${guidance}
```

**Issues identified:**
1. Negative framing ("PRODUCED 0 FILES") anchors failure
2. Multiple constraints ("Do NOT...") add cognitive load
3. "iteration N" signals repeated failure, potentially triggering learned helplessness
4. Original guidance appended at end (buried under noise)

## Proposed Treatment (Arm B)

Strip all failure context. Re-issue clean task with single addition:
```
${guidance}

Start by calling write() to create your first output file.
```

## Implementation Plan

1. ✅ Gym scenarios created for manual/simulated testing
2. ⬜ Run both scenarios 5x each in gym, measure recovery rate
3. ⬜ If treatment shows ≥30pp improvement, implement in master-worker.ts
4. ⬜ Deploy with A/B flag for production measurement
5. ⬜ Write results after n=10 per arm in production

## Metrics to Collect

| Metric | Arm A (baseline) | Arm B (treatment) |
|--------|-------------------|-------------------|
| Recovery rate (file produced) | TBD | TBD |
| Tool calls before first write | TBD | TBD |
| Confusion signals | TBD | TBD |
| Quality score | TBD | TBD |
