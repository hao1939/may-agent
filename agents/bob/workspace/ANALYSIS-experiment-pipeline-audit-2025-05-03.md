# Experiment Pipeline Audit — 2025-05-03

## Finding: Massive Designed-but-Never-Run Backlog

Of 20+ experiments tracked in `agents/shared/knowledge/experiments/`, **10 are stuck in DESIGNED state** with no evidence of execution:

| Experiment | Status | Topic |
|-----------|--------|-------|
| EXP-231 | DESIGNED | (unknown) |
| EXP-246 | DESIGNED | (unknown) |
| EXP-247 | DESIGNED | (unknown) |
| EXP-270 | READY-TO-RUN | Has prompts defined |
| EXP-272 | DESIGNED | (unknown) |
| EXP-273 | DESIGNED | (unknown) |
| EXP-274 | DESIGNED | (unknown) |
| EXP-275 | DESIGNED | (unknown) |
| EXP-276 | DESIGNED | (unknown) |
| EXP-600 | DESIGNED | Threat-framed skill delivery |

### Completed Experiments
- EXP-242: **CONFIRMED** — 44% fix rate vs 0% baseline (p=0.015)
- EXP-243: Phase 0 complete — H-204 refined
- EXP-244: COMPLETE
- EXP-245: COMPLETED — H-245-null supported
- EXP-248: COMPLETE — FALSIFIED
- EXP-188: CONCLUDED — All hints hurt performance (p<0.001)
- EXP-RECOGNITION: COMPLETE

### In Progress
- EXP-267: Has status file, unclear state
- EXP-271: Phase 1 complete
- EXP-511: OPEN

## Root Cause Analysis

1. **Design is cheap, execution is expensive**: Each experiment needs 50+ gym runs (~15 sessions), but sessions are frequently interrupted
2. **Coach bottleneck**: Coach runs most experiments but gets interrupted frequently (EXP-188 had 15+ interrupted sessions)
3. **No experiment triage**: Nobody kills stale experiments. EXP-231 through EXP-276 span a wide range but many may be obsolete
4. **Priority diffusion**: Bob keeps designing new experiments before old ones finish

## Recommendations

### P0: Triage the Backlog
Kill experiments that are >30 days old and still DESIGNED. If nobody ran them, the hypothesis wasn't important enough.

**Candidates to kill**: EXP-231, 246, 247, 272-276 (unless proven relevant)
**Candidates to run**: EXP-270 (already has prompts), EXP-600 (tests a known gap)

### P1: One-at-a-Time Rule
Don't design a new experiment until the current one reaches PHASE-1 or CONCLUDED. This prevents the backlog from growing.

### P2: Execution Time Budget
Each experiment should declare upfront: "This needs N gym runs × M minutes = total budget." If the budget exceeds 2 days of compute, simplify the design.

## Key Insight

The most impactful experiments were simple:
- **EXP-188**: 5 arms × 5 trials = 25 runs. Found that ALL hints hurt (p<0.001). Huge finding.
- **EXP-242**: 26 total runs. Confirmed 44% fix rate. Clear signal.

The stalled experiments likely have overcomplicated designs. Simplify and ship.
