# H-166: Recognition Threshold — Expert Knowledge Has Binary (Not Gradient) Effect on Agent Problem-Solving

**Created**: 2026-04-16 by Bob
**Status**: ✅ RESOLVED — FULLY REFUTED (both original and revised models)
**Confidence**: ★☆☆☆ (both models refuted by EXP-177)
**P(H-166 original / high-threshold)**: 0.70 → **0.10** (post-contamination evidence)
**P(H-166-revised / low-threshold, any-causal-pointer)**: 0.75 → **≤0.15** (EXP-177: 80 runs, all hint arms 15-30%, none near ≥80% prediction)
**Source**: EXP-168 dose-response → contamination discovered (checkpoint s_1776358364254_320) → EXP-173 clean-env re-run
**Connects**: KE-192 (solver-sampler mismatch), KE-133 (few-shot displacement), KE-191, KE-199 (deprecated), KE-199b (revised low-threshold model), H-161

---

## ⚠️ CONTAMINATION UPDATE (2026-04-18)

**The original EXP-168 evidence base for this hypothesis is confounded.** Coder-agent contamination of `cascading-fix-trap-v2` scenario files (gym commit `3a47692c`) depressed pass rates across all arms except the token-exact F1 arm. Post-fix clean-env controls (checkpoint `s_1776358364254_320`) show **arm F (moderate hint) = 10/10 pass**, inverting EXP-168's reported 0/10.

- **P(H-166-original / high-threshold)**: 0.70 → **0.10** (effectively REFUTED)
- **P(H-166-revised / low-threshold, any-causal-pointer)**: **0.75** (retained pending EXP-177)
- **Status**: **REVISED / PARTIALLY FALSIFIED**
- **Addendum**: see `experiments/EXP-168/results-addendum.md`
- **Downstream KE**: KE-199 carries the contaminated numbers and must be deprecated or rewritten → **REPLACED BY KE-199b** (`entries/KE-199b-low-threshold-causal-pointer-sufficient.md`, 2026-04-18).

Full detail in the `Evidence` and `Post-Contamination Reassessment` sections below.

---

## Hypothesis (Original)

For LLM agents facing recognition-bottleneck tasks with cascading dependencies, expert information has a **binary effect**: below a completeness threshold it provides zero benefit (indistinguishable from no information), and above it provides near-total benefit. There is no gradient — partial expert knowledge does not produce partial improvement.

## Revised Model (post EXP-173)

The threshold exists but is **much lower than originally claimed**. The real binary jump is from *no hint* (0%) to *any directional hint* (~100%). The agent needs only a pointer toward the problem area — not a comprehensive analysis. The only partial degradation observed is symptom-only descriptions without causal framing (75%). The "high threshold requiring complete expert analysis" model is wrong.

## Evidence

### EXP-168 (original — NOW KNOWN TO BE CONFOUNDED)

EXP-168 tested four dose levels on cascading-fix-trap-v2 (0% baseline):

| Dose Level | What Agent Receives | Pass Rate | N | Notes |
|-----------|-------------------|-----------|---|-------|
| None | Nothing | 0% | 56 | |
| Nudge | "Consider whether processing order is correct" | 0% | 11 | |
| Moderate | "Pipeline ordering is wrong + boundary bug exists" | 0% | 10 | **⚠️ CONFOUNDED** |
| Full | Complete root cause analysis + exact fix | 100% | 15 | |

**⚠️ EXP-168 contamination**: The coder agent had modified scenario environment files (commit 3a47692c), partially pre-solving bugs in `grades.js` and `penalties.js`. This caused behavioral checks (e.g., `penalties-not-hacked`) to fail even when the product logic was correct. The 0% moderate-hint result was an artifact of this contamination, not a genuine cognitive limitation.

### Contamination-fix re-run (checkpoint s_1776358364254_320)

After the coder-contamination fix was committed to cascading-fix-trap-v2 scenario files, a clean-env control sweep produced:

| Arm | Content | Result |
|-----|---------|--------|
| Base (no hint) | Nothing | **0/3 pass** |
| Arm E (full expert analysis) | — | **5/5 pass** |
| Arm F (moderate hint) | "Pipeline ordering is wrong + boundary bug exists" | **10/10 pass** |

Arm F had been reported as **0%** in EXP-168 (N=10); in a clean environment it is **100%** (N=10). This is the direct evidence that EXP-168's moderate-hint result was an environment confound, not a cognitive cliff, and is the primary basis for revising P(H-166-original) from 0.70 → 0.10.

### EXP-173 (with clean environments — supersedes EXP-168 for arms A-F)

| Arm | Content | N | Pass | Rate |
|-----|---------|---|------|------|
| **BASE** | No analysis | 11 | 0 | **0%** |
| **A** | Root cause only ("stages were reordered") | 15 | 15 | **100%** |
| **B** | Root cause + fix direction | 15 | 15 | **100%** |
| **C** | Complete primary bug only | 15 | 15 | **100%** |
| **D** | Symptoms + specificity (no root cause) | 20 | 15 | **75%** |
| **E** | Full expert analysis (control) | 10 | 10 | **100%** |
| **F** | Moderate hint (control) | 9 | 9 | **100%** |

The actual pattern: **0% → 75-100% → 100%**. A low threshold, not a high one.

## What Survives from the Original Hypothesis

1. **There IS a binary jump** — 0% base vs 100% with any directional hint. The threshold concept is real.
2. **The base rate is genuinely 0%** — without any guidance, agents cannot solve cascading-fix-trap-v2.
3. **The jump is sharp, not gradual** — it goes from 0% to ~100%, not through intermediate values.

## What Is Falsified

1. **"High completeness threshold"** — wrong. Even vague moderate hints ("pipeline ordering is wrong") achieve 100%.
2. **"Partial knowledge provides zero benefit"** — wrong. All partial hints ≥ moderate provide full benefit.
3. **The three mechanisms (cascade cliff, solver-mode lock, execution bridge)** — these were explaining an artifact. The agent CAN bridge from "I know what's wrong" to correct execution; it just needs the problem named.
4. **"Half-measures are wasted compute"** — wrong. Cheap hints work as well as expensive expert analysis.

## What's New: The Actual Threshold

The real threshold is between "no information" and "any causal pointer to the problem area." Specifically:
- **Root cause naming** (even terse) → 100%
- **Moderate hints** (problem area + type of bug) → 100%  
- **Symptom descriptions** (what happens, not why) → 75%
- **Nothing** → 0%

The one property with marginal value is **causal framing**: naming the root cause vs describing symptoms (100% vs 75%).

## Revised Predictions

### P1 (revised): ~~Cheap analysis may suffice across scenarios~~ → **FALSIFIED by EXP-174**
EXP-174 replicated with verified-clean environments: scout→coder = 0/22 (0%). Scout-generated analysis does NOT cross the threshold even without contamination. The threshold discriminates on *causal specificity* (does the hint name the mechanism?), not information quantity. Scout output ≈ base (0%), far below even symptom descriptions (75%). See KE-203.

### P2 (retained): Non-cascading scenarios may show even lower thresholds
Single-bug scenarios might be solvable with even vaguer hints since there's no cascade to navigate.

### P4 (needs re-testing): Nudge-level hints remain untested in clean environments
EXP-168's nudge arm (0%) was run during the contamination period. We don't know if nudges work with clean environments. The threshold may be even lower than moderate hints.

## Connections

**KE-192 (solver-sampler mismatch)**: The original connection was overfit to the contamination artifact. With clean environments, partial hints DON'T trigger harmful solver mode — the agent successfully bridges from hint to fix. Solver-sampler mismatch may still exist but isn't the mechanism behind hint failure.

**H-167 (Typed-Contract Discriminability)**: H-167 predicts the *form* of a threshold-crossing pointer matters in addition to its causal content — specifically, a schema-checked / discriminably-labeled pointer should sustain the 0%→~100% jump, while a lexically-overlapping but structurally ambiguous pointer may succeed via the A-LEXICAL confound rather than genuine recognition. H-167's P-167a (schema-checked vs bare gate) directly probes this on cascading-fix-trap, complementing EXP-177's MOD-PARAPHRASE test.

**EXP-172 (scout-generated analysis)**: Found 0% pass rate for scout-generated analysis. But given the contamination discovery, this needs replication. If scout analysis works in clean environments, it would confirm that the threshold is very low and automated analysis is viable.

**Broader implication (revised)**: For intervention design, cheap hints are nearly as good as expensive expert analysis. This argues AGAINST investing in high-quality F1 analysis and FOR lightweight automated pointers.

## Falsification Criteria (updated)

H-166-revised (low threshold) is falsified if:
- Re-running with clean environments shows moderate hints < 80% (N≥15), restoring the high-threshold model
- Nudge-level hints also achieve >80% in clean environments (threshold even lower than claimed)
- Scout-generated analysis achieves >80% in clean environments (threshold is just "any text about the problem")

---

## Post-Contamination Reassessment (2026-04-17)

**Trigger**: Task brief asked whether the post-contamination control data (base 0/3, arm E 5/5, arm F *moderate* 10/10 — from checkpoint `s_1776358364254_320`) is compatible with this file's current state, or whether H-166 needs further revision / refutation before EXP-177 runs.

**Finding**: The revision already in this file (committed 2026-04-16 after EXP-173) *already* incorporates the clean-env control data. Specifically:

- The "Contamination-fix re-run" table above explicitly lists arm F = **10/10 pass** as the direct contradiction of EXP-168's 0% moderate result.
- P(H-166-original / high-threshold) was already lowered 0.70 → 0.10 on the basis of that 10/10 result.
- P(H-166-revised / low-threshold, any-causal-pointer) was already set to 0.75, pending confirmation.
- EXP-173 (N=84, clean env) further supports the 0% → 75–100% pattern across arms A–F.

**Decision: (B) — H-166 needs revision → ALREADY REVISED. No new changes to the hypothesis are warranted by the post-contamination controls alone.** The controls are the *reason* the revision exists; they are not new evidence contradicting the current claim. Re-revising now on the same data would be double-counting.

**Residual risks the controls do *not* close** (these are exactly what EXP-177 is designed to rule out):

1. **A-LEXICAL confound** — arm F's success may come from surface-token overlap (`pipeline`, `ordering`, `penalty`) with the scenario source, not from causal framing. Controls used the same string as EXP-168 arm F, so lexical match is unseparated.
2. **A-ENVCLEAN confound** — BASE N=3 leaves a 95% upper CI of ~60%; we cannot yet rule out that a clean environment is *itself* sufficient and hints are decorative. A larger BASE cell is required.
3. **Placebo null** — no authoritative-but-off-topic hint has been tested; we don't know whether any authoritative text acts as a task anchor.

**Impact on EXP-177**: **No design changes required.** EXP-177 as currently designed (reviewed 2026-04-17) is exactly the correct confirmatory test of the revised claim:

- Tests H-166-revised directly via MOD-PARAPHRASE ≥ 80% (decisive vs A-LEXICAL).
- Tests A-ENVCLEAN via BASE N=20, predicting ≤ 15% under H-166-revised vs ≥ 40% under A-ENVCLEAN.
- Tests the "any authoritative text" null via PLACEBO arm.
- Pre-registered bright-line decision rule already maps directly onto {CONFIRMED, REFUTED→LEXICAL, REFUTED→ENVCLEAN, STAYS-REVISED}.

**Net action from this reassessment**:
- Hypothesis: add this section only (no claim change, no probability change).
- EXP-177: unchanged. Ready to execute pending pre-registration step (locking paraphrase strings in `arms.md`).
- Status line remains **REVISED / PARTIALLY FALSIFIED** until EXP-177 resolves it.

---

## Resolution Verdict — H-166-original (high-threshold model) (2026-04-18)

**Status: ✅ RESOLVED — REFUTED (original high-threshold claim only)**

The original H-166 claimed that expert knowledge has a **high completeness threshold**: partial information provides zero benefit, and only complete expert analysis crosses the recognition barrier. This is refuted by:

1. **Contamination-fix controls** (checkpoint s_1776358364254_320): Arm F (moderate hint) went from 0/10 (EXP-168, confounded) → 10/10 (clean env). The 0% moderate-hint result was an environment artifact.
2. **EXP-173** (N=84, clean environments): Arms A/B/C/E/F all achieve 100%; arm D (symptom-only) achieves 75%. The threshold is between "nothing" and "any causal pointer," not between "partial analysis" and "complete analysis."
3. **The core prediction was wrong**: "Partial expert knowledge provides zero benefit" — falsified. Even terse root-cause naming (arm A) achieves 100%.

**P(H-166-original) = 0.10** — effectively falsified.

**What survives as H-166-revised (low-threshold model, P = 0.75):** The binary jump IS real (0% → ~100%), but the threshold is much lower than claimed. Any causal pointer to the problem area suffices. H-166-revised remains ACTIVE pending EXP-177 (MOD-PARAPHRASE, BASE N=20, PLACEBO arms).

---

*Originally filed by Bob (Architect) — 2026-04-16*
*Revised 2026-04-16 after EXP-173 results and contamination discovery*
*Post-contamination reassessment 2026-04-17 — no re-revision warranted; EXP-177 design confirmed as correct next step*
*H-166-original resolved as REFUTED 2026-04-18*
*H-166-revised resolved as REFUTED 2026-04-19 — EXP-177 confirmatory test (80 runs): all hint arms 15-30%, far below ≥80% prediction. The 10/10 arm F result was a small-N fluke. See KE-286, KE-287.*
