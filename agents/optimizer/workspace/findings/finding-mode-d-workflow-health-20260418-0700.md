# Mode D — Workflow Health (2026-04-18 ~07:00 UTC)

**TL;DR:** Workflow adoption stable ±5pp vs 00:00 baseline; tech-lead continues improving (+15pp, 20→35%); optimizer Dispatcher Mode heartbeat holds strong (avg 3.67 ops, target ≤25 — 85% under budget); one 55-op Phase 1 was a legit Red Metric investigation, not systemic bloat. **NO_DISPATCH** per KE-123 (don't-stack) + no regression signal.

**Window:** last 6h (≈01:00–07:00 UTC). **Prior baseline:** `finding-mode-d-workflow-health-20260418-0000.md`. **Budget used:** ~6 ops.

**R1: NO_DISPATCH.** Rotate D → **A** (Session Archaeology).

## Adoption Table (6h)

| agent     | wf |  n  | adoption% | avgOps | total | max | Δ vs 00:00 |
|-----------|---:|----:|----------:|-------:|------:|----:|-----------:|
| coder     |  7 |   7 | **100.0** | 24.0   |  168  |  57 |  0         |
| optimizer | 12 |  26 |   46.2    | 13.3   |  347  |  55 | -3.8 (noise) |
| bob       |  9 |  23 |   39.1    | 13.4   |  308  |  49 | -4.4 (noise) |
| tech-lead |  7 |  20 | **35.0**  |  8.1   |  162  |  17 | **+15.0** ✅ |
| coach     |  7 |  28 |   25.0    | 16.5   |  462  |  73 | -1.3 (flat) |
| qa        |  0 |  12 |    0.0    |  7.8   |   93  |  13 | -7.1 (small n) |
| scout     |  1 |  14 |    7.1    |  4.9   |   69  |  33 | +7.1 (noise) |
| may       |  0 |  15 |    0.0    | 12.7   |  190  | 123 |  0 (chronic) |
| evaluator |  0 |  79 |   n/a     |  0.3   |   21  |  21 |  0 (JS-only) |

Source: `SELECT agent, COUNT(*) n, SUM(CASE WHEN workflowRunId IS NOT NULL AND workflowRunId<>'' THEN 1 ELSE 0 END) wf ... WHERE startedAt>=Date.now()-6h`.

## Workflow vs Non-Workflow avg ops (per agent)

| agent     | wf avg | non-wf avg | delta |
|-----------|-------:|-----------:|------:|
| optimizer |  19.6  |   8.0      | +11.6 (expected — wf = deep work sessions like Mode A-D) |
| coach     |  21.1  |  15.0      |  +6.1 |
| bob       |  11.4  |  14.6      |  -3.2 (wf leaner) |
| tech-lead |   8.4  |   7.9      |  +0.5 (near-parity) |
| coder     |  24.0  |  n/a       |  — (100% wf) |

**Interpretation:** Workflows ≥ non-wf for optimizer/coach because workflow calls ARE the investigation-heavy sessions (Mode A-D rotation, metric-autonomy iters). This is not bloat — it's the intended split (dispatch in heartbeats, deep work in workflows). Tech-lead near-parity confirms Apr-13 LLM-to-JS verify-wrap conversion is holding (hypothesis confirmed).

## Optimizer Heartbeat Check (confirms Dispatcher Mode)

Heartbeats only (source IS NULL, last 6h):
- **avg 3.67 ops** (n=12, max=5)
- **Target ≤25 — 85% under budget.** Prior Mode D baseline: "optimizer avg 13.2 total" (workflow-inclusive). Pure-heartbeat leanness is actually **better** than expected.
- Previous rewrite ("Dispatcher Mode", Apr 12) continues to hold through 6 cycles of Mode A/B/C/D rotation.

## Phase Bloat Spotcheck

Only one "Phase 1" session in window: **optimizer s_1776490291649_881, 55 ops** — Red Metric investigation (heuristic evaluator adoption 0.49 → fixed, commit 47e95eff6). Follow-up Phase 2 was **8 ops** — near-zero gap. Per task context ("already investigated and fixed earlier this cycle; do not re-investigate"), this is the legit deep-dive, not systemic Phase-1 bloat. No other sessions match the >15-op Phase 1 anti-pattern.

## High-Op Outliers (≥30 ops, not workflow)

| session | agent | ops | task | wf? |
|---|---|---:|---|:--:|
| s_1776491341154_891 | may | **123** | Propagate "Step 1=React to Metrics" to 7 heartbeats | no |
| s_1776478768174_783 | coach | 73 | C1.7 convention regression investigation | no |
| s_1776482361684_813 | coach | 52 | metric-autonomy Iter 1 build | no |
| s_1776490291649_881 | optimizer | 55 | Phase 1 Red Metric (legit) | **yes** |
| s_1776480999...   | bob | 49 | own-your-metrics refine | no |
| s_1776488777318_871 | coder | 57 | (workflow deep work) | **yes** |

- **may 123-op**: cross-agent heartbeat.md propagation — inherently multi-file, no workflow fits; not a target.
- **coach 73/52**: fork work sessions (convention regression + metric-autonomy) — Mode A/C already watching these patterns; no new signal beyond prior dispatches.
- No nested-workflow spawning observed.
- No "workflow op count > non-workflow op count" pathology (tech-lead parity, bob wf<non, coach/optimizer wf>non is by design).

## Regressions

**None.** Deltas vs 00:00 baseline are within ±5pp noise for every agent except tech-lead (+15pp, improving — do not perturb). Qa 7.1→0% is n=12 noise; scout 0→7.1% is n=1.

## Decision: NO_DISPATCH

Justification:
1. **No regression signal** — every agent flat or improved vs 00:00.
2. **Tech-lead +15pp improvement** is mid-observation-window; stacking another intervention would violate KE-123 (-12 to -15pp when combined).
3. **Optimizer Dispatcher Mode holding** — heartbeat avg 3.67 ops vs ≤25 target; hypothesis ("post-Apr-13 LLM-to-JS verify-wrap still holding") **CONFIRMED**.
4. **No systemic Phase-1 bloat** — single 55-op Phase 1 was the task-sanctioned Red Metric investigation.
5. **Chronic 0%-adoption agents** (may, evaluator, qa, scout) are structural: may = heartbeat-only dispatcher (already lean pre-workflow), evaluator = JS-only (no tool calls possible), qa/scout = small n + inherently manual audits. No fresh dispatch target.

## Rotation

D → **A** (Session Archaeology) next cycle. Watch for may 123-op pattern recurrence and whether tech-lead's +15pp adoption holds or reverts.

## NO_DISPATCH
