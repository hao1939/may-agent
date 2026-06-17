# The Twelve-State Mirage

**Cross-source synthesis #37** — Scout creative heartbeat, 2026-07-21
**Status:** New discovery from fresh production data + information theory

## Core Discovery

The system's primary quality measurement instrument — the heuristic evaluator
that handles **95.3% of all evaluations** — is a **12-state automaton**. It can
only produce 12 distinct output combinations. Each evaluation carries **2.875
bits** of information — less than three coin flips.

The system spends **36.2% of total compute** (179,903 ops out of 497,361) running
the evaluator. The total information produced is **~5.5 KB**.

**179,903 ops to produce 5.5 KB of information = 32,710 ops per KB.**

## The Evidence

### The 12 States

Query: all heuristic (non-LLM) evaluations with quality > 0, grouped by
(quality, efficiency, verdict):

| Quality | Efficiency | Verdict | Count | % of All |
|---------|-----------|---------|-------|---------|
| 0.65 | 0.80 | acceptable | 3,507 | 26.4% |
| 0.85 | 0.80 | good | 3,272 | 24.6% |
| 0.85 | 0.55 | good | 1,810 | 13.6% |
| 0.55 | 0.80 | needs_improvement | 1,311 | 9.9% |
| 0.65 | 0.55 | acceptable | 968 | 7.3% |
| 0.20 | 0.80 | needs_improvement | 913 | 6.9% |
| 0.20 | 0.55 | needs_improvement | 515 | 3.9% |
| 0.65 | 0.35 | acceptable | 429 | 3.2% |
| 0.85 | 0.35 | good | 267 | 2.0% |
| 0.55 | 0.55 | needs_improvement | 176 | 1.3% |
| 0.20 | 0.35 | needs_improvement | 61 | 0.5% |
| 0.55 | 0.35 | needs_improvement | 51 | 0.4% |

**Total: 13,280 evaluations across exactly 12 output states.**

The heuristic uses exactly 4 quality values {0.20, 0.55, 0.65, 0.85} and
3 efficiency values {0.35, 0.55, 0.80}. Verdict is deterministic from quality
(≥0.85 → good, ≥0.65 → acceptable, <0.65 → needs_improvement), so it carries
zero additional information. The actual output space is 4×3 = 12.

### Contrast: LLM Evaluator

The LLM evaluator (4.7% of evaluations, 651 total) produces **449 distinct
output states**. It has genuine discriminative power. But it processes less
than 1 in 20 evaluations.

### Information-Theoretic Calculation

Shannon entropy of the heuristic output distribution:

```
H = -Σ p_i × log₂(p_i)
  = -(0.264×-1.92 + 0.246×-2.02 + 0.136×-2.88 + 0.099×-3.34 + ...)
  = 2.875 bits per evaluation
```

For context:
- A coin flip = 1 bit
- Heuristic evaluation = 2.875 bits (< 3 coin flips)
- Maximum possible (12 uniform states) = 3.58 bits
- LLM evaluation ≈ 8.81 bits (449 states)

Total information produced by entire evaluator:
- Heuristic: 13,280 × 2.875 bits = 38,180 bits = **4.77 KB**
- LLM: 651 × ~8.81 bits = 5,733 bits = **0.72 KB**
- Combined: **~5.5 KB**

Cost to produce: **179,903 ops** (36.2% of all system compute)

## Why This Matters

### 1. The Metric System Is Structurally Blind

When every session gets one of 12 possible evaluations, no metric computed from
those evaluations can detect changes finer than 12 categories. The "quality
trend" is actually a categorical histogram — not a continuous signal. Averaging
these values produces false precision: an agent's "average quality of 0.644"
could only have been produced by a specific mix of 0.20/0.55/0.65/0.85 values.
The decimal places are noise from mixing categorical outputs.

### 2. The Competence Inversion Is an Artifact

Prior synthesis #36 found that more reliable agents score lower quality. This
is now explained: dev's sessions are short (avg 8.3 ops), and the heuristic
maps short sessions to lower quality categories. The anti-correlation between
reliability and quality is a **measurement artifact of a 4-level categorical
scale**, not a real property of the system.

### 3. The Green Collapse Is Impossible to Detect

The Green Collapse (synthesis #33) named the state where every metric reads
healthy while productive output shrinks. With only 12 output states, the
evaluator literally cannot distinguish between "productive session that did
good work" and "coordination session that looked busy." Both get quality=0.85,
efficiency=0.80 if they exceed the heuristic thresholds.

### 4. The Evaluation Mirage Has a Quantitative Floor

The Evaluation Mirage (prior synthesis) documented that evaluator output has low
information content. The Twelve-State Mirage **quantifies** it: 2.875 bits is
the floor. No amount of accumulation can extract more signal from an instrument
that produces less than 3 bits per measurement.

## The Thermometer Analogy

This is equivalent to measuring temperature with a thermometer that can only
read four values: "cold" (0.20), "cool" (0.55), "warm" (0.65), "hot" (0.85).
You can read it 13,000 times and compute an average to 12 decimal places, but
the precision is illusory — you still only know whether it was cold, cool, warm,
or hot.

The evaluator sessions (~20 ops each) are the cost of walking to the thermometer
and reading one of four values. The system does this 13,280 times.

## Cross-Source Connections

### Internal Synthesis Chain

```
Evaluation Mirage → "evaluations don't discriminate" (qualitative)
  └── Twelve-State Mirage → "exactly 12 states, 2.875 bits" (quantified)
        ├── Explains Competence Inversion (artifact of 4-level scale)
        ├── Explains Green Collapse invisibility (12 states can't detect it)
        ├── Provides floor for Governance Amplifier (amplifying noise)
        └── Supports Compilation Threshold (evaluator is deterministic)
```

### External Research

- **SkillAudit (2606.14239)**: Paired trajectory comparison achieves 73.9%
  reward *ground-truth-free*. Comparing two sessions is more informative than
  scoring one session on a 12-state scale.
- **MemTrace (2606.17328)**: Knowledge-point evaluation (is the fact used?)
  produces binary signal per knowledge item — 1 bit per item, but relevant bits.
  Better than 2.875 non-specific bits.
- **Intelligence Entropy (S(t)=S₀·e^αt)**: The evaluator's own entropy is fixed
  at 2.875 bits — it cannot measure system entropy growth because its own
  resolution is below the signal it needs to detect.

## Quantified Impact

### What 5.5 KB of information costs

| Resource | Amount | What it could buy |
|----------|--------|-------------------|
| Evaluator ops | 179,903 | 4,497 productive dev sessions |
| % of system | 36.2% | ~9 more scout sessions/day |
| LLM evaluations | 651 real evals | If all 13,931 were LLM: ~122 KB of information |

### Three interventions by ROI

1. **Skip heuristic evaluations entirely** — saves 13,280 × ~12 ops = ~159,000
   ops. Information loss: 4.77 KB (nearly zero actionable signal). This is the
   single highest-ROI change available.

2. **Replace heuristic with LLM for top 10% of sessions** — spend 1,393 LLM
   evaluations (vs current 651), produce ~12 KB of information. Net cost increase:
   ~28,000 ops. Net information increase: ~7 KB. **2.5× more info at 15% cost.**

3. **Replace heuristic with binary gate** — "did this session produce an
   artifact?" is 1 bit but 1 *relevant* bit. A binary evaluation costs 0 ops
   (check at session end). 13,280 binary evaluations = 13,280 bits = 1.66 KB.
   **30% of the information at 0% of the cost.**

## Falsification Conditions

1. If the heuristic is modified to produce >12 distinct output states and the
   agent quality rankings change, this thesis is confirmed (current rankings
   are artifacts of binning).
2. If removing heuristic evaluations produces no measurable quality regression,
   the "5.5 KB total information" claim is validated.
3. If replacing heuristic with LLM for top-decile sessions changes quality
   metrics by >0.1 points, the information-density thesis is confirmed.

## Meta

This synthesis was discovered from raw DB queries during a creative heartbeat.
The 12-state structure is not visible from summary metrics — it requires
examining the joint distribution of (quality, efficiency) values across the
full evaluation corpus. This is itself an example of the Verification Inversion:
the system's output-focused evaluation never examines the evaluator's own
output distribution.

**The evaluator has never evaluated itself.**

---

*Created: 2026-07-21 | Source: Production DB (evaluations table, 18,250 rows) |
Connected to: Evaluation Mirage, Competence Inversion, Green Collapse,
Compilation Threshold, Governance Amplifier*
