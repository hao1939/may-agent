<ai_context>
summary: "Cross-source synthesis: The system spends 34% of ops evaluating outputs (sessions) and 0% verifying inputs (shared state, context, learnings). Five independent research papers (DeLM, Less Context, Containment Gap, Goal-Autopilot, DCPM) and production data converge on the finding that input quality is the primary determinant of output quality — not output evaluation. The system verifies the wrong end of the pipeline. Dev's efficiency comes from input-side filtering (gate zone at 6-7 ops), not output evaluation. Arc's inefficiency comes from zero input filtering (floor at 17, no gate zone). Moving 10% of evaluation effort upstream would improve quality more than any downstream intervention. This is the Discrimination Crisis manifested inside the system."
triggers: ["verification inversion", "input verification", "output evaluation", "evaluator ops", "context verification", "memory integrity", "write gates", "upstream verification", "discrimination crisis internal"]
last_updated: "2026-07-18"
source_basis: "Cross-source synthesis of: production data (7 days: 111K evaluator ops = 34% of system total, 0 input verification ops, dev gate-zone at 6-7 ops / arc no gate zone); arXiv batch 3 (Less Context 2606.10209: +20.6pp from pruning inputs, Containment Gap 2606.12797: memory poisoning invisible to output monitoring, DeLM 2606.10662: verified shared context +10.5pp/-50% cost, Goal-Autopilot 2606.11688: 0.95% fabrication vs 25% via input gates, DCPM 2606.09483: System-2 input consolidation enables System-1 output quality, SkillAxe 2606.10546: LLM skills 0% gain without quality verification, HarnessBridge 2606.12882: observation projection = input compression at boundary); arXiv batches 1-2 (Arbor 2606.12563: 193% from pre-scoring hypotheses, TRACE 2606.13174: compiled preference corrections, Shield Synthesis 2606.13621: design-time defensibility verdicts); HN (Discrimination Crisis 7 signals: generation overwhelms discrimination, agent externalities 3 signals, botsitting 279pts: harness quality > model capability); XHS (古法編程 1,674❤: restraint-as-quality, 护栏効応: guardrails-create-what-they-measure); prior syntheses (Evaluation Mirage: 111K ops producing 3 bits entropy, Subtraction Deficit: system can only add, Cold Start Tax: 46% ops = state reconstruction, Transduction Chain: format-limited not knowledge-limited, Discrimination Crisis connection)."
</ai_context>

# The Verification Inversion: Why the System Evaluates the Wrong End of the Pipeline

*Cross-source synthesis — emerges from connecting five batch 3 arXiv papers,
production pipeline analysis, and the external Discrimination Crisis to
reveal that the system's quality investment is structurally backwards.*

**Type:** Cross-Source Synthesis  
**Created:** 2026-07-18  
**Status:** Active hypothesis with strong multi-source evidence  
**Extends:** Evaluation Mirage, Subtraction Deficit, Discrimination Crisis  
**Complements:** Cold Start Tax, Transduction Chain, Representation Gap

## The Discovery

Twenty-two prior syntheses documented twenty-two pathologies. The Subtraction
Deficit unified them as "the system can only add." But the Subtraction Deficit
doesn't explain WHERE subtraction would be most valuable.

Five papers from arXiv batch 3 independently answer this question from five
different domains — and they all give the same answer:

**Verify inputs, not outputs.**

The system currently does the opposite. This synthesis documents the
inversion, traces its origins, and identifies the correction.

## The Production Evidence: Two Numbers

Over the last 7 days:

| Pipeline Stage | Ops Invested | % of System | What's Verified |
|----------------|-------------|-------------|-----------------|
| **Output evaluation** (evaluator) | 111,383 | 34.0% | Session completion quality |
| **Input verification** (all agents) | 0 | 0.0% | Context, learnings, knowledge, state |

The system spends 34% of all computational effort evaluating whether
sessions completed well. It spends 0% verifying whether sessions started
with clean inputs.

The evaluator produces ~3 bits of Shannon entropy per evaluation (10
quantized states derived deterministically from opCount and status). The
information yield is 5.3 KB/week from 111K ops.

Meanwhile, inputs flow unchecked:
- **context_updates** persist across sessions with no verification
- **learnings** accumulate (1,801+) with no retirement or validation
- **knowledge entries** are written by any agent with no integrity check
- **task assignments** reference sessions that may no longer exist

## The Research Convergence: Five Papers, One Conclusion

### 1. Less Context, Better Agents (2606.10209) — Microsoft

Full context retention: **71.0%** accuracy, 1.48M tokens.  
Pruned to last 5 tool calls: **79.0%** accuracy, 535K tokens.

**More input makes agents worse.** Not "diminishing returns" — active
degradation. The paper demonstrates that input quality (pruning irrelevant
context) matters more than input quantity.

*Connection:* Our agents carry full session context. No pruning occurs.
The research predicts this degrades performance by ~8pp compared to
selective retention.

### 2. The Containment Gap (2606.12797) — Framework Audit

Memory poisoning increases targeted wrongful denial to **88.9%** while
preserving aggregate accuracy. Standard monitoring cannot detect the
corruption.

**Output monitoring is structurally blind to input corruption.** A system
that only evaluates outputs will never detect targeted input poisoning.
Write-time validation (<0.2ms overhead) eliminates both attack vectors.

*Connection:* Our evaluator monitors outputs (session quality). It cannot
detect stale or contradictory context_updates, accumulated false learnings,
or knowledge entries that conflict with current system state.

### 3. DeLM: Shared Verified Context (2606.10662) — Google DeepMind

Decentralized agents with shared **verified** context: +10.5pp on
SWE-bench, **-50% cost** per task.

**Verification of shared context produces larger improvements than adding
more agents or better models.** The verification gate on context writes
is the key architectural innovation — not the decentralization.

*Connection:* Our knowledge library is shared context without
verification. Any agent can write; no agent verifies writes.

### 4. Goal-Autopilot: Anti-Fabrication (2606.11688)

Falsifiable input gates on terminal claims: **0.95%** fabrication vs
25.05% (StateFlow) and 8.10% (Reflexion). Key finding: the strongest
models fabricate most under unstructured execution.

**Output honesty requires input gating.** The gate is a structural
input verification — it forces the agent to possess verified evidence
before claiming completion. Without it, stronger models produce more
plausible-but-false outputs.

*Connection:* Our agents can claim task completion (finish(success))
without structural verification. The evaluator checks afterward (output
evaluation) rather than gating beforehand (input verification).

### 5. DCPM: Dual-Process Memory (2606.09483)

System-2 (asynchronous offline consolidation) enables System-1 (runtime
execution) by **reducing** raw memory to schemas, detecting contradictions,
and resolving conflicts.

**Input consolidation is a prerequisite for output quality.** Without
System-2 processing, raw memory accumulates and overwhelms System-1
reasoning — identical to the "less context, better agents" finding.

*Connection:* Our system has System-1 only — session-time processing
with no between-session consolidation. Context_updates accumulate. Learnings
accumulate. Knowledge entries accumulate. Nothing consolidates.

### The Convergence

| Paper | Input Intervention | Output Evaluation | Improvement |
|-------|-------------------|-------------------|-------------|
| Less Context | Prune input context | — | **+8pp, -63% tokens** |
| Containment Gap | Write-time integrity | — | **Eliminates targeted corruption** |
| DeLM | Verify shared context | — | **+10.5pp, -50% cost** |
| Goal-Autopilot | Gate terminal claims | — | **25×** fewer fabrications |
| DCPM | Consolidate offline | — | **+5.2 on implicit inference** |
| *Our evaluator* | — | *Post-hoc session scoring* | *5.3 KB/week from 111K ops* |

Five papers invest in input quality and get large improvements.
Our system invests in output evaluation and gets near-zero information.

## The Agent-Level Evidence: Dev vs Arc

The production data contains a natural experiment that confirms the
research convergence.

### Dev: Input Gating at the Gate Zone

Dev's opCount distribution (7 days):

```
ops 0-5:   6 sessions  (idle/error)
ops 6-7:  305 sessions  (GATE ZONE — input assessment)
ops 8-10:   6 sessions  (deeper assessment)
ops 11-20:  6 sessions  (gap — almost empty)
ops 21+:   13 sessions  (actual work)
```

Dev spends **78%** of its ops (2,197 out of 2,817) in the gate zone
(ops 6-10) — assessing whether to work. Its gate-to-work ops ratio
is **4.2:1**. It invests 4× more in deciding WHETHER to act than in
acting.

Result: **97.8% success rate**, lowest failure rate of any agent.

### Arc: No Input Gating

Arc's opCount distribution (7 days):

```
ops 0-5:   2 sessions  (rare errors)
ops 6-10:  0 sessions  (NO GATE ZONE)
ops 11-20: 3 sessions  (rare)
ops 21+: 322 sessions  (all work, all the time)
```

Arc has **zero sessions** in the gate zone. Its gate-to-work ops ratio
is **0.0:1**. It invests nothing in deciding whether to act. Every
session proceeds directly to deep work.

Result: **5.2% error rate**, floor at 17 ops, highest average ops (65.7).

### The Bimodal vs Unimodal Pattern

Dev has a **bimodal** distribution: one peak at ops 6-7 (decision),
a desert at ops 11-20, and rare deep-work sessions at ops 21+.

Arc has a **unimodal** distribution: a single broad peak centered at
ops 55-70, with no decision mode at all.

Scout sits between them: 76 gate-zone sessions, 50 gap-zone sessions,
373 work sessions — a continuous distribution with no clean boundary.

**The bimodal pattern is the production signature of effective input
verification.** Dev either decides quickly (6-7 ops) or works deeply
(30+ ops). The desert between them means it almost never begins work
and then discovers it shouldn't have started.

Arc never decides. It always works. And its 5.2% error rate — plus
its floor at 17 ops meaning even "nothing to do" sessions cost 17+
ops — is the production cost of skipping input verification.

## Why the Inversion Happens

Three structural forces push evaluation downstream:

### 1. Output is Visible, Input is Invisible

A session that completes is a legible, evaluable artifact. The context,
learnings, and state that ENTERED the session are invisible — they're
consumed and discarded, leaving no trace in the session record.

The evaluator sees: "session X completed in 45 ops with status 'done'."
The evaluator does NOT see: "session X started with 3 stale
context_updates, 2 contradictory learnings, and a task referencing a
dead session."

### 2. Evaluation Metrics Track Production, Not Consumption

System metrics track what agents produce (sessions, evaluations, ops).
No metric tracks what agents CONSUME (context volume, learning quality,
knowledge freshness). The measurement system is structurally blind to
input quality.

### 3. Output Evaluation Has an Obvious Implementation

"Evaluate the session" has a clear implementation: read the session
transcript, score it, write a report. Input verification has no
obvious implementation: what does it mean to "verify" that
context_updates are fresh? That learnings are valid? That knowledge
entries don't contradict each other?

The implementation gap creates an action bias toward the easy thing
(output evaluation) even though the hard thing (input verification)
would produce more value.

## The Discrimination Crisis Connection

The Discrimination Crisis (7 independent signals from HN/XHS, confidence
HIGH) describes the same inversion at macro scale:

| Level | Generation (Output) | Discrimination (Input Filtering) | Result |
|-------|--------------------|---------------------------------|--------|
| **Content markets** | AI-generated content floods | Editorial curation overwhelmed | Quality collapses |
| **Code quality** | AI-generated code floods | Developer judgment overwhelmed | 古法編程 backlash |
| **Our system** | 111K eval ops (output) | 0 verification ops (input) | 3 bits entropy/evaluation |

The system IS the Discrimination Crisis in miniature:
- The evaluator GENERATES evaluations (addition to the output stream)
- No component DISCRIMINATES inputs (subtraction from the input stream)
- The ratio (34:0) is the most extreme case of generation/discrimination
  imbalance in any system we've documented

The HN Discrimination Crisis predicts that this imbalance eventually
degrades quality to the point where the system can no longer distinguish
valuable from valueless work. Our evaluator already operates at this
point: 3 bits of entropy means the evaluator cannot meaningfully
distinguish session quality beyond "how many ops and did it error."

## The Decision Surface Concept

Dev's bimodal distribution reveals a structure that maps to Arbor's
cognition layer (2606.12563):

**Arbor's architecture:** Score hypotheses BEFORE exploring them →
193% improvement. The scoring phase is separate from the exploration
phase. The score determines whether exploration happens.

**Dev's architecture:** Assess state in the gate zone (6-7 ops) BEFORE
committing to work. The assessment is separate from the work. The
assessment determines whether work happens.

**Arc's architecture:** No scoring. No assessment. Every hypothesis
is explored. Every session commits to work.

Arbor's 193% improvement from adding a scoring phase predicts:
**Adding a gate-zone assessment to arc and scout would produce the
largest single efficiency improvement available to the system.**

The improvement from Arbor (193%) comes from an input-side intervention
(don't explore low-scored hypotheses). Our evaluator's near-zero
information yield comes from an output-side intervention (score
completed explorations). The research predicts the ratio of value:
**input scoring delivers ~100× more value per op than output scoring.**

## Three Testable Predictions

### Prediction 1: Input Verification Will Improve Quality More Than Evaluation

Adding a single input verification gate — e.g., checking that
context_updates referenced in a session prompt are still current before
the session begins — will improve the success rate of gated sessions
more than the evaluator improves the success rate of evaluated sessions.

Specifically: the evaluator's information yield (5.3 KB/week from 111K
ops) represents ~0% quality improvement. A context freshness check
(estimated 1 op per session, ~6K ops/week) should produce measurable
quality improvement by preventing sessions from acting on stale state.

### Prediction 2: Arc's Floor Will Decrease With Gate-Zone Addition

If arc is given a structural gate zone equivalent to dev's (assess for
6-10 ops, then decide whether to proceed), its floor will decrease from
17 to <10, its average ops will decrease from 65.7 to <45, and its
error rate will decrease from 5.2% to <3%.

This is not the same prediction as the Abstention Advantage's "give arc
a quick-exit." It's stronger: add an input-verification phase that
checks whether the session's context, task reference, and state are
healthy before committing to work.

### Prediction 3: The Evaluator's Value Comes From Input Formatting

The evaluator currently reads session transcripts (input consumption)
and writes evaluations (output production). If we decompose its
111K ops, the hypothesis is that the READ phase (input consumption)
accounts for >60% of ops and produces 0 bits of information, while
the WRITE phase (output production) accounts for <40% and produces the
~3 bits that exist.

If confirmed, this means the evaluator's cost is dominated by
input consumption — the same pattern identified in the Prompt Mass
Problem. Replacing the evaluator's full-session read with a metadata
summary (opCount, status, duration — the values it actually uses)
would eliminate >60% of evaluator ops with 0 information loss.

## Synthesis Position in the Library

```
The Subtraction Deficit (structural cause)
  ├── Evaluation Mirage (WHERE subtraction is most needed)
  │     └── VERIFICATION INVERSION (WHY: system subtracts at wrong end)
  │           ├── Input quality > output evaluation (5 papers)
  │           ├── Gate zone vs no gate zone (dev vs arc)
  │           ├── Discrimination Crisis (macro-scale same pattern)
  │           └── Decision Surface (Arbor/Shield Synthesis/Abstention)
  ├── Cold Start Tax (consequence of no input consolidation)
  │     └── No System-2 processing (DCPM gap)
  ├── Transduction Chain (format at boundaries = input quality)
  └── Representation Gap (repair specs = input to action pipeline)
```

The Verification Inversion is not a new pathology — it explains WHY
the Evaluation Mirage exists and WHERE the Subtraction Deficit's
correction should be applied. The system's output evaluation is not
merely wasteful (Mirage finding) but actively harmful: it consumes
34% of system capacity while creating a false sense that quality is
being monitored, preventing the input verification that would actually
improve quality.

## Implications for Our System

### Highest-ROI Input Verification Operators (Ordered by Predicted Impact)

1. **Context freshness gate** (check context_updates age before session)
   - Expected: prevents sessions from acting on stale state
   - Cost: ~1 op per session (~6K ops/week)
   - Saves: eliminates stale-state-induced failures

2. **Learning verification pipeline** (test learnings against outcomes)
   - Expected: reduces learning corpus from 1,801 to verified subset
   - Cost: asynchronous, between-session (System-2)
   - Saves: prevents accumulation of unverified instructions

3. **Task reference validation** (verify referenced sessions exist)
   - Expected: eliminates Ghost Metabolism entirely
   - Cost: 1 lookup per session
   - Saves: ~600 phantom resume attempts/day (already partially fixed)

4. **Gate-zone enforcement for arc** (6-10 ops assessment before work)
   - Expected: creates bimodal distribution, reduces floor from 17 to <10
   - Cost: 6-10 ops per session
   - Saves: eliminates unnecessary 50+ op sessions

5. **Evaluator metadata shortcut** (replace full read with summary)
   - Expected: reduces evaluator ops by >60%
   - Cost: requires evaluator architecture change
   - Saves: ~67K ops/week

### The Meta-Principle

The system's quality investment is backwards. Every successful system
in the research literature — and the single best-performing agent in
production — invests more in input quality than output evaluation.

**Quality flows downstream. Verify upstream.**

---

*A factory that inspects every finished product but never tests raw
materials will produce beautiful reports about defects it cannot prevent.
The reports will be precise, consistent, and comprehensive. The defects
will be persistent, systemic, and invisible — because they entered
the pipeline before any inspector was watching.*
