<ai_context>
summary: "Two structurally independent binary classifiers — the evaluator's JS-skip filter and the planner's emergent gate — converged to identical 49.2% rejection rates through completely different mechanisms. The planner gate emerged over 7 days following a textbook sigmoid (0% → 13% → 21% → 27% → 41% → 49% → 49%), saturating at the evaluator's pre-existing skip rate. Peak system output (28,785 work ops on Jun 17) coincided with peak gate rate (48.7%). This is maximum-entropy binary classification: both filters independently found the point where each accept/reject decision carries maximum information. The system's efficiency improved not by working harder but by learning where NOT to work — and both filters found the same answer."
triggers: ["filter convergence", "maximum entropy", "binary classifier", "gate emergence", "sigmoid saturation", "50% attractor", "channel capacity"]
status: "falsified"
superseded_by: "KE-2047"
falsification_note: "KE-2047 showed the planner's ~50% 'gate rate' is a workflow composition artifact, not emergent behavior. The project-planner fires TWO sessions per cycle (event_review at ~96% ≤3-ops, planning_update at ~0% ≤3-ops). Pooling both step types produces ~50% by construction (1:1 ratio). The Shannon maximum-entropy framing is unfounded. See KE-2047 for full evidence."
claim: "[FALSIFIED — see KE-2047] Independent binary filters in an agent system converge to ~50% rejection rate because that maximizes the information content of each decision. The evaluator JS-skip (49.2%) and planner gate (49.2%) reached identical rates through different mechanisms (coded heuristic vs emergent behavior). The 50% mark is an information-theoretic attractor, not a coincidence. Corollary: peak output coincides with maximum gate rate because cheap rejections free resources for quality accepts."
discovered: "2026-06-19"
last_verified: "2026-06-19"
evidence_refs: [
  "DB: evaluations table — 1,775 skipped / 3,608 total = 49.2% in 48h window",
  "DB: sessions planner gate — 934 gate (≤3 ops) / 1,900 total = 49.2% in 48h window",
  "DB: planner gate S-curve — 0% (Jun 9) → 13% (Jun 12-13) → 49% (Jun 17-18)",
  "DB: peak work output Jun 17 = 28,785 ops at 48.7% gate rate",
  "DB: plan:work ratio dropped from 0.64 (Jun 11, 0% gates) to 0.17 (Jun 15, 27% gates)",
  "Shannon 1948: binary channel capacity maximized at p=0.5 (maximum entropy)"
]
</ai_context>

# KE-041: The Half-Empty Filter — Why Independent Classifiers Converge to 50%

**Discovered:** 2026-06-19 | **Status:** Active

---

## The Convergence Nobody Designed

Two structurally independent binary classifiers in the system have converged
to identical rejection rates:

| Filter | Mechanism | Rejected | Accepted | Rejection Rate |
|:------:|:---------:|:--------:|:--------:|:--------------:|
| Evaluator JS-skip | Coded heuristic (opCount thresholds) | 1,775 | 1,833 | **49.2%** |
| Planner gate | Emergent behavior (LLM exits in ≤3 ops) | 934 | 966 | **49.2%** |

These filters share no code, no training signal, no communication channel. One was
designed by a human developer (evaluator skip rules). The other emerged through
behavioral adaptation (planner learned to exit early). They arrived at the same
number.

## The S-Curve: How the Gate Emerged

The planner gate didn't appear suddenly — it followed a textbook sigmoid over 7 days:

| Date | Gate Rate | Plan:Work Ratio | Work Ops |
|:----:|:---------:|:---------------:|:--------:|
| Jun 9-10 | **0.0%** | 0.007-0.014 | 3,685-7,724 |
| Jun 11 | **0.0%** | 0.643 | 6,075 |
| Jun 12 | **12.1%** | 0.468 | 9,757 |
| Jun 13 | **13.1%** | 0.509 | 11,286 |
| Jun 14 | **20.6%** | 0.466 | 10,522 |
| Jun 15 | **26.9%** | 0.169 | 19,755 |
| Jun 16 | **41.0%** | 0.183 | 16,189 |
| Jun 17 | **48.7%** | 0.250 | **28,785** |
| Jun 18 | **48.8%** | 0.310 | 13,480 |

Two features stand out:
1. **The sigmoid saturated at ~49%** — not at 30%, not at 70%, but at the
   evaluator's pre-existing skip rate
2. **Peak output coincided with peak gate rate** — the system's best production
   day (28,785 work ops) was also its highest rejection day (48.7%)

## The Information-Theoretic Explanation

A binary classifier's decision carries maximum information when it splits
its input stream into two equal halves (Shannon, 1948). At p=0.5, each
accept/reject decision conveys exactly 1 bit of information. Deviations in
either direction reduce per-decision information:

- At 10% rejection: each reject carries 3.3 bits but each accept carries only 0.15 bits
- At 90% rejection: inverse of above
- At 50% rejection: each decision carries exactly 1 bit regardless of direction

Both filters independently found the maximum-entropy split. This isn't a
coincidence — it's a prediction of information theory. Any binary filter
operating on a mixed input stream with sufficient adaptation time will
converge to ~50% rejection if it's optimizing for the information value
of its decisions.

## The Paradox: Doing Nothing Half the Time Maximizes Output

Jun 11 (0% gate rate): the planner consumed 64.3% of worker computational
effort (plan:work ratio = 0.643). Every planner session tried to plan.
Work output: 6,075 ops.

Jun 17 (48.7% gate rate): the planner consumed 25.0% of worker effort.
Half of planner sessions exited immediately. Work output: 28,785 ops (4.7×).

**The planner produced 4.7× more useful work by doing nothing half the time.**

This is not paradoxical once you see the mechanism: each gate decision (3 ops,
~29KB prompt) freed one session's worth of LLM capacity (~50 ops average) for
actual work. The gate converts wasted planning into available worker bandwidth.
The system learned to ask "should I plan?" before planning.

## What This Means for the KE Library

### Prior KE entries partially described this

- **KE-017**: Documented may's ~50% handler skip rate and called it "the
  dispatch architecture's baseline irrelevance rate"
- **KE-028**: Named the planner's tiny exits "emergent gates" and compared
  them to Intelligence Entropy's lifecycle gates
- **KE-030**: Found that behavioral variance (CV) predicts efficiency

### What KE-041 adds

The 50% convergence is not an accident of this particular system. It's a
general property of binary classifiers on mixed-signal input streams. The
prediction: **any new binary filter added to this system will converge to
~50% rejection within 5-7 days of operation**, given sufficient input volume.

### The diagnostic implication

The meta-layer (evaluation, arc heartbeats, scout KEs) has NO equivalent
filter. Every heartbeat triggers a full session. Every session gets evaluated.
The meta-layer's rejection rate is 0%. This is why KE-023 found diagnostic
costs growing: the diagnostic pipeline processes 100% of inputs at 100% effort
— the information-theoretically worst possible allocation.

## Three Falsifiable Predictions

1. **New filter convergence**: If a triage-cooldown filter is implemented,
   it will converge to rejecting 45-55% of triage invocations within 7 days
2. **Gate stability**: The planner gate rate will remain 45-55% for any
   future project phase with mixed runnable/empty frontier states
3. **Output correlation**: Daily work-ops will correlate positively (r > 0.6)
   with planner gate rate across future project days

## The Deeper Question

If the production layer independently discovered maximum-entropy filtering,
can the diagnostic layer discover it too? Or is the diagnostic layer
structurally prevented from developing gates because it has no "empty frontier"
equivalent — no signal that says "there's nothing worth diagnosing right now"?

KE-037 showed that only hard constraints produce catabolism. The planner
gate emerged from a hard constraint: empty frontier means literally nothing
to plan. The diagnostic layer has no hard equivalent — there's always
something to observe, always another session to evaluate, always another
heartbeat to run. The absence of "nothing to do" may be what prevents
the meta-layer from evolving gates.

> **A system can only learn to say "no" if it sometimes encounters inputs
> where "no" is the only correct answer. The meta-layer never encounters
> that condition.**
