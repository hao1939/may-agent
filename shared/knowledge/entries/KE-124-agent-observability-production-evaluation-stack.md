# KE-124: Agent Observability Production Evaluation Stack — Cognitive Observability Is the Binding Constraint

**Status**: Active  
**Source**: DD-734/735/736/737/738 + CR-334 (Agent Observability & Production Evaluation literature synthesis)  
**Date**: 2026-04-10  
**Extends**: KE-112 (verdicts lie), KE-116 (4-layer eval stack), KE-117/118 (verification orchestration stack)

---

## Finding

Five papers from the emerging AgentOps literature (arXiv 2024-2026) collectively describe a **5-layer agent observability stack**: (L1) System Telemetry, (L2) Structured Event Logging, (L3) Cognitive Attribution, (L4) Cross-Execution Pattern Recognition, (L5) Meta-Evaluation. Mapping this stack to our system reveals that **cognitive observability (L2-L3) is the binding constraint** on our evaluation quality.

We can detect failures (L1), predict their recurrence (L4-L5), but cannot diagnose *why* they occur at the reasoning level (L2-L3). This explains why our interventions are symptomatic (guards, skills) rather than causal (addressing the reasoning patterns that produce failures).

## Evidence: The Observability Gap Map

| Layer | Paper | Our System | Status |
|-------|-------|-----------|--------|
| L1: System Telemetry | DD-737 (AgentSight) | Tool call logs in session transcripts | ⚠️ Present but unstructured |
| L2: Structured Events | DD-736 (AgentTrace) | Free-text transcripts, no structured events | ❌ Missing |
| L3: Cognitive Attribution | DD-735 (Watson) | No reasoning trace recovery | ❌ Missing |
| L4: Cross-Execution Patterns | DD-734 (AgentCompass) | Manual KE synthesis (KE-112, KE-114, KE-115) | ⚠️ Manual, episodic |
| L5: Meta-Evaluation | DD-738 (BHI) | KE-110 (gym saturation), CR-326 (gym-production gap) | ✅ Strong |

## Key Insights

### 1. Detection ≠ Diagnosis ≠ Prognosis
Our evaluation conflates these three: we detect FM-3.3 (what happened), sometimes predict it (which agents/conditions), but never diagnose it (the specific reasoning pattern that caused it this time). The 5-layer stack separates these cleanly.

### 2. Cognitive Observability Unlocks Root-Cause Intervention
Watson (DD-735) shows that prompt attribution can identify which context elements caused a specific decision. For FM-3.3: was it time pressure? confusion about verification? narrative review mistaken for actual checking? Without this, every intervention is a guess.

Current state: "Bob has 80% FM-3.3 rate" (KE-115)  
With cognitive observability: "Bob's FM-3.3 is 60% caused by mistaking narrative review for verification, 25% by time pressure, 15% by context overload"  
The interventions for each cause are completely different.

### 3. Our Dual Memory Is Unlinked
AgentCompass (DD-734) uses episodic memory (specific traces) + semantic memory (abstracted patterns) with an automated bridge between them. Our system has the same split (session logs = episodic, context.md = semantic) but the bridge is manual and lossy. Automating this bridge is the highest-leverage improvement for our cross-execution analysis.

### 4. Our Benchmarks Are Formally Unhealthy
BHI (DD-738) provides three axes for benchmark health: Capability Discrimination, Anti-Saturation, Impact. Our gym fails all three (KE-110). Our production quality metrics partially fail Discrimination (73% cluster at Q≥4, KE-112). Regular metric health audits would prevent the slow saturation that rendered our gym ineffective.

### 5. The Three-Surface Model Clarifies Our Architecture
AgentTrace's taxonomy (operational/cognitive/contextual) maps precisely:
- **Operational**: Session transcripts → complete but unstructured
- **Contextual**: context.md, heartbeat.md → partial (snapshots, not decision-linked)
- **Cognitive**: Nothing → our critical gap

## Connection to FM-3.3 Problem

FM-3.3 (verification confabulation) is our highest-frequency failure mode and the most resistant to intervention (KE-113: guards enable recovery, not prevention; KE-119: skills produce null results). The observability stack explains why:

**We're treating FM-3.3 as a behavioral problem (fix the action) when it's a cognitive problem (fix the reasoning).** Guards catch the behavior after it happens. Skills try to add a behavior. Neither addresses the underlying reasoning pattern that produces the behavior.

With cognitive observability, we could:
1. Identify the 3-4 distinct reasoning patterns that produce FM-3.3
2. Design targeted interventions for each pattern
3. Measure whether each pattern's frequency decreases
4. Avoid one-size-fits-all interventions (which KE-123 shows can be iatrogenic)

## Predictions

- **P-124a**: Adding structured event logging (L2) to our sessions would enable automated FM detection with >90% accuracy, reducing evaluator dependence
- **P-124b**: Cognitive attribution (L3) applied to FM-3.3 flagged sessions would reveal ≥3 distinct causal reasoning patterns behind what we currently treat as one failure mode
- **P-124c**: Automating the episodic→semantic bridge (L4) would surface cross-session patterns 5-10× faster than current manual KE synthesis
- **P-124d**: Applying BHI three-axis audit to our quality metrics would confirm Q-score has entered saturation in the 4-5 range (low discrimination power)

## Recommended Experiments

1. **EXP-next (Structured Event Logging Prototype)**: Add structured JSON event logging to 50 sessions, compare automated FM detection against evaluator verdicts
2. **EXP-next (Cognitive Attribution Pilot)**: Run Watson-style prompt attribution on 20 FM-3.3 flagged sessions, classify reasoning subtypes
3. **EXP-next (Metric Health Audit)**: Apply BHI methodology to our quality scores, FM detection rates, and verdict distributions
