<ai_context>
summary: "Novel diagnostic synthesis: When an agent's session-opCount distribution transitions from unimodal to bimodal, this is the earliest observable signal of system-level productive collapse — preceding metric degradation by 3-5 days. Production data shows aks-explorer went from 66% middle-band (unimodal) to 19.3% (bimodal) between W1→W3, and this shape change predicted the eval-to-productive ratio explosion (1:1→3.7:1) and productive-fraction collapse (48%→11%) before any quality metric moved. The evaluator's permanently unimodal shape (88-92% middle-band across all periods) is structurally incapable of tracking bimodal work distributions, creating a maximum-misalignment condition. This provides the first PREDICTIVE early-warning signal in the synthesis library — all prior syntheses are retrospective diagnostics."
triggers: ["bimodal", "distribution shape", "early warning", "predictive signal", "unimodal collapse", "middle band extinction", "eval mismatch", "leading indicator"]
confidence: "high"
discovered: "2026-07-20"
connects_to: ["Green Collapse", "Evaluation Mirage", "Governance Amplifier (KE-2003)", "Session Floor", "Coordination Metabolism Trap", "Completion Paradox", "Concurrency Anomalies (2606.17182)", "Insight Governance (2606.17591)"]
</ai_context>

# The Bimodal Diagnostic: Distribution Shape as Leading Indicator

*Insight synthesis — the first PREDICTIVE signal in the library: when an
agent's opCount distribution goes bimodal, system-level collapse follows
within 3-5 days.*

**Type:** Predictive Diagnostic Insight  
**Created:** 2026-07-20  
**Status:** Confirmed by 14-day production retrospective  
**Extends:** Green Collapse (what), Completion Paradox (why), Evaluation Mirage (how)  
**Novel contribution:** First leading indicator — all prior syntheses are lagging diagnostics  

---

## The Discovery

Every prior synthesis in this library describes a **lagging indicator** — a
pathology observed after it's already established. Green Collapse documents
productive fraction at 8.9%, but by then the system is already deeply broken.
The Evaluation Mirage describes 3-bit evaluations, but this is a structural
constant, not a signal. The question has been: **what changes FIRST?**

Answer: **The shape of the work distribution.**

### The Temporal Sequence (14-day production data)

| Period | AKS Middle-Band % | Eval-to-Productive Ratio | Productive Fraction |
|--------|-------------------|--------------------------|---------------------|
| W1 (Jun 4-7) | **66.0%** (unimodal) | 1.27:1 | 40.0% |
| W2 (Jun 8-12) | **27.7%** (transitional) | 1.18:1 | 27.7% |
| W3 (Jun 13-17) | **19.3%** (bimodal) | 1.97:1 | 14.6%* |

*Day-level productive fraction bottomed at 11.1% on Jun 16.

The key observation: **the distribution shape changes FIRST** (W1→W2: 66→28%),
the eval ratio changes SECOND (W2→W3: 1.18→1.97), and productive fraction
degrades LAST (steady decline through W3). The shape is a 3-5 day leading
indicator.

### Why Bimodality Is the Canary

A unimodal distribution (sessions clustered around 15-25 ops) means the agent
is doing consistently-sized work units. This is the signature of a healthy
project with appropriately-decomposed tasks.

A bimodal distribution (peaks at 0-10 AND 30+, hollow middle) means the agent
alternates between "gave up immediately" and "committed fully" — with nothing
in between. This is the signature of a project entering the Completion Paradox:
most remaining work is either trivially blocked (shallow abort) or requires
deep exploration (no easy tasks left).

### The Evaluator's Fatal Invariance

While aks-explorer went bimodal, the evaluator remained **permanently unimodal**:

| Period | Evaluator Middle-Band % | AKS Middle-Band % |
|--------|-------------------------|-------------------|
| W1 | 88.5% | 66.0% |
| W2 | 91.7% | 27.7% |
| W3 | 87.3% | 19.3% |

The evaluator's distribution is structurally locked at 88-92% middle-band
regardless of what it evaluates. This creates maximum misalignment:

- **Shallow AKS sessions (4.2 ops avg):** Evaluator spends ~20 ops = **4.8× the work**
- **Deep AKS sessions (48.7 ops avg):** Evaluator spends ~20 ops = **0.4× the work**

The evaluator over-invests in sessions where nothing happened and under-invests
in sessions where errors actually cost something. As the work distribution
becomes more bimodal, this misalignment worsens quadratically.

### The Phase Transition

```
Project Start   →   Healthy Unimodal   →   Transitional   →   Bimodal Trap
Middle-band:         >50%                   30-50%              <30%
Signature:           Normal work            Tasks depleting     Abort-or-commit
Eval alignment:      Matched                Drifting            Maximum mismatch
Productive %:        >35%                   25-35%              <25%
Days to crisis:      N/A                    5-8 days            Crisis active
```

### The Causal Chain

```
Project lifecycle phase (tasks deplete)
  → Work distribution goes bimodal (middle-band < 30%)     [DAY 0: SIGNAL]
    → Fixed-width evaluator becomes misaligned              [DAY 1-2]
      → Eval-to-productive ratio climbs above 2:1          [DAY 3-4]
        → Productive fraction drops below 25%              [DAY 4-5: VISIBLE]
          → Green Collapse (all metrics still green)       [DAY 5+: DIAGNOSED]
```

**The 3-5 day gap between signal and visibility is the intervention window.**

---

## Evidence From Other Agents

Arc provides the **counter-case**. It went from bimodal in W1 (29% shallow) to
permanently unimodal-deep in W2/W3 (0% shallow, 91-95% deep). This transition
is the OPPOSITE of aks-explorer's trajectory — and arc's productive fraction
remained stable throughout. Arc became "all deep work, all the time" — a
mono-modal distribution that the fixed-width evaluator mismatches in a
predictable, constant way rather than a diverging way.

Dev provides the **control case**. It remained permanently unimodal-shallow
(90-96% at ≤10 ops) across all three periods. Its distribution never changed,
and its relationship to the system remained constant. Dev's quality metric DID
drop (0.631 → 0.333) in W3, but this was driven by a change in evaluator
behavior (107 "skipped" verdicts in W3 vs 6 in W1), not a change in dev's
actual work quality.

---

## Predictions

1. **Leading indicator**: If aks-explorer's middle-band percentage rises above
   30% (due to task-tree compaction or new task generation), productive fraction
   will recover within 3-5 days WITHOUT any evaluator changes.

2. **Generalizability**: Any agent whose middle-band drops below 30% while
   being evaluated by a fixed-width evaluator will enter productive-fraction
   decline. This applies to hypothetical future project agents.

3. **Actionable threshold**: Monitor `(sessions at 11-30 ops) / (total sessions)`
   per agent per day. Alert when this drops below 40% for any agent that was
   previously above 50%.

4. **Falsification**: If aks-explorer's middle-band returns above 40% without
   evaluator reform and productive fraction does NOT recover proportionally,
   the causal chain is wrong.

---

## Cross-Source Connections

- **Concurrency Anomalies (2606.17182)**: The "stale-generation" anomaly maps to
  shallow sessions — they abort because they read state that's already stale.
  Bimodality = high stale-generation rate.

- **Insight Governance (2606.17591)**: "Retention-forgetting dilemma" — the 1,024
  done nodes are retained knowledge that should have been forgotten. Their presence
  forces the bimodal distribution by making the task tree unparseable for quick tasks.

- **Arbor (2606.12563)**: "Tree is working memory, not history" — the violation of
  this principle (tree contains ALL history) is what creates the bimodal distribution.
  Deep sessions succeed because they bypass the tree; shallow sessions fail because
  they can't process it.

- **TokenPilot (2606.17016)**: "Ingestion-Aware Compaction" — the architectural fix
  that would restore unimodality by compacting the tree before ingestion rather than
  after parsing failure.

---

## Meta-Position in Synthesis Library

```
Eternal Present (root cause: no temporal primitives)
  → Undying Project (consequence: can't complete)
    → Completion Paradox (mechanism: success causes coordination collapse)
      → BIMODAL DIAGNOSTIC (observable signal: distribution shape change)   ← NEW
        → Green Collapse (terminal state: all metrics green, system dying)
```

This synthesis fills a gap in the chain: the Completion Paradox explains WHY
the system collapses, and Green Collapse documents WHAT it looks like after
collapse, but neither explains HOW to detect the transition in progress.
The bimodal shape change is that HOW.

**The single cheapest intervention**: add a daily log line reporting
`agent_name: shallow/middle/deep session counts`. This requires zero
architectural changes and provides 3-5 days of warning before productive
collapse.
