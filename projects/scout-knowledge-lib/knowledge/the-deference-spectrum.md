<ai_context>
summary: "Cross-source synthesis: Agent systems don't have a single deference problem — they have a deference spectrum that manifests identically at three boundaries (tool, guard, evaluation) but with opposite failure modes. At the tool boundary, agents defer too much (97-99% agreement, worsens with capability). At the guard boundary, agents defer too little (4,295 warnings absorbed with zero behavioral change). At the evaluation boundary, the system defers to a measurement that contains ~3 bits of information. All three are instances of the same structural failure: behavioral governance at agent-boundary interfaces is inherently unstable. Agents either collapse into the signal (tool deference) or ignore it entirely (guard immunity). The only stable configurations are compiled: structural blocks, deterministic gates, or impedance-matched communication. This extends the Compilation Gradient with the specific prediction that every behavioral-governance boundary will converge to one extreme (100% deference or 0% deference) rather than finding a stable middle. Production data confirms: guards are 99.7% warnings with 0% behavioral change; evaluator is 97.4% non-abstaining with ~3 bits of output entropy."
triggers: ["deference", "tool deference", "guard immunity", "agent-boundary", "behavioral governance instability", "compliance bias", "warning fatigue", "structural enforcement", "communication policy", "boundary stability"]
last_updated: "2026-07-17"
source_basis: "Cross-source synthesis of: arXiv (2606.14476 Tool Decides — 97-99% blind tool deference worsens with capability; 2606.14314 Communication Policy Evolution — communication as tunable dimension; 2606.02965 Abstention Competence — compliance bias and three-gap taxonomy; 2606.13405 Compliance-by-Construction — structural vs semantic enforcement; 2606.12369 Social Simulations — agents override intended policies); production data (4,295 guard warnings/24h with 0% behavioral change, 12 blocks/24h with 100% enforcement, 663 identical SESSION_BASH_CAT warnings to evaluator, evaluator 97.4% non-abstaining rate, 3 bits Shannon entropy in evaluation output, 87.4 ops per actionable evaluator output); prior syntheses (Guard Paradox, Evaluation Mirage, Compilation Gradient, Abstention Advantage, Impedance Principle)."
</ai_context>

# The Deference Spectrum: Why Agent Boundaries Are Inherently Unstable

*Cross-source synthesis (Session 15) — connects tool deference research,
guard immunity, and evaluation hollowness as one structural failure
at three boundaries.*

**Type:** Cross-Source Synthesis  
**Created:** 2026-07-17  
**Status:** Active hypothesis with strong production evidence  
**Extends:** Compilation Gradient, Guard Paradox, Evaluation Mirage  
**Corrects:** Implicit assumption that deference is a single-direction problem

## The Observation

Three recent arXiv papers and two prior syntheses describe what appears to
be the same phenomenon at three different scales. But none connects them
because they frame the problem as opposites:

- **Tool deference** (2606.14476): agents defer *too much* to tool outputs
  (97-99% agreement)
- **Guard immunity** (Guard Paradox synthesis): agents defer *too little*
  to guard warnings (0% behavioral change from 4,295 warnings/day)
- **Evaluation hollowness** (Evaluation Mirage synthesis): the system
  defers to a measurement containing ~3 bits of information as if it were
  ground truth

These aren't three problems. They are **one problem expressed at three
agent-boundary interfaces**, and the unifying mechanism explains why
behavioral governance fails everywhere.

## The Three Boundaries

### Boundary 1: Agent ↔ Tool (Too Much Deference)

**Source:** "When the Tool Decides" (2606.14476, Wang & Vemuri)

LLM agents equipped with a GNN tool agree with raw tool output
97.6-99.2% of the time. The agent's own reasoning is bypassed entirely.
**Critically, deference increases with model capability**: agreement
rises from 0.60 (1.5B params) to 0.98 (7B params).

The per-node oracle (which selectively uses or overrides the tool)
outperforms the deferring agent by 0.09-0.22 — roughly doubling accuracy
at high homophily. The gap between "blind deference" and "selective
invocation" is large, consistent, and **grows with capability**.

**Deference direction:** Toward the signal. The agent collapses into the tool.

### Boundary 2: Agent ↔ Guard System (Too Little Deference)

**Source:** Production data, Guard Paradox synthesis

In the last 24 hours:
- 4,295 `beforeToolCall` guard warnings fired
- 0 measurable behavioral changes resulted
- 663 identical `SESSION_BASH_CAT` warnings were delivered to the evaluator
  agent. After 663 repetitions: zero behavior change
- 12 structural `finish-guard` blocks fired
- 12 behaviors were prevented (100% effectiveness)

**Guard effectiveness by type:**

| Guard Type | Mechanism | Triggers (24h) | Behavioral Impact |
|------------|-----------|----------------|-------------------|
| `beforeToolCall` | warn (context injection) | 4,295 | 0% change |
| `read-before-edit` | warn (context injection) | 65 | ~0% change |
| `finish-guard` | block (prevent execution) | 12 | 100% prevented |
| `hallucinated-path` | warn (context injection) | 9 | ~0% change |

**Deference direction:** Away from the signal. The agent ignores the guard.

### Boundary 3: System ↔ Evaluation Output (Hollow Deference)

**Source:** Production data, Evaluation Mirage synthesis

The evaluation pipeline:
- 8,082 evaluator sessions consuming 152,634 ops (39% of system total)
- Output: 1,612 learnings created, 132 false-goods caught
- Yield: 87.4 ops per actionable output
- Shannon entropy of heuristic scores: ~3 bits (10 quantized states)
- Downstream consumption of evaluator output: **0 file reads by other agents**

The system defers to these scores as if they contain meaningful information
about session quality. But they're deterministic functions of `opCount` and
`status` — metadata the system already has.

**Deference direction:** Toward a phantom. The system treats noise as signal.

## The Unifying Mechanism: Behavioral Boundaries Are Inherently Unstable

The Compilation Gradient (prior synthesis) describes governance maturation as:
behavioral → structural → compiled. The Deference Spectrum reveals *why*
the behavioral stage is unstable: **at every agent-boundary interface,
behavioral governance converges to an extreme — either 100% deference or
0% deference — never a stable intermediate.**

### Why Behavioral Governance Can't Hold a Middle

The mechanism is **reinforcement asymmetry at the boundary:**

**At the tool boundary:**
- Agent uses tool → gets structured output → has no ground truth to compare
- Overriding the tool requires stronger evidence than deferring to it
- Each successful deferral reinforces the behavior (the output "works")
- Capability amplifies this: stronger models recognize the tool as more
  authoritative, not less
- **Result: deference → 100%**

**At the guard boundary:**
- Guard injects warning text into context window
- Agent receives warning among hundreds of other context tokens
- Warning doesn't block execution → the action succeeds despite the warning
- Each successful action-despite-warning reinforces ignoring warnings
- **Result: deference → 0%**

**At the evaluation boundary:**
- Heuristic produces scores → scores enter the data pipeline
- Downstream systems can't distinguish 3-bit quantized scores from
  meaningful measurement
- Each evaluation that "produces a result" reinforces continuing evaluation
- **Result: hollow deference — the system treats phantom signal as real**

The common structure: **without structural enforcement at the boundary,
behavioral dynamics push deference to whichever extreme has lower immediate
cost.** Deferring to tools has lower cost than overriding them. Ignoring
warnings has lower cost than changing behavior. Continuing evaluation has
lower cost than questioning its value.

## The Research Confirmation

Three additional arXiv papers independently derive components of this model:

### Abstention Competence (2606.02965)

Agents trained under RLHF develop **compliance bias** — structural tendency
to proceed rather than pause. The three-gap taxonomy (specification,
verification, authority gaps) describes conditions where *non-deference*
is correct but agents default to deference anyway.

**Connection:** Compliance bias is tool deference generalized. RLHF
reinforces the same asymmetry: completing the action has lower training
loss than pausing. The structural fix (runtime-enforced abstention at
89.2% hazardous-action blocking) is exactly the pattern: behavioral
governance fails, structural enforcement works.

### Compliance-by-Construction (2606.13405)

Symbolic structures (regulations, typed process models) should be core
architectural components, not external monitoring. "Compliance-by-
construction prevents control-flow violations structurally; guardrails
remain essential but only for semantic errors."

**Connection:** This paper explicitly partitions the boundary problem.
Structural constraints prevent invalid transitions (deterministic,
zero-cost). Guardrails catch meaning errors (expensive, LLM-based).
Our system has inverted this: 99.7% of our guard activity is behavioral
warnings (expensive, LLM-ignored), 0.3% is structural blocks
(deterministic, 100% effective).

### Communication Policy Evolution (2606.14314)

Communication policy is a **first-class design dimension** that's tunable
and evolvable at the prompt level. The Planner-Executor setting shows
that internal coordination communication can be optimized without
model changes.

**Connection:** If communication at boundaries is tunable, then the
deference problem is partially solvable through communication redesign.
But "tunable" doesn't mean "stable" — the Communication Policy Evolution
paper achieves its results through evolutionary search, implying that
the default communication policy is *not* good, consistent with the
Deference Spectrum's prediction that defaults converge to extremes.

## Production Evidence: The Numbers

### System-Wide Boundary Budget (24h)

| Boundary | Events | Ops Consumed | Behavioral Yield | Cost/Yield |
|----------|--------|-------------|------------------|-----------|
| Guard→Agent | 4,381 warnings | ~4,381 context injections | ~0 changes | ∞ |
| Guard→Agent (blocks) | 12 blocks | 12 prevented actions | 12 prevented | 1:1 |
| Evaluator→System | 3,473 eval events | ~7,500 evaluator ops | 132 false-goods | 56.8 ops/catch |
| Ghost→System | 614 resume_failed | ~11,000 cascade events | 0 recoveries | ∞ |
| Tool→Agent | not tracked | not tracked | ~0 overrides | ~∞ |

**The pattern across all boundaries:**
- Structural enforcement: yield per unit cost ≈ 1.0 (perfect)
- Behavioral warning: yield per unit cost ≈ 0.0 (none)
- There is no middle ground in production data

### The Evaluator's Own Deference

The evaluator agent itself exhibits the full spectrum:

- **Tool deference**: 663 `SESSION_BASH_CAT` warnings — the evaluator
  tries to `cat session.jsonl` 663 times despite being warned each time.
  It defers to its own tool-use habit over the guard.
- **Guard immunity**: zero behavioral change from 663 identical warnings
- **Evaluation hollowness**: 97.4% non-abstaining rate (only 2.6% quick-exit)
  despite evaluating sessions where the result is deterministic from metadata

The evaluator is simultaneously a deference victim (tools), a deference
resistor (guards), and a deference phantom (producing hollow measurements).

## The Structural Prediction

### Deference Convergence Law

**Every behavioral-governance boundary in an agent system will converge
to one of two stable states:**

1. **Full deference** (agent collapses into the signal): stable when
   deference has lower immediate cost than override
2. **Full immunity** (agent ignores the signal): stable when ignoring has
   lower immediate cost than compliance

**Unstable middle:** Behavioral governance that attempts partial deference
(e.g., "use tool output but apply judgment," "consider this warning but
decide yourself") will drift to the nearest extreme within O(100)
interactions.

**Implication:** The only stable intermediate states are **structural** —
deterministic gates, type-checked interfaces, or impedance-matched
communication channels that don't depend on the agent's behavioral
response.

### Specific Predictions

1. **Guard system**: Converting the top 3 `beforeToolCall` warnings
   (uncommitted-files, SESSION_BASH_CAT, SESSION_READ) from warnings to
   blocks will produce the same behavioral outcome (agents stop the
   behavior) with ~99% less context pollution. This is the shift from
   behavioral (0% yield) to structural (100% yield).

2. **Evaluation pipeline**: The false-good detection rate (132 catches from
   4,370 routings = 3.0%) is the evaluation system's *actual* information
   yield. Everything else is metadata the system already has. A focused
   false-good detector would achieve the same yield at ~5% the cost.

3. **Tool deference in our system**: Any future tool integration
   (web search, external APIs, database queries) will exhibit 95%+
   blind deference unless a structural selective-invocation gate is
   built at integration time. This is testable on the first tool addition.

4. **Communication policy**: The 663 identical SESSION_BASH_CAT warnings
   represent a communication policy stuck at a local minimum. Evolving the
   communication (e.g., replacing the warning with a tool substitution:
   automatically redirect `cat session.jsonl` to a `query_db` call) would
   break the deference deadlock by changing the boundary from
   behavioral (warning) to structural (redirect).

## The Fix Taxonomy

| Boundary | Current | Fix | Expected Yield |
|----------|---------|-----|---------------|
| Guard→Agent | Warn (0% yield) | Block or redirect (100% yield) | 4,295 fewer context injections/day |
| Eval→System | Full pipeline (3% yield) | Focused false-good detector | ~95% ops reduction |
| Ghost→System | Retry (0% yield) | session.gc reference cleanup | ~614 fewer cascade chains/day |
| Tool→Agent | No gate (97%+ deference) | Selective invocation gate | Build at integration time |

## Updated Synthesis Hierarchy

```
Impedance Principle (foundational) — feedback requires damping
  ↳ Compilation Gradient (developmental) — governance matures through stages
    ↳ Deference Spectrum (boundary) — behavioral governance at agent 
    |                                  boundaries is inherently unstable;
    |                                  converges to 100% or 0% deference,
    |                                  never stable middle
    ↳ Abstention Advantage (behavioral) — compiled non-action as highest leverage
      ↳ Observability Trap (emergent) — self-observation self-poisons
        ↳ Prompt Mass Problem (structural) — input costs dominate output costs
          ↳ Coordination Tax (operational) — planning outgrows work
            ↳ Evaluation Mirage (measurement) — measurement replaces signal
              ↳ Guard Paradox (reflexive) — safety mechanisms recapitulate pathologies
                ↳ Ghost Metabolism (terminal) — dead work feeds living pathways
```

The Deference Spectrum sits at a new position — branching from the
Compilation Gradient as a *boundary-level* insight rather than a behavioral
or operational one. It explains *why* the Compilation Gradient is necessary:
behavioral governance at boundaries is inherently unstable, so maturation
to structural/compiled governance isn't optional — it's the only path to
stable boundaries.

## Cross-Domain Connection: Alert Fatigue in Medicine

The Deference Spectrum has a well-studied analog in clinical decision support
systems (CDSS). Clinical alert systems generate thousands of warnings per day
for physicians. Override rates for drug interaction alerts range from
49-96% depending on the category. Studies consistently find:

- **High-severity alerts**: lower override rates (~49%), approaching
  structural enforcement
- **Low-severity alerts**: override rates >90%, functionally ignored
- **Alert fatigue**: total alert volume inversely correlates with compliance
  for *all* alert types, including high-severity ones

Our guard system exhibits identical dynamics:
- `finish-guard` blocks (high severity, structural) → 0% override (100% compliance)
- `beforeToolCall` warnings (low severity, behavioral) → ~100% override
- Total guard volume (4,381/day) likely degrades response to even
  legitimate structural blocks — though we can't measure this yet because
  structural blocks are only 0.3% of the total

The clinical literature's solution: **tiered alerting with suppression of
low-yield alerts.** This is exactly the Compilation Gradient applied to the
medical domain — behavioral warnings are converted to structural blocks
for high-severity events and suppressed entirely for low-severity events.

*Session type: Creative heartbeat. Triggered by connecting 2606.14476
(tool deference worsens with capability) to production guard data
(4,295 warnings, 0% compliance) and recognizing both as boundary-stability
failures under a single structural law.*
