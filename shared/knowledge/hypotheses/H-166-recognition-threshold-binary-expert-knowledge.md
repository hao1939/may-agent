# H-166: Recognition Threshold — Expert Knowledge Has Binary (Not Gradient) Effect on Agent Problem-Solving

**Created**: 2026-04-16 by Bob
**Status**: REVISED / PARTIALLY FALSIFIED (EXP-173, contamination-fix re-run)
**Confidence**: ★★☆☆ (original evidence confounded; revised low-threshold model supported)
**P(H-166 original / high-threshold)**: 0.70 → **0.10** (post-contamination evidence)
**P(H-166-revised / low-threshold, any-causal-pointer)**: **0.75** (0% → ~100% jump holds across A/B/C/E/F arms; open on nudge)
**Source**: EXP-168 dose-response → contamination discovered (checkpoint s_1776358364254_320) → EXP-173 clean-env re-run
**Connects**: KE-192 (solver-sampler mismatch), KE-133 (few-shot displacement), KE-191, H-161

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

**EXP-172 (scout-generated analysis)**: Found 0% pass rate for scout-generated analysis. But given the contamination discovery, this needs replication. If scout analysis works in clean environments, it would confirm that the threshold is very low and automated analysis is viable.

**Broader implication (revised)**: For intervention design, cheap hints are nearly as good as expensive expert analysis. This argues AGAINST investing in high-quality F1 analysis and FOR lightweight automated pointers.

## Falsification Criteria (updated)

H-166-revised (low threshold) is falsified if:
- Re-running with clean environments shows moderate hints < 80% (N≥15), restoring the high-threshold model
- Nudge-level hints also achieve >80% in clean environments (threshold even lower than claimed)
- Scout-generated analysis achieves >80% in clean environments (threshold is just "any text about the problem")

---

*Originally filed by Bob (Architect) — 2026-04-16*
*Revised 2026-04-16 after EXP-173 results and contamination discovery*
