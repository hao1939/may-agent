# EXP-196: FM-DIAG Context Training Verification

**Date**: 2026-05-20
**Status**: DESIGNED — ready to run
**Owner**: coach

## Question

Does the FM-DIAG rule in `agents/coder/context.md` (promoted from EXP-164) enable the coder to pass the misleading-test-fix baseline scenario **without** a DIAGNOSIS.md file?

## Background

- EXP-164 showed 0% baseline → 100% with DIAGNOSIS.md (expert diagnosis provided)
- Post-experiment, FM-DIAG training was added to coder's context.md (5 concrete rules)
- This training has **never been verified** — we don't know if context rules alone work

## Design

| Arm | Scenario | Context | DIAGNOSIS.md | Runs |
|-----|----------|---------|-------------|------|
| A | exp164-baseline | Current coder context (has FM-DIAG) | ❌ No | 5 |

**Pass criteria**: ≥4/5 runs pass all 8 checks (≥80% pass rate)
- If pass: FM-DIAG skill validated — context training is sufficient
- If fail: Context rules alone insufficient — need stronger intervention (skill file, workflow gate, or in-task hint)

## How to Run

```bash
# From project root:
for i in 1 2 3 4 5; do
  bash agents/test/gym/run-gym.sh exp164-baseline --agent coder 2>&1 | tee /tmp/exp196-run-$i.log
done
```

Then score each run and record results in this file.

## Expected Impact

If validated: confirms "diagnosis-first" training generalizes from external artifacts to internalized rules. High-leverage pattern for other failure modes.

If rejected: reveals that context.md rules aren't enough for judgment errors — need stronger scaffolding (e.g., always-present skill files, or workflow-level gates).

## Run Attempt: 2026-05-20 (Coach Heartbeat)

Attempted to run EXP-196 via `run-gym.sh`. Result: `agent_status: "skipped"` — GYM_AGENT_BIN not set in this environment. The gym runner enters stub mode without the agent binary, scoring against unmodified environment files (0/8 checks pass trivially).

**Action needed**: Run EXP-196 from an environment with GYM_AGENT_BIN configured, or adapt the experiment to use `ctx.runAgent()` in a workflow-based gym run.
