# EXP-179: Content-First Guard on SQL-Injection Scenario

**Date**: 2026-04-18
**Status**: DESIGNED
**Predecessor**: EXP-166 (content-first vs process-first on cascading-fix-trap-v2)
**Hypothesis**: H-165 (Production-Provision Interference) — passive-injection corollary
**Design doc**: `agents/shared/may-agent-docs/design/difficulty-adaptive-content-first-guards.md`

---

## Research Question

Does passive content injection lift pass-rate on a currently-hard scenario
(`sql-injection-in-query-builder`, ~33% baseline) without regressing an easy
scenario — thereby validating the passive-injection corollary of H-165 on a
second, independent hard task?

## Hypothesis Under Test

**H-165 (Production-Provision Interference)** predicts that on hard tasks, any
forced production step (analyze-then-fix, state-your-plan) displaces the
capacity needed to *apply* expert content, while passive injection of the same
content preserves it. EXP-166 showed this on cascading-fix-trap-v2 (process-first
F1→F2 = 7%, content-first F1-only = 100%; a 93pp gap — see KE-195, KE-196).

EXP-179 tests the **transportability** of that corollary: if the mechanism is
real (capacity displacement, not scenario-specific anchoring), passive injection
should lift `sql-injection-in-query-builder` from its 33% baseline, while an
active/process-first guard should match or underperform baseline. On an easy
control scenario, both guards should be indistinguishable (KE-196: displacement
is difficulty-moderated; easy tasks have slack capacity).

- **H-179a (primary, confirms H-165 corollary)**: Arm B (passive) > Arm A
  (baseline) by ≥25pp on sql-injection, AND Arm B not < Arm A − 10pp on the easy
  control.
- **H-179b (secondary)**: Arm C (active/process-first) ≤ Arm A on sql-injection
  (replicates KE-195 displacement on a new scenario).
- **H-179-null**: |B − A| < 10pp on sql-injection. Would refute the
  cross-scenario generalization of H-165.

## Arms

Four arms, scenario-tag difficulty policy held constant per arm (no adaptive
branching — adaptivity is a follow-on once corollary is confirmed here):

| Arm | Intervention                          | Notes                                           |
|-----|---------------------------------------|-------------------------------------------------|
| A   | Control (no guard, no injection)       | Current baseline behavior                       |
| B   | Passive content injection              | Expert hint surfaced in context at session start; no production step |
| C   | Active / process-first guard           | Agent must produce analysis/plan before fixing (EXP-166 F1→F2 shape) |
| D   | Difficulty-gated (passive on hard, none on easy) | Optional; budget-permitting                     |

Injection payload for B and D reuses the EXP-166 F1 artifact shape: a
scenario-scoped root-cause note (3–8 lines) delivered as environmental context,
not as a self-produced summary. Payload content is held constant across B and D
to isolate the delivery mechanism.

## Scenarios

- **Hard**: `sql-injection-in-query-builder` — ~33% baseline (pre-registered
  target). Primary test surface for H-179a.
- **Easy control**: `deprecation-warning-cleanup` (≥90% baseline expected) OR a
  similarly-scored easy scenario confirmed at design-lock. Purpose: regression
  detector — passive injection must not hurt easy-task performance.

Rationale for *not* re-using cascading-fix-trap-v2: EXP-166 already established
the effect there; EXP-179's job is to transport it to an independent hard task.

## N, Cost, Total Runs

- N = 15 trials per (arm × scenario).
- Arms A, B, C × 2 scenarios = 6 cells × 15 = **90 trials**.
- Optional arm D × 2 scenarios adds 30 trials → 120 total.
- Cost estimate: 90 × $0.08 ≈ **$7.20** (arms A–C); 120 × $0.08 ≈ **$9.60**
  with D. Within EXP-166-class budget.
- Timeout: `--timeout 600` per trial (sql-injection has historically hit 300s
  timeouts per operational notes).

## Success Criteria (pre-registered)

1. **Primary (H-179a confirmed)**: B − A ≥ +25pp on sql-injection AND
   B − A ≥ −10pp on easy control.
2. **Secondary (H-179b confirmed)**: C − A ≤ 0pp on sql-injection (±5pp
   tolerance for noise at N=15).
3. **Transportability**: effect direction on sql-injection matches EXP-166
   (passive ≥ active on hard). Magnitude need not match EXP-166's 93pp — a
   smaller effect on a less-extreme-baseline scenario still confirms the
   mechanism.

## Decision Rules

- **Confirms H-165 passive-injection corollary**: criterion 1 met. Action:
  promote difficulty-adaptive design (§2 of design doc) to pilot; draft KE
  documenting cross-scenario replication.
- **Refutes**: B − A < 10pp on sql-injection. Action: re-examine whether the
  cascading-fix-trap-v2 effect was scenario-specific (anchoring or
  trap-structure rather than capacity displacement); H-165 mechanism
  downgraded; do NOT roll out adaptive guard.
- **Mixed / ambiguous**: 10pp ≤ B − A < 25pp on sql-injection. Action: run a
  second replication at higher N (30) before commit; likely a weaker but real
  effect — update KE-196 difficulty-moderation curve with a second data point.
- **Regression on easy** (B < A − 10pp on easy control): halt rollout
  regardless of hard-task result. Passive injection with negative easy-task
  side-effects violates the non-regression requirement of the adaptive design.
- **C outperforms B on sql-injection** (unexpected): re-open H-165; production
  may not be uniformly displacing. Likely a payload-quality confound — inspect
  injection content before any mechanism update.

## Execution

```bash
# Per-arm batch; tag for post-hoc filtering.
./scripts/gym-run.sh sql-injection-in-query-builder \
  --agent <arm-agent> --tag EXP-179-armB --n 15 --timeout 600
./scripts/gym-run.sh deprecation-warning-cleanup \
  --agent <arm-agent> --tag EXP-179-armB --n 15 --timeout 600
# Repeat for arms A, C, (D).
```

Count completed trials (`ls` result files) and confirm all N finished before
scoring — per operational-knowledge gym checklist.

## Assumptions / Risks

- **Baseline stability**: 33% for sql-injection assumed from prior measurement;
  re-measure if A diverges by >15pp from 33%.
- **Payload quality**: injection content must be high-quality for scenario.
  Stale/wrong content can yield 0% even with passive delivery (H-165 boundary).
  Use scenario-scoped expert note; do not reuse cascading-fix-trap payload.
- **Judge reliability on passive arm**: no `verification_evidence` produced in
  B/D; scoring relies entirely on scenario rubric. Spot-check 3 sessions per
  arm for judge consistency.
- **Voluntary production**: nothing prevents agent from spontaneously
  producing analysis under B. If observed >30% of sessions, flag as
  self-displacement confound (noted in design doc §6).

## Links

- **H-165**: `agents/shared/knowledge/hypotheses/H-165-production-provision-interference.md`
- **KE-195** (Production-Displacement Effect, 93pp): `agents/shared/knowledge/entries/KE-195-production-displacement-effect.md`
- **KE-196** (Displacement is Difficulty-Moderated): `agents/shared/knowledge/entries/KE-196-displacement-difficulty-moderation.md`
- **EXP-166** (predecessor, cascading-fix-trap-v2): `agents/shared/knowledge/experiments/EXP-166/`
- **Design doc**: `agents/shared/may-agent-docs/design/difficulty-adaptive-content-first-guards.md`
- **KE-091** (Alignment Tax): `agents/shared/knowledge/entries/KE-091.md`
