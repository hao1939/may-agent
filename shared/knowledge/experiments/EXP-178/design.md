# EXP-178: Difficulty-Adaptive Content-First Guard Pilot

**Date**: 2026-04-17
**Status**: DESIGNED
**Predecessor**: EXP-166 (content-first vs process-first, 120 runs, displacement confirmed)
**Hypothesis**: H-165 (Production-Provision Interference) + design doc `difficulty-adaptive-content-first-guards.md`
**Design doc**: `agents/shared/may-agent-docs/design/difficulty-adaptive-content-first-guards.md`
**Cost estimate**: ~$9-12 (120 runs × ~$0.075–$0.10 avg)

---

## 1. Research Question

Does a **difficulty-adaptive content-first guard** help on a MEDIUM-hard recognition task (sql-injection-in-query-builder, 33% baseline) while reproducing the production-displacement HARM on a HARD architectural task (cascading-fix-trap-v2, 0–7% baseline)?

Put sharply: **is the policy "production-mode on easy/medium, passive-injection on hard" strictly dominant over any uniform policy** across this 2-scenario pair?

EXP-166 answered this asymmetry in aggregate (C=100% vs D=7% on cascading; all ≈ equal on sql-injection at 0pp cost). EXP-178 tests the adaptive *routing rule itself* as a deployable guard, not as a pair of separate arms. It also first-order confirms that adaptive ≥ uniform-passive on the medium task (where auditability matters) and adaptive ≥ uniform-production on the hard task (where displacement kills).

### 1.1 Per-arm × scenario pre-registered predictions

| Arm \ Scenario | sql-injection (medium, 33% base) | cascading-fix-trap-v2 (hard, 0% base) | Rationale |
|---|---|---|---|
| **G1 no-guard control** | 30–45% | 0–10% | Replicates baselines (EXP-166 arm A; gap-fill 1/3) |
| **G2 production-mode uniform** | 30–50% (≈G1, ≤5pp cost) | 0–10% (displacement) | KE-196: 0pp cost on easy/medium; KE-195: −93pp on hard |
| **G3 passive-injection uniform** | 60–85% (content helps) | 85–100% (replicates EXP-166 C) | Expert analysis lifts both; no production tax anywhere |
| **G4 adaptive (proposal)** | 60–85% (production on medium, content-first) | 85–100% (passive on hard) | G4 = G2 on easy/medium + G3 on hard |

**Crucial discriminating cells:**
- **G4 vs G2 on cascading**: must show ≥70pp gap (confirms routing respects displacement asymmetry)
- **G4 vs G3 on sql-injection**: should be within ±10pp (confirms production-mode cost is ≈0pp at medium difficulty — the whole reason to keep it on for auditability)
- **G4 vs G1 on sql-injection**: should be ≥20pp (confirms injection content helps on medium recognition task; if not, passive/adaptive collapses to G2)

---

## 2. Arms

| Arm | Intervention | Production required? | Expert content injected? | N per scenario |
|-----|---|---|---|---|
| **G1** | No-guard control (baseline) | No | No | 15 |
| **G2** | Production-mode uniform | Yes (write ANALYSIS.md Phase 1 → available in Phase 2) | No | 15 |
| **G3** | Passive-injection uniform | No | Yes (EXP-166 F1 artifact verbatim) | 15 |
| **G4** | Adaptive (proposal) | Yes on sql-injection, No on cascading | Yes on cascading, No on sql-injection | 15 |

**Arm construction notes:**
- G3 is **EXP-166 arm C** reused — provides replication of the +100pp hard-task effect.
- G2 differs from EXP-166 arm B in that the produced ANALYSIS.md is *retained into Phase 2* (not deleted). This lines up with deployed production-mode guards (verification_evidence stays in finish()) rather than the ablation in EXP-166 which deleted it. If this turns out to matter, it is itself informative — it means the adaptive policy sees a kinder production baseline than EXP-166 did.
- G4 **is** the shipped adaptive guard; arms G1/G2/G3 are its counterfactuals. This framing makes the pilot a deployment test, not just a 2×2 factorial re-run.
- All arms use the same judge rubric (SQL-injection arm: null-bug fixed AND parameterization applied; cascading arm: pipeline order reversed AND threshold comparison correct).

---

## 3. Scenarios

### 3.1 sql-injection-in-query-builder (MEDIUM, 33% baseline)
- **Path**: `agents/gym/scenarios/sql-injection-in-query-builder/`
- **Type**: Recognition task. Agent fixes obvious null-handling crash; SQL injection lives in the same file and is only caught if agent *notices* it while reading. Tests don't cover the injection.
- **Baseline source**: 1/3 gap-fill runs + EXP-166 arm A (N=15) — triangulates the 33% estimate.
- **Expert content for G3/G4-hard-cell (N/A — this is not the hard cell)**: Not applicable; on sql-injection, G4 uses production-mode, not injection.
- **Expert content for G3 (uniform passive)**: EXP-166 F1 artifact — analysis identifying BOTH the null bug AND the injection, with parameterized-query guidance.

### 3.2 cascading-fix-trap-v2 (HARD, 0–7% baseline)
- **Path**: `agents/gym/scenarios/cascading-fix-trap-v2/` (scenario.json already has `"difficulty": "hard"`)
- **Type**: Architectural task. Agent must reverse documented pipeline reorder; fixing the obvious symptom leaves a threshold-comparison bug.
- **Baseline source**: EXP-165 (0/16), EXP-166 arm A (0/15), post-contamination controls (0/3). Stable ≤10% ceiling.
- **Expert content for G3/G4 (hard-cell passive)**: EXP-166 F1 ROOT_CAUSE_ANALYSIS.md verbatim (the +100pp content from KE-195).

---

## 4. N per cell

**N=15 per cell × 4 arms × 2 scenarios = 120 runs.** Matches EXP-166 exactly for direct comparability; priors from EXP-166 give us effect-size precision estimates (~±12pp at N=15 with Wilson CI), adequate for the ≥70pp G4-vs-G2 discriminating gap but marginal for the ±10pp G4-vs-G3 equivalence claim on sql-injection. Accepting the equivalence risk: a false-positive equivalence only downgrades the "adaptive costs nothing on medium" claim — it does not invalidate the core routing result.

**Cost**: EXP-166 ran 120 runs at $9; EXP-178 uses the same scenarios and harness. Budget $9–12 depending on average turn count variance.

---

## 5. Pre-registered Decision Rules

All thresholds locked before execution. Bright-line rules to prevent post-hoc adjustment.

### 5.1 CONFIRMS difficulty-adaptive hypothesis (deploy G4)
**All three must hold:**
1. G4 cascading ≥ 70% AND G4 cascading − G2 cascading ≥ 60pp
2. G4 sql-injection ≥ 50% AND G4 sql-injection − G1 sql-injection ≥ 15pp
3. |G4 sql-injection − G3 sql-injection| ≤ 15pp (adaptive doesn't pay a tax on medium for keeping production-mode on)

### 5.2 REFUTES (do not deploy; revise design)
**Any one of these:**
1. G4 cascading < 50% → routing fails to protect against displacement; mechanism claim wrong
2. G3 cascading < 70% → EXP-166's +100pp finding doesn't replicate; call the whole content-first thesis into question
3. G4 sql-injection < G1 sql-injection by ≥10pp → production-mode harms at medium difficulty (KE-196 boundary re-examined)

### 5.3 INCONCLUSIVE / follow-up needed
- G3 cascading ≥ 70% but G4 cascading 50–70%: routing works partially; investigate whether G4's production-mode arm is somehow bleeding into hard-cell behavior (shouldn't — scenarios are independent sessions — but worth checking logs).
- G3 sql-injection > G4 sql-injection by 10–25pp: the injection content helps more on medium than expected, and forcing production there actively obstructs it. Would motivate a "passive-everywhere" successor design.

### 5.4 Secondary metrics (descriptive, not deciding)
- Average turns to completion per arm × scenario
- verification_evidence presence rate in G2/G4-medium-cell finish() calls (should be ≥90% if the guard fires)
- Judge confidence scores (to flag low-reliability cells per §8.4)

---

## 6. Harness Details

### 6.1 Command template
```bash
export PATH=".state/.bun/bin:$PATH"
scripts/gym-run.sh <scenario> \
  --agent coder \
  --arm <G1|G2|G3|G4> \
  --tag EXP-178 \
  --timeout 600 \
  --trials 15
```
For batch: wrap in `--timeout 1800` (per stored guidance on complex scenarios).

### 6.2 Arm realization in harness
- **G1**: Unmodified scenario. No workspace pre-population. No post-finish guard beyond existing T2-post-write-verification.
- **G2**: Inject task-prefix "Before fixing, write ANALYSIS.md documenting the issues you see. Then fix based on your analysis." ANALYSIS.md retained across the session. No expert content provided.
- **G3**: Pre-populate `ANALYSIS.md` in workspace with EXP-166 F1 artifact for the appropriate scenario. Task-prefix: "A colleague has already investigated this — read ANALYSIS.md first, then fix." No production requirement.
- **G4** (adaptive): Branch on `scenario.json#difficulty` field.
  - If `difficulty=="hard"` → G3 behavior (passive injection, no production).
  - Else (including `medium`, `easy`, or absent) → G2 behavior (production required, no injection).
  - Single conditional in the session-bootstrap script; no other code path changes.

### 6.3 Contamination controls (inherited from prior work)
- **Clean-environment fix** from post-EXP-168 contamination investigation (committed in earlier session; verified via controls: base 0/3, arm E 5/5, arm F moderate-hint 10/10). Every trial spins a fresh env; no residue from prior runs.
- **Scenario isolation**: sql-injection and cascading trials run in separate directories; no shared state files.
- **Judge fixed**: same judge model/prompt across all 120 runs. Rubric frozen at design-time (this file), not authored during analysis.
- **Arm blinding**: not feasible (arms are operationally distinct) but judge receives only the final code diff + task.md, not the arm label.

### 6.4 Logging requirements
Each run logs: scenario, arm, trial#, turns_used, final pass/fail, verification_evidence_present (bool), ANALYSIS.md_present_at_finish (bool), session_id, cost. Write to `agents/shared/knowledge/experiments/EXP-178/runs.jsonl`.

---

## 7. Dependencies / Blockers

### 7.1 Scenario difficulty tag — PARTIAL
- ✅ `cascading-fix-trap-v2/scenario.json` already has `"difficulty": "hard"`.
- ❌ `sql-injection-in-query-builder/scenario.json` lacks a `difficulty` field.
- **Action required**: Add `"difficulty": "medium"` to sql-injection's scenario.json before G4 execution. One-line metadata edit; not a code change. Add `difficulty_source: "baseline_measured"` per design doc §4.1.
- **Fallback**: G4's branching rule defaults non-hard to production-mode, so a missing field still routes correctly on this scenario. The explicit tag is for auditability and future extension.

### 7.2 Expert content artifacts — READY
- ✅ cascading-fix-trap-v2 ROOT_CAUSE_ANALYSIS.md exists from EXP-165/EXP-166.
- ✅ sql-injection analysis content exists from EXP-166 arm C design.
- No new content curation needed for this pilot.

### 7.3 Harness arm selection — MUST VERIFY
- `scripts/gym-run.sh` accepts `--arm` today for EXP-166 re-runs; confirm that the same flag still works or needs extension for G4's adaptive branch.
- If `--arm G4` doesn't exist, a ~20-line wrapper script `scripts/run-exp178.sh` is sufficient — it reads `scenario.json#difficulty` and dispatches to G2-or-G3 logic internally. Prefer the wrapper over modifying the shared gym runner (keeps the pilot self-contained; rollback is trivial).

### 7.4 Judge rubric — READY
Reuse EXP-166 judge prompts verbatim for both scenarios (rubric already validated on 120 runs).

### 7.5 Budget approval — IMPLICIT
$9–12 fits within established experiment-scale budgets; no separate approval step needed.

---

## 8. Risks / Threats to Validity

### 8.1 Ceiling effect on sql-injection
Baseline is 33%, not 67% as earlier design doc assumed. Room above for content to help (G3 could reach 60–85%) and for production-mode to not-harm (G2 ≈ G1). However, if the scenario baseline drifts upward (model improvements, tooling changes), G3 and G4 could saturate near 100% and hide the production-tax signal. **Mitigation**: run G1 (baseline) fresh in this experiment rather than trusting historical 33%; if G1 > 60%, flag ceiling and add a harder medium scenario before drawing deployment conclusions.

### 8.2 Floor effect on cascading
Baseline is 0–7%. G2's predicted 0–10% is already at the floor, so G4-vs-G2 gap could look like a ceiling-on-G4 effect rather than a floor-on-G2 effect. **Mitigation**: the effect size (≥70pp) is large enough that floor dynamics don't obscure it; and KE-195's displacement is measured as *C-vs-D*, not just *vs-baseline*, so the mechanism is independently supported.

### 8.3 Paraphrase confound
G2's production-mode instruction and G3's passive-injection instruction differ in wording beyond their operational difference. Agent may respond to tone/formality, not just the production-vs-provision asymmetry. EXP-166 didn't fully control for this either. **Mitigation (noted, not fixed here)**: a follow-up MOD-PARAPHRASE arm (per EXP-177 methodology) could swap wordings while holding operation constant. Out of scope for this pilot; flagged as Open Question.

### 8.4 Judge reliability on hard-mode sessions
G3/G4 on cascading have no verification_evidence — judge scores the final diff alone. EXP-166 already validated this workflow at N=15×2; no new judge-reliability risk introduced. But if G3 cascading < 70%, first-check the judge logs for systematic under-scoring before concluding the design is wrong.

### 8.5 Cross-scenario contamination
None expected (separate sessions, separate environments). EXP-166's post-hoc contamination discovery informed the current clean-env protocol. If unexpected correlation appears across scenarios for the same arm, treat as a contamination flag and re-run affected cells.

### 8.6 Voluntary production on hard tasks
G3/G4 on cascading don't forbid voluntary analysis — agent could still produce a plan in-session. If self-initiated production also displaces (KE-195 mechanism implies yes), the hard-cell pass rates will be suppressed relative to "truly-no-production" theoretical ceiling. EXP-166 did not distinguish; this pilot doesn't either. Flagged as a known ceiling on G3/G4's hard-cell performance, not a threat to the G4-vs-G2 comparison.

### 8.7 Sample-size for equivalence claim
N=15 gives Wilson 95% CI roughly ±12–15pp. The §5.1.3 equivalence threshold of ≤15pp is right at the CI edge — a true zero-difference could still show 15pp observed noise. **Mitigation**: if the G4-vs-G3 sql-injection gap lands in the 10–20pp band, mark the equivalence claim "probable, needs N=30 confirmation" rather than treating as confirmed.

---

## 9. Out of Scope

- Medium-band scenarios other than sql-injection (need a second medium to rule out scenario-specific effects; separate design).
- Turn-count or self-report difficulty signals (design doc §3.2/3.3 — deferred).
- Production-context generalization (bob's research sessions, user tasks) — gym-only pilot.
- Content-freshness / injection-payload curation protocol (design doc §6 open question).
- Interaction with evidence-gate and two-phase verify-then-finish guards (design doc §6 open question — audit deferred).

---

## 10. Links

- Design doc: `agents/shared/may-agent-docs/design/difficulty-adaptive-content-first-guards.md`
- Predecessor: `agents/shared/knowledge/experiments/EXP-166/task.md`
- Hypothesis: `agents/shared/knowledge/hypotheses/H-165-production-provision-interference.md`
- Findings: `agents/shared/knowledge/entries/KE-195-production-displacement-effect.md`, `KE-196-displacement-difficulty-moderation.md`
- Related: EXP-177 (paraphrase/environment-clean controls — methodology reference), KE-091 (alignment tax prior art)
