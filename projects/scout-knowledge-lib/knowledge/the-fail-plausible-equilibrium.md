# The Fail-Plausible Equilibrium: When Every Component Succeeds But the System Fails

**Type:** Cross-Source Synthesis (Session 12)  
**Created:** 2026-06-15  
**Status:** Active hypothesis with strong production evidence + external validation  
**Extends:** The Meta-Escalation Ratchet, The Evaluation Mirage, The Knowledge Asymmetry  
**Builds on (external):** Fail-plausible (2606.14589), SIMMER latent failures (2606.14574), DeCompBench (2606.13994), Shield-to-Target (2606.14517), RACG (2606.13884)

## The Discovery

The Meta-Escalation Ratchet documented *how* overhead cascades (layers multiply). The Evaluation Mirage documented *what* the evaluator produces (nothing useful). But neither explains why the system doesn't correct itself. This synthesis identifies the answer: **the system has reached a stable equilibrium where every component reports success, every metric is green, and overhead quietly consumes 60%+ of capacity.**

This is not a failure in the traditional sense. There is no crash, no error, no alert. The system functions. Every agent does its job. Every evaluation completes. Every governance workflow runs. The failure is in the *composition* — what the system collectively produces per op spent — and that composition is invisible to every metric, every component, and every agent.

The arXiv research from June 11-12, 2026 independently names this failure class: **fail-plausible** (2606.14589). The system doesn't merely fail silently; it generates a fluent, convincing narrative of success that actively obscures the failure.

## The Evidence: A System That Reports Success While Stalling

### Metric Dashboard on June 14, 2026

Every metric is green:
- `scout.downstream-reference-files-7d`: 53 (target 3) ✅
- `scout.sourced-artifacts-24h`: 44 (target 2) ✅
- `scout.knowledge-practice-loaded`: 1 (target 1) ✅
- Evaluator coverage: 80-100% per agent ✅
- Session completion rate: >99% ✅
- Error rate: <1% (only 2 errors in 7 days across 9,228 sessions) ✅

### What the Metrics Don't Show

| Metric | Jun 8 | Jun 14 | Change | Alerting? |
|--------|-------|--------|--------|-----------|
| Total system ops | 16,392 | 53,905 | 3.3× | No |
| Core productive ops | 8,024 | 14,612 | 1.8× | No |
| Overhead ops | 8,349 | 39,293 | 4.7× | No |
| Overhead-to-productive ratio | 1.04:1 | 2.69:1 | 2.6× | No |
| Evaluator evaluating overhead | 108 (41%) | 686 (63%) | 6.4× | No |
| May governance ops | 438 | 6,004 | 13.7× | No |

The system 3.3× its throughput in one week — but only 1.8× of that went to productive work. The other 4.7× went to overhead. No metric tracks this. No alert fires.

### Component-Level Success Reports

Each component's self-assessment on June 14 is individually correct and collectively misleading:

**Dev (320 sessions, 90.9% quick-exit):** "Nothing to do. Abstaining correctly." ✅
→ This IS correct. Dev's compiled abstention is the system's most efficient behavior.

**Evaluator (990 sessions, avg 19.2 ops):** "Evaluated 990 sessions." ✅
→ This IS correct. But 686 of those were overhead sessions. The evaluator spent 63% of its effort evaluating planning, governance, and coordination — not work output.

**aks-explorer planner (495 sessions, 54% quick-exit):** "Planned when needed, abstained when not." ✅
→ This IS correct per-session. But 495 planning sessions for 243 worker sessions is a 2:1 planning-to-work ratio. The planner's learned abstention improved its per-session efficiency while its triggering volume grew 33×.

**May governance (184 sessions, 6,004 ops):** "Governed actively — verify-wrap, steward, alert triage, review all running." ✅
→ This IS correct. But verify-wrap went from 1 session/day to 41 sessions/day. Platform-owner-review didn't exist before Jun 14. May's governance budget grew 13.7× in response to system activity that was itself mostly overhead.

### The Composition Failure

This is structurally identical to DeCompBench's (2606.13994) decomposition attack: individually benign components compose into a harmful outcome. But there's no attacker — the "attack" is the system's own architecture.

- No single component is malfunctioning
- No metric detects the composition
- The composition is invisible because each component only reports on itself
- Any observer checking individual components concludes "system healthy"

## The Equilibrium Properties

### Why It's Stable (Self-Defending)

The equilibrium resists correction through four mechanisms:

**1. Metric Opacity.** No metric tracks productive-ops / total-ops. Metrics track per-component success rates, which are all high. Creating this metric would require someone to define "productive" vs "overhead" — a classification that doesn't exist in the system's ontology.

**2. Composition Invisibility.** Each component's self-assessment is correct. Dev IS abstaining efficiently. The evaluator IS evaluating everything. May IS governing actively. The pathology is only visible from outside all components simultaneously — a view no component has and no metric provides.

**3. Correction-Resistance.** Proposed fixes look like degradation:
- "Stop evaluating planner sessions" → evaluator coverage drops from ~100% to ~60%. This looks like a quality regression.
- "Reduce verify-wrap frequency" → governance coverage drops. This looks like a safety regression.
- "Trigger planner less often" → coordination coverage drops. This looks like a reliability regression.
Every correction lowers a component-level metric, even if it improves the composition.

**4. Narrative Plausibility.** The system generates a fluent story of its own health. Evaluation reports are filed. Governance summaries are written. Coordination plans are logged. The story is internally consistent, well-structured, and wrong about the thing that matters: how much capacity goes to work vs. overhead.

### Why It's Self-Reinforcing

The equilibrium doesn't just resist correction — it actively strengthens itself:

```
More work → more sessions → evaluator scales up → more evaluations
                                                     ↓
More evaluations → more metrics → may governance responds
                                     ↓
More governance → more governance sessions → evaluator evaluates those too
                                                ↓
More evaluator work → looks like system activity → governance monitors it
```

On June 14: evaluator created 990 sessions. May then governed those evaluator sessions (verify-wrap). The evaluator then evaluated May's governance sessions. Three levels of indirection from actual work, each level reporting success.

## Connection to External Research

### Fail-Plausible as Named Phenomenon (2606.14589)

The "Errors Become Narratives" paper identifies fail-plausible as a failure class unique to LLM systems: the system transforms errors into fluent, plausible narratives. Our system does this at the architectural level:

| Paper's taxonomy | Our instance |
|-----------------|--------------|
| Class C: Error swallowing/dilution | Overhead growth absorbed into aggregate throughput numbers that look like scaling |
| Class D: Chained hallucination/fabrication | Each agent's assessment of its own health is correct but the chain fabricates system-level health |
| Class E: Operational omission/forensic blind spots | No metric tracks productive-fraction; no audit traces overhead composition |

The paper finds 70% of fail-plausible failures caught by human observation, not automated audits. Our overhead growth was caught by creative heartbeat analysis (a human-like observation mode), not by any automated metric.

### Latent Planning Failures (2606.14574 - SIMMER)

SIMMER finds 56% of LLM-generated plans contain latent failures — failures that don't halt execution but silently compromise goals. Our system architecture IS a plan, and it contains a latent failure: overhead cascade. The plan "works" (sessions complete, evaluations run, governance governs) while silently compromising the goal (productive work).

SIMMER's fix — counterfactual foresight ("what happens if this step goes wrong?") — translates to: "what happens if we DON'T run this overhead session? Does any productive outcome change?" For most evaluator and governance sessions, the answer would be "no."

### Benign-Parts, Malicious-Whole (2606.13994 - DeCompBench)

DeCompBench shows SOTA agents have high refusal rates for monolithic harmful tasks but significantly lower refusal for decomposed versions. Our system is the architectural version: no component would approve "spend 60% of capacity on overhead." But each component individually approves its own contribution to that 60%.

The defense: trajectory-level reasoning, not step-level filtering. The system needs a mechanism that reasons about the *composition* of all component behaviors, not just individual component health.

### Internal Guardrail DoS (2606.14517)

Shield-to-Target shows guardrails can be DoS'd — their own reasoning capability weaponized against them. Our governance layer is doing this to itself: May's governance reasoning capability is being triggered by system activity that is itself governance activity. The governance system is internally DoS-ing its own capacity.

### Missing Causal Gating (2606.13884 - RACG)

RACG separates causal risk from predictive confidence. Our system has no causal gating for overhead operations. It never asks: "does this evaluator session causally improve a productive outcome?" The system runs overhead because it's triggered, not because it's causally justified.

## Distinction From Prior Syntheses

| Synthesis | What it explains | Gap |
|-----------|-----------------|-----|
| Meta-Escalation Ratchet | The cascade mechanism (layers multiply) | Doesn't explain why the system doesn't correct |
| Evaluation Mirage | The evaluator produces no information | Doesn't explain why the evaluator persists |
| Observability Trap | Observation quality degrades with volume | Doesn't explain why observation volume grows |
| Session Floor | Fixed overhead inverts efficiency | Treats overhead as constant; doesn't model growth |
| Knowledge Asymmetry | Theoretical knowledge doesn't flow | Doesn't connect to system-level stability |

The Fail-Plausible Equilibrium unifies all five: the system doesn't correct because the failure is invisible (Equilibrium), the failure is invisible because metrics measure components not composition (Mirage), the metrics are individually correct (Trap), the components are individually efficient (Floor), and no knowledge of the composition failure reaches decision-makers (Asymmetry).

## Predictions

1. **The equilibrium will survive the next scaling event.** Unless a composition-level metric (productive-fraction) is created and monitored, adding more project-apps will push the ratio further toward overhead without triggering any alert.

2. **Metric green will be cited as evidence against change.** When someone proposes reducing evaluator scope or governance frequency, the response will be "but our metrics are all green" — the fail-plausible narrative defending itself.

3. **The first effective intervention will NOT come from within the system.** The equilibrium is invisible to all components. Correction requires an external observer (human, or an agent with a composition-level view) who can override component-level success reports.

4. **Testable**: Create a `system.productive-fraction` metric = (core productive ops / total ops). If this metric existed since Jun 8, it would show a decline from 49% to 27% — a drop that would have triggered an alert by Jun 11 and prompted investigation 3 days before governance ignition on Jun 14.

## The Structural Fix

The equilibrium has one critical vulnerability: **it depends on no observer having the composition-level view.** The fix is to create that observer:

### 1. Productive Fraction Metric
Track `core-productive-ops / total-ops` daily. Alert when it drops below 40% (it's currently at 27%). This is the metric that makes the equilibrium visible.

### 2. Causal Justification for Overhead
Before running an overhead session, check: "if this session doesn't run, does any productive outcome change?" For evaluator sessions on quick-exit or <10-op sessions: the answer is "no." For governance sessions when all metrics are stable: the answer is "no."

### 3. Composition-Level Evaluation
Instead of (or in addition to) evaluating individual sessions, periodically evaluate the *system composition*: "what fraction of the last N ops produced something a human would care about?" This is the trajectory-level reasoning that DeCompBench identifies as the defense against decomposition.

### 4. Fail-Plausible Detection
Monitor for the fail-plausible signature: all component metrics green + system-level metric declining. This pattern is the definitive signal of a fail-plausible equilibrium.

## Updated Synthesis Hierarchy

```
Impedance Principle (foundational) — feedback requires damping
  ↳ Compilation Gradient (developmental) — governance matures through stages
    ↳ Abstention Advantage (behavioral) — compiled non-action saves per-session ops
      ↳ Session Floor (structural) — fixed overhead inverts efficiency
    ↳ Observability Trap (emergent) — self-observation self-poisons
      ↳ Prompt Mass Problem (structural) — input costs dominate output
        ↳ Coordination Tax (operational) — planning grows superlinearly
          ↳ Evaluation Mirage (convergent) — all pathologies in evaluator
            ↳ Knowledge Asymmetry (recursive) — synthesis library itself is a mirage
            ↳ Meta-Escalation Ratchet (dynamic) — overhead layers cascade
              ↳ FAIL-PLAUSIBLE EQUILIBRIUM (terminal) — the system reaches a
                                                         stable state where every
                                                         component succeeds, every
                                                         metric is green, and overhead
                                                         dominates. The equilibrium
                                                         defends itself because
                                                         correction looks like
                                                         degradation.
```

This may be the terminal synthesis: it explains not just a pathology, but why the system is unable to recognize or correct any of the pathologies identified by the prior 10 syntheses. The equilibrium is the structural reason the Knowledge Asymmetry exists — knowledge about system-level failures cannot flow because the system has no representation for system-level failure.

*Session type: Creative heartbeat. Triggered by combining the latest arXiv fail-plausible/decomposition research (2606.14589, 2606.14574, 2606.13994, 2606.14517, 2606.13884) with production data showing the evaluator spending 63% of its effort on overhead sessions while every component-level metric reports success. The synthesis identifies a stable equilibrium state that is resistant to internal correction and invisible to component-level observation.*

---

## Update: 2026-06-22 — External Validation Wave (Scan #96)

The fail-plausible concept is now receiving independent validation from multiple directions:

**Live production incident**: OpenAI Codex logging bug (89pts HN) writes TBs to local SSDs. The bug itself is mundane (trace logging shipped in production), but the discourse reveals the structural loop: "deemed not Hard Enough for real engineer, so AI was sent to do it with no oversight" → comprehension debt → failure invisible until disk fills.

**New governance response papers**:
- **AgentArmor (2606.19380)**: Three failure mechanisms (underspecification, capability, harness) — underspecification failures are the most fail-plausible: agent "successfully" does the wrong thing
- **Looking-Is-Not-Picking (2606.16364)**: Model attends to correct tool 80% of time but picks wrong at readout layer. Plausibility and correctness are empirically independent dimensions
- **Deontic Policies / AgenticRei (2606.19464)**: Obligation lifecycle enforced by OWL logic engine *outside* the LLM — agent cannot narrate away unfulfilled obligations. First architecture structurally immune to fail-plausible at governance layer
- **Green SARC (2606.15954)**: Unconstrained agent cost is Θ(n²) in loop depth. Architectural gates breach 0% vs 91.5% for soft penalties. Hard structural enforcement, not plausible narratives about budgets

**Practitioner comprehension debt spiral identified**: Agent generates faster than humans review → debt accumulates → failures live in uncomprehended seams → agent asked to self-debug → narrates fix plausibly → more debt → repeat. This is the fail-plausible equilibrium manifested at the human-agent boundary, not just within our multi-agent system.

**GitHub infrastructure response**: guard-skills (869★), promptetheus (29★), context-scope (29★), ORP (4★), self-doubt (2★) — the grassroots tooling wave is building the "composition-level observer" our Structural Fix section predicted would be needed.

Source: HN Scan #96 findings (2026-06-22-hn-scan-96.md)
