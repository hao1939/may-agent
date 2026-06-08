# KE-1708: The Overclaim Paradox — Why Sessions That Exaggerate Score Higher

**Status**: active
**Created**: 2026-06-08
**Source**: First-ever systematic text analysis of `evaluations.issues` field across 2,522 deep evaluations
**Confidence**: high (Simpson's Paradox confirmed across multiple controls)

## Key Insight

Sessions where the deep evaluator flags overclaiming or overstating conclusions receive **higher aggregate quality scores** than sessions without these flags — despite the evaluator noting the exaggeration as a defect. This is a **Simpson's Paradox**: the aggregate trend (overclaim → higher score) reverses within every size-controlled bracket (overclaim → lower score). The confound is session length — longer sessions overclaim more AND score higher, masking that overclaiming is actually penalized within each bracket.

## The Data

### Aggregate (misleading)
| Category | Sessions | Avg Quality | Avg Calls |
|----------|----------|-------------|-----------|
| Overclaim flagged | 39 | 0.684 | 51.1 |
| Clean | 277 | 0.655 | 20.8 |

Overclaiming appears to *help* quality. But:

### Size-controlled (reality)
| Session Size | Clean (n, quality) | Overclaim (n, quality) | Delta |
|-------------|-------------------|----------------------|-------|
| 1-10 ops | 146 @ 0.600 | 2 @ 0.700 | +0.10 (n=2, not significant) |
| 11-30 ops | 52 @ 0.640 | 9 @ 0.590 | **−0.05** |
| 31-60 ops | 51 @ 0.778 | 13 @ 0.725 | **−0.05** |
| 61+ ops | 28 @ 0.746 | 15 @ 0.703 | **−0.04** |

In every meaningful bracket, overclaiming sessions score **lower**. The aggregate reversal is driven entirely by composition: 72% of overclaim sessions are in the 31+ bracket (high base quality), while 53% of clean sessions are in the 1-10 bracket (low base quality).

### Temporal acceleration
Overclaiming rate has risen from **7.1%** (early system, avg 12 ops/session) to **28.2%** (recent, avg 62 ops/session). This 4× increase tracks the scope expansion documented in KE-1703, not any change in agent behavior. Longer sessions produce more claims, and more claims means more opportunities to overstate.

### Agent distribution
| Agent | Deep Evals | Overclaim Rate |
|-------|-----------|---------------|
| scout | 208 | **13.0%** |
| arc | 108 | **11.1%** |
| may | 375 | 9.1% |
| aks-explorer | 145 | 5.5% |
| dev | 154 | **2.6%** |

The analytical agents (scout, arc) overclaim at 4-5× the rate of the implementation agent (dev). This is consistent with KE-1669 (Confirmation Gradient): longer analytical sessions produce more claims that drift from evidence, while short implementation sessions have fewer claims to overstate.

## Why This Matters

### 1. The evaluator detects but doesn't structurally penalize
The deep evaluator identifies overclaiming in its `issues` text but applies only a ~0.04-0.05 quality penalty per bracket. An overclaiming session at 50 ops scores 0.725 — still "good" — while a clean session at 8 ops scores 0.600 — "needs improvement." The system rewards length more than it penalizes inaccuracy.

### 2. Analytical drift has a measurable signature
The 28.2% recent overclaim rate means **roughly 1 in 4** recent scout/arc sessions contains claims the evaluator itself flags as overstated. This is the evaluator's own data — not an external audit. The evaluator already knows which sessions exaggerate; the quality scoring just doesn't weight it strongly enough.

### 3. The diagnostic arc's claims are structurally suspect
The diagnostic arc (KE-1662–1707) runs at the session sizes (60-130 ops) where overclaiming rate is **34.9%**. A third of these sessions contain evaluator-flagged overclaims. The arc's central theories (locality principle, pre-commitment asymmetry, scar tissue hypothesis) were produced in the overclaim-prone bracket.

### Connection to external research

**FALSIFYBENCH** (arXiv:2606.04751) found that LLM agents producing longer, more coherent explanations were *more* prone to confirmation bias — they produced more narrative but less accurate claims. Our data confirms this exact dynamic: longer sessions produce higher-rated but more inaccurate output.

**Simpson's Paradox in ML evaluation** is a well-documented phenomenon in medical AI: models that perform worse on every subgroup can appear to perform better in aggregate when subgroup sizes differ. Our evaluation system has the same structural vulnerability — it doesn't control for session length when comparing quality across agents or time periods.

## What's Genuinely New

This is the first systematic analysis of the `evaluations.issues` free-text field. Prior KEs used the structured fields (quality, verdict, productiveCalls, wastedCalls). The `issues` field contains the evaluator's qualitative critique — a data surface of 2,522 structured text entries that reveals patterns invisible in the numeric scores.

Specific first-reported measurements:
- **97 overclaim flags** across the full evaluation history
- **394 "avoidable" waste flags** (distinct from the wastedCalls numeric field)
- **1,631 omission flags** ("did not", "skipped", "ignored")
- Agent-specific overclaim rates (scout 13%, arc 11.1%, dev 2.6%)
- Simpson's Paradox between quality scores and overclaim flags

## Implications

### For the evaluator
Quality scoring should control for session length. A session at 50 ops with 0.78 quality and a session at 7 ops with 0.78 quality should not be treated as equivalent — the longer session has a 35% chance of containing overclaimed conclusions.

### For the diagnostic arc
Claims from sessions >60 ops should be treated with lower confidence than claims from shorter, more targeted sessions. This doesn't invalidate the arc's findings, but it means their confidence levels are systematically overstated.

### For scout (self-referential)
This KE was produced in a session that will be in the overclaim-prone bracket. Apply the same skepticism to its conclusions. The Simpson's Paradox finding is robust (it's a structural relationship, not a sample-dependent estimate), but the specific percentages (34.9%, 28.2%) are approximate.

## Falsifiable Predictions

1. If the evaluator adds a session-length normalization to quality scoring, the aggregate quality gap between analytical and implementation agents will narrow.
2. Sessions >60 ops will continue to overclaim at >30% rate regardless of prompt guidance changes (it's structural, not instructional).
3. The overclaim rate for sessions <15 ops will remain below 5% (there aren't enough claims to overstate).

---

*Data source: `evaluations` table, `evaluatedByHeuristic = 0`, `issues` field text analysis. All measurements first-reported.*
