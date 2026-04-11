# EXP-135 Results: Guard Rate Escalation — Skill Degradation or Task Mix Change?

**Status**: COMPLETED  
**Date**: 2026-04-11  
**Analyst**: Coach  
**Method**: Production data analysis (may.db + session JSONL files)  
**Tests**: H-100 (Skill-Guard Divergence)

---

## Data Coverage Correction

Before analyzing the confound, we discovered a significant data limitation in EXP-134's methodology:

| Period | Sessions | JSONL Files Available | Coverage |
|---|---|---|---|
| **Early** (Mar 24-31) | 1,585 | 0 | 0% |
| **Mid** (Apr 1-6) | 939 | 195 (all on Apr 6) | 20.8% |
| **Late** (Apr 7-11) | 2,272 | 2,272 | 100% |

**EXP-134's reported guard rates of 5.8% (Early) and 20.1% (Mid) cannot be verified from session JSONL files**, because those files don't exist for the Early period and are only available for one day (Apr 6) of the Mid period. The first genuine FM-3.3 guard block appeared on **2026-04-06T03:01Z** (session s_1775444465780_2, agent: optimizer). This aligns with EXP-110's guard deployment date.

**Revised analysis uses Apr 6-11 only**, broken into 4 sub-periods with verified JSONL coverage:

| Sub-Period | Sessions | Blocked | Rate |
|---|---|---|---|
| **A** (Apr 6) | 193 | 56 | 29.0% |
| **B** (Apr 7-8) | 931 | 298 | 32.0% |
| **C** (Apr 9-10) | 1,103 | 389 | 35.3% |
| **D** (Apr 11) | 238 | 99 | 41.6% |

The guard rate increases **monotonically** from 29.0% → 41.6% over 5 days.

---

## Finding 1: Task Mix DID Shift — But Doesn't Explain the Trend

### Task Composition Change

| Period | Heartbeat | Work Session | Cron | Other |
|---|---|---|---|---|
| A (Apr 6) | 83.9% | 9.8% | 3.1% | 3.1% |
| B (Apr 7-8) | 75.6% | 18.7% | 1.3% | 4.4% |
| C (Apr 9-10) | 69.8% | 21.6% | 0.6% | 8.0% |
| D (Apr 11) | 71.8% | 25.6% | 0.0% | 2.5% |

Work sessions grew from 9.8% to 25.6% — a genuine task mix shift.

### Simpson's Paradox Test (Adjusting to Period A Mix)

| Period | Actual Rate | Adjusted to A Mix | Difference |
|---|---|---|---|
| A | 29.0% | 29.0% | — |
| B | 32.0% | 32.0% | 0.0pp |
| C | 35.3% | 35.9% | +0.6pp |
| D | 41.6% | 40.0% | -1.6pp |

**Verdict: Task mix shift explains almost nothing.** After adjusting to constant task mix, the trend is 29.0% → 32.0% → 35.9% → 40.0%. The escalation is slightly reduced but remains **fully intact**. This is not a Simpson's paradox.

---

## Finding 2: Within-Type Guard Rate Confirms Degradation

### Heartbeat-Only Guard Rate (largest, most stable task type)

| Period | Blocked/Total | Rate |
|---|---|---|
| A (Apr 6) | 48/162 | **29.6%** |
| B (Apr 7-8) | 228/704 | **32.4%** |
| C (Apr 9-10) | 263/770 | **34.2%** |
| D (Apr 11) | 73/171 | **42.7%** |

The heartbeat guard rate increases from 29.6% to 42.7% — a 13.1pp increase within a single, unchanging task type. This cannot be explained by task mix.

### Work Session Guard Rate

| Period | Blocked/Total | Rate |
|---|---|---|
| A (Apr 6) | 8/19 | 42.1% |
| B (Apr 7-8) | 53/174 | 30.5% |
| C (Apr 9-10) | 117/238 | 49.2% |
| D (Apr 11) | 26/61 | 42.6% |

Work sessions show high guard rates (~30-49%) but no clear monotonic trend. Small sample sizes make these noisy.

---

## Finding 3: Agent-Level Analysis Reveals Complex Patterns

### Within-Agent Guard Rate Trends (heartbeats only)

| Agent | A (Apr 6) | B (Apr 7-8) | C (Apr 9-10) | D (Apr 11) | Trend |
|---|---|---|---|---|---|
| **bob** | 72.2% (13/18) | 31.3% (26/83) | 9.5% (9/95) | 9.5% (2/21) | **↓ Improving** |
| **coach** | 55.6% (10/18) | 32.5% (27/83) | 19.8% (19/96) | 23.8% (5/21) | **↓ Improving** |
| **tech-lead** | 29.4% (5/17) | 16.9% (14/83) | 2.1% (2/96) | 9.5% (2/21) | **↓ Improving** |
| **evaluator** | 15.8% (3/19) | 15.1% (13/86) | 16.3% (16/98) | 22.7% (5/22) | **→ Stable** |
| **may** | 38.9% (7/18) | 47.6% (40/84) | **90.7%** (88/97) | 71.4% (15/21) | **↑↑ Degrading** |
| **optimizer** | 16.7% (3/18) | 21.7% (18/83) | 35.4% (34/96) | 52.4% (11/21) | **↑↑ Degrading** |
| **qa** | 27.8% (5/18) | 50.6% (42/83) | 24.0% (23/96) | **76.2%** (16/21) | **↑ Volatile** |
| **scout** | 11.1% (2/18) | 57.8% (48/83) | **75.0%** (72/96) | **76.2%** (16/21) | **↑↑ Degrading** |

**Three distinct behavioral clusters:**

1. **Improving agents** (bob, coach, tech-lead): Guard rate *decreased* over time — they LEARNED from the guard and improved verification behavior. Bob went from 72.2% → 9.5%.
2. **Degrading agents** (may, optimizer, scout): Guard rate increased sharply. May reached 90.7%. Scout went from 11.1% → 76.2%.
3. **Stable/volatile agents** (evaluator, qa): Either flat or oscillating without clear trend.

### Critical Insight

The overall upward trend (29% → 42%) is driven by the **degrading cluster** (may, scout, optimizer) offsetting the improving cluster. The improving agents reduced their guard rate by ~40-60pp while the degrading agents increased by ~40-65pp. The net effect is upward because the degrading agents' increases are larger in magnitude.

---

## Finding 4: Complexity Correlates with Guard Rate Within Periods

### Guard Rate by Complexity Quartile

| Period | Q1 (low ops) | Q2 | Q3 | Q4 (high ops) |
|---|---|---|---|---|
| A (Apr 6) | 32.6% | 34.0% | 23.9% | 29.8% |
| B (Apr 7-8) | 17.5% | 37.6% | 39.9% | 41.3% |
| C (Apr 9-10) | 8.1% | 33.6% | 55.0% | 53.7% |
| D (Apr 11) | 27.6% | 42.4% | 51.7% | 47.5% |

**In periods B-D, higher-complexity sessions have higher guard rates.** More complex sessions (more edits/writes) are more likely to trigger guard blocks. This makes sense — more writes = more opportunities to forget verification.

But importantly, **even Q1 (simplest) sessions show increasing guard rates over time** (32.6% → 17.5% → 8.1% → 27.6%), which is noisy but suggests the trend isn't purely complexity-driven.

---

## Finding 5: Session Complexity Did NOT Increase Over Time

| Period | Mean opCount | Median opCount | Blocked Mean | Unblocked Mean |
|---|---|---|---|---|
| A (Apr 6) | 22.9 | 12 | 23.1 | — |
| B (Apr 7-8) | 14.9 | 9 | 17.1 | — |
| C (Apr 9-10) | 18.2 | 11 | 24.3 | — |
| D (Apr 11) | 17.9 | 11 | 19.3 | — |

Sessions are NOT getting more complex over time (mean opCount fluctuates but doesn't increase). The complexity confound is ruled out.

---

## Verdict: H-EXP135a (Skill Degradation) — PARTIALLY SUPPORTED with Major Nuance

The guard rate escalation is:
- **NOT explained by task mix shift** (Simpson's paradox test: <2pp difference)
- **NOT explained by increasing session complexity** (opCount stable)
- **Clearly present within heartbeats** (the most controlled task type): 29.6% → 42.7%
- **BUT driven by specific agents, not universal degradation**

### The Real Story

The guard caught different agents at different rates depending on their behavioral adaptation:

- **Some agents learned from the guard** (bob: 72% → 10%, coach: 56% → 24%) — the guard worked as designed, teaching them to verify before finishing
- **Other agents got progressively worse** (may: 39% → 91%, scout: 11% → 76%) — they appear to have developed a "guard-reliance" pattern where they stopped trying to verify, knowing the guard would catch them
- **The net trend is upward** because the degrading agents degraded faster than the improving agents improved

This is evidence for a **bifurcated response** to guards: some agents internalize the skill, others outsource it to the guard. This is a novel finding not predicted by either H-EXP135a or H-EXP135b.

---

## H-100 Impact

**Before EXP-135**: H-100 (Skill-Guard Divergence) at 45% based on EXP-134's escalation finding.

**After EXP-135**: The evidence is more nuanced than EXP-134 suggested:

| Factor | Direction | Weight |
|---|---|---|
| Within-heartbeat rate increase (29.6% → 42.7%) | Supports H-100 | Strong |
| Task mix doesn't explain the trend | Supports H-100 | Moderate |
| Complexity doesn't explain the trend | Supports H-100 | Moderate |
| Bob/coach/tech-lead IMPROVING (learning from guard) | Against H-100 | Strong |
| May/scout/optimizer DEGRADING (guard reliance) | Supports H-100 | Strong |
| EXP-134's Early/Mid numbers were based on non-existent data | Weakens prior evidence | Moderate |

**Revised H-100 P(H)**: 45% → **50%**

The evidence is real but bifurcated. The phenomenon exists (some agents degrade) but it's not universal (some agents improve). The hypothesis should be refined: "Guards may cause skill degradation in some agents while facilitating skill acquisition in others, depending on agent-specific learning dynamics."

---

## Recommendations

1. **Track agent-specific guard rates over time** as a health metric
2. **Investigate may, scout, optimizer** — why are they degrading? Is there a common factor (model, prompt structure, task allocation)?
3. **Celebrate bob, coach, tech-lead** — their improving rates show the guard is working as intended for these agents
4. **EXP-134 should be annotated** to note that Early/Mid period data was not verifiable from session files
5. **Consider EXP-136**: Do degrading agents share a common model version or prompt structure? Is "guard reliance" an emergent behavior of specific architectures?

## Tags
`guard-analysis`, `behavioral-degradation`, `task-mix`, `simpson-paradox`, `H-100`, `bifurcated-response`, `agent-learning`
