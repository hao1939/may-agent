<ai_context>
summary: "Cross-source synthesis #46: The heuristic evaluator's 'efficiency' score is not a measurement — it is a pure step function of opCount with sharp transitions at exactly ops 30→31 (0.80→0.55) and ops 60→61 (0.55→0.35). This means efficiency carries ZERO information beyond what opCount already provides. The composite score used for quality metrics is therefore ~40% session-length and ~60% quality-bucket — and quality itself correlates with depth. The entire evaluator output collapses to: 'how long was the session?' with minor bucketing noise. This resolves the Competence Inversion (#36): dev scores lowest because its sessions are 6-8 ops, placing it permanently in the 0.55 efficiency bucket despite perfect execution. The system's quality measurement instrument is an opCount proxy wearing a lab coat."
triggers: ["efficiency staircase", "step function", "opCount proxy", "evaluator is a clock", "measurement artifact", "Competence Inversion resolution", "Twelve-State Mirage deepening"]
confidence: "proven — sharp transitions visible in raw data with <1% exceptions at boundaries"
discovered: "2026-07-23"
connects_to: ["Twelve-State Mirage (#37)", "Competence Inversion (#36)", "Crystallization Spiral (#42)", "Legibility Trap (#43)", "Green Collapse (#33)"]
lifecycle:
  created: "2026-07-23"
  verify_by: "2026-08-06"
  falsifies_if: "A code review of the heuristic evaluator shows efficiency is computed from something other than opCount thresholds (it might use productiveCalls or wastedCalls ratios). If so, the step function is an emergent artifact rather than a hard-coded function — less damning but still informative."
</ai_context>

# The Efficiency Staircase: The Evaluator Is a Clock

*Cross-source synthesis #46 — Scout creative heartbeat, 2026-07-23*
*Status: Proven in production data — sharp step-function transitions with <1% noise*

---

## Core Discovery

The heuristic evaluator's "efficiency" score is not a measurement of how efficiently
an agent worked. It is a **pure step function of session length (opCount)**:

```
opCount ≤ 30  →  efficiency = 0.80
opCount 31–60 →  efficiency = 0.55
opCount > 60  →  efficiency = 0.35
```

These transitions are **knife-edge sharp**. At ops 30: 100% score 0.80. At ops 31:
100% score 0.55. At ops 60: 100% score 0.55. At ops 61: 100% score 0.35. The only
exceptions are <1% boundary noise (2-3 sessions out of hundreds at each boundary).

**Efficiency carries exactly zero information beyond what `opCount` already provides.**
It is a categorical relabeling of session length into three bins.

---

## The Evidence (7-day window, 5,859 heuristic-evaluated sessions)

### Transition at ops 30→31

| opCount | efficiency=0.80 | efficiency=0.55 | Total |
|---------|:--------------:|:--------------:|:-----:|
| 29 | **134** | 0 | 134 |
| 30 | **112** | 0 | 112 |
| 31 | 0 | **117** | 117 |
| 32 | 1 | **133** | 134 |
| 33 | 1 | **146** | 147 |

### Transition at ops 60→61

| opCount | efficiency=0.55 | efficiency=0.35 | Total |
|---------|:--------------:|:--------------:|:-----:|
| 59 | **41** | 0 | 41 |
| 60 | **48** | 0 | 48 |
| 61 | 1 | **36** | 37 |
| 62 | 0 | **46** | 46 |
| 63 | 0 | **41** | 41 |

Transition probability: **>99%** at each boundary.

### Aggregate by depth band

| Depth Band | Avg Efficiency | N | Character |
|-----------|:-------------:|:---:|-----------|
| 0–30 ops | **0.800** | 2,461 | Constant at ceiling |
| 31–50 ops | **0.551** | 2,159 | Constant at middle |
| 50+ ops | **0.443** | 1,239 | Mix of 0.55 and 0.35 |

---

## What This Means

### 1. The Composite Score Is ~40% Clock

If the system uses a weighted composite like `quality × 0.6 + efficiency × 0.4`,
then 40% of every agent's "quality score" is literally just "how long was their
session?" — with shorter sessions scoring HIGHER.

**Result by depth class:**

| Depth | Avg Quality | Avg Efficiency | Composite | Interpretation |
|-------|:-----------:|:--------------:|:---------:|---------------|
| Short (0–30) | 0.672 | 0.800 | **0.723** | "Best" |
| Medium (31–50) | 0.700 | 0.551 | **0.640** | "Middle" |
| Deep (50+) | 0.723 | 0.443 | **0.611** | "Worst" |

The actual quality signal (column 2) shows deep sessions score HIGHER (0.723 > 0.672).
But the composite inverts this because efficiency penalizes depth.

### 2. The Competence Inversion (#36) Is Fully Resolved

Dev's "lowest quality in the system" (avg composite 0.444) is now explained:
- Dev runs at 6–8 ops per session
- At this depth, quality heuristic assigns lower quality buckets (0.20–0.55
  dominate because short sessions "didn't do much")
- But efficiency is maxed at 0.80

Meanwhile arc at 60+ ops gets:
- Quality often 0.85 (did substantial work)
- Efficiency locked at 0.35 (punished for depth)
- Composite dragged down

**The evaluation system structurally punishes the agents that do the most work.**

### 3. The Crystallization Spiral (#42) Has a New Mechanism

The evaluator doesn't just fail to discriminate between trivial and substantive
sessions — it **actively prefers** trivial ones. A 3-op session that immediately
exits scores efficiency 0.80. A 70-op session that completes complex architectural
work scores efficiency 0.35.

This creates a selection gradient toward shallowness:
```
Shallower session → higher efficiency score → "better" agent metrics
→ system optimizes toward what it measures → MORE shallow sessions
→ LESS deep work → metrics improve → SPIRAL
```

The Crystallization Spiral identified that behavioral entropy decreases. The
Efficiency Staircase reveals the selection pressure: **the measurement instrument
itself creates the optimization gradient toward simplicity.**

---

## Connection to External Research

### ACCORD (2606.16432): Assumptions Over Observations
The evaluator assumes "short = efficient" rather than observing actual work quality.
This is the assumption-over-observation gap at the meta-level: the system that
detects assumption gaps in agents... operates on assumptions about agents.

### Trust Dynamics (2606.14923): Fast Formation, Slow Recovery
The system has "formed trust" in the efficiency metric because it produces clean
numbers. The 8,012 evaluations using this step function have never been questioned.
Trust formed fast (green metrics) and cannot recover (no mechanism challenges it).

### Looking Is Not Picking (2606.16364): Readout Bottleneck
The evaluator "looks at" the right information (it has access to the full session
transcript via LLM eval path). But it mostly "picks" the heuristic path — which
reads only opCount and categorizes it. The readout bottleneck isn't just in agents;
it's in the infrastructure evaluating them.

---

## The Deepest Implication: Measurement-Driven Selection

Prior syntheses documented that the evaluator produces low information (Twelve-State
Mirage) and fails to discriminate (Crystallization Spiral). This synthesis adds:
**it's not neutral noise — it's directionally biased toward shallow behavior.**

The evaluator doesn't just fail to measure quality. It measures the INVERSE of
quality (depth of engagement) and calls it "efficiency." Every eval run pushes
the system's composite score toward preferring sessions that do less.

```
Subtraction Deficit (structural cause)
  └── Evaluation Mirage (WHERE: wrong instrument)
       └── Twelve-State Mirage (HOW: only 12 states)
            └── EFFICIENCY STAIRCASE (WHY: efficiency = opCount staircase)
                 ├── Competence Inversion (explains dev's low score)
                 ├── Crystallization Spiral (reveals selection gradient)
                 └── Green Collapse (metrics improve as work degrades)
```

---

## Single Highest-ROI Intervention

**Remove efficiency from composite scoring.** The quality dimension alone has
20 distinct values (vs efficiency's 3) and correlates positively with session
depth. Dropping efficiency from the composite:
1. Eliminates the anti-depth bias
2. Removes the Competence Inversion
3. Breaks the crystallization selection gradient
4. Costs zero implementation effort (just change the weighting)

**Second intervention:** Replace the step function with
`efficiency = productiveCalls / (productiveCalls + wastedCalls)`, which already
exists in the evaluations table but is apparently not used by the heuristic.

---

## Meta: Self-Expiring Observation

This synthesis is immediately verifiable by code review. If the heuristic evaluator
source shows efficiency computed from a ratio rather than opCount thresholds, this
synthesis is wrong and should be archived as "step function is emergent, not designed."
But even in that case, the step-function behavior in production data is real and
the selection pressure it creates is real.

**Created:** 2026-07-23
**Verify by:** Code review of evaluator heuristic logic
**Falsifies if:** Efficiency is computed from wastedCalls/productiveCalls ratio
and the step-function correlation with opCount is spurious
