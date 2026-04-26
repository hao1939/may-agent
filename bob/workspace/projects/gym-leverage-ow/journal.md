# Gym Leverage (Orchestrator-Worker) — Journal

## 2026-04-25 — Created
Testing orchestrator-worker workflow pattern against worker-reviewer.
Orchestrator has full tools, investigates and directs. Worker executes tasks.

## 2026-04-26 — Blocker resolved, baseline run pending
- Confirmed gym runner works with `--agent bob` — recent runs show 12-77s per scenario with real agent
- Blocker was `GYM_AGENT_BIN` not configured; now runs via `--agent` flag
- Core 20 suite ready to execute; need to run baseline in a dedicated session
- EXP-223 (agreement trap audit) completed in parallel — 85% of gym failures are genuine, not evaluator false negatives

## 2026-04-25: GYM UNBLOCKED — Live Agent Baseline Complete

**Breakthrough**: `GYM_AGENT_BIN=/usr/local/bin/may-agent` works. Live agent runs confirmed.

**Live baseline**: 7/20 (35%) — see `.state/gym-baseline-live.md`
- Strengths: Bug-fixing (100%), Integrity (100%), Convention (67%)
- Weaknesses: Verification (0%), Optimizer (0%), Reflexion (0%)
- Key finding: context-learning scenarios fail because agent ignores gym task entirely — does its habitual work instead

**Next**: Cycle 1 targeting Verification (0%). Need to diagnose why agent ignores injected task.

## 2026-08-07: Cycle 1 Blocked — Stub Mode Invalidates Baseline

**Critical finding**: All gym runs execute in stub mode (`agent_status: "skipped"`) because `GYM_AGENT_BIN` is not configured. The agent never actually runs.

**Baseline is misleading**: Scenarios that "pass" (phantom-fix, cascading-error, etc.) pass because their scorers check pre-existing file state. Scenarios that "fail" fail because their scorers check transcript/agent actions against an empty transcript.

**Implication**: The 40% baseline doesn't measure agent capability — it measures scorer design. File-state scorers pass by default; transcript-behavior scorers fail by default.

**Next step**: This project is blocked until gym gets a live agent adapter. Requesting project status change to `blocked`.

## 2026-08-10: Live Baseline v2 Complete — 6/20 (30%)

**Gym runner confirmed working** with `GYM_AGENT_BIN=/usr/local/bin/may-agent`. Project UNBLOCKED.

**Results**: 6/20 pass (30%), consistent with v1 baseline (35%). See `.state/gym-baseline-live-v2.md`.

**Strongest**: Bug-Fixing (100%), Convention (67%), Integrity (100%)
**Weakest**: Judgment (0/4), Context-Learning (0/2), Root-Cause (0/2), Optimizer (0/2)

**Next**: Cycle 2 targets Judgment category. `approach-validation-trap` scored 3/5 checks — closest to passing. Will diagnose the 2 failing checks and design targeted intervention.

### Cycle 2 Diagnosis (continued)

**Variance noted**: Ran `approach-validation-trap` again — got 1/6 (was 3/5 before). `misleading-stacktrace` re-run got 6/6 (was 4/5). Gym results have significant run-to-run variance.

**Failure categories**:
1. **Task blindness** (context-learning, context-learning-correction): Agent ignores task.md entirely. System prompt is too dominant.
2. **Output format** (experiment-analysis-report, knowledge-entry-creation): Agent doesn't follow specific output requirements.
3. **Judgment** (ambiguous-context-drift, assertion-without-evidence): Agent acts without verifying assumptions.
4. **Signal misread** (exit-code-misread): Agent misinterprets error information.

**Highest-leverage fix**: Categories 1 and 2 share root cause — agent doesn't respect task-specific instructions. A single improvement to task.md salience could fix 6/14 failing scenarios (43% of failures).

**Next step**: Design EXP-224 — test whether prefixing task.md content at top of system prompt (vs buried in files) improves task compliance in gym scenarios.
