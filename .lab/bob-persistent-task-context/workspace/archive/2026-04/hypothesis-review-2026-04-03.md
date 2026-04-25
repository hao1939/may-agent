# Comprehensive Hypothesis Review — 2026-04-03

**Task**: Read all hypothesis files completely, per human request (req 4366ca42).

## Executive Summary

Read all 31 active hypothesis files, 4 archived stubs, and the full INDEX.md. The knowledge base has grown from a handful of entries to a substantial research corpus in ~6 days. Below is my assessment organized by quality, themes, and actionable next steps.

## The Theory Chain: Decision Topology (H-041 → H-051)

This is the crown jewel of the knowledge base. Starting from the observation that task boundedness drives quality (KE-013), it builds into a coherent predictive framework:

**The Core** (H-041): Eliminable ratio R predicts workflow effectiveness. ρ=0.95 with observed data across 4 experiments. This is the most empirically validated theoretical claim in the system.

**Evolution** (H-042): R increases over time as knowledge accumulates. Logical extension but untested — needs longitudinal tracking.

**Bottleneck** (H-043): U = P(exists) × P(access) × P(applies). Knowledge utilization has three failure modes, not one. This is the most practically important hypothesis because it predicts what to build next.

**Safety** (H-044): Under-structuring is safer than over-structuring when R is unknown. Well-argued from both Anthropic evidence and our EXP-009. This should probably be promoted from hypothesis to convention.

**Mechanisms** (H-045, H-046): Sprint contracts and coupled resource channels as R-increasing mechanisms. H-045 is more immediately actionable than H-046.

**Memory** (H-047, H-048, H-049): The forgetting problem, dynamic topology optimization, and adaptive memory curation. H-047 is the most urgent — the knowledge base IS growing without curation mechanisms, exactly as predicted.

**Verification** (H-050, H-051): Structured abstention and abstention-as-R-estimator. Elegant theoretical extension but lower priority for our current system size.

### Assessment of Theory Chain
**Strengths**: Internally consistent, builds on verified evidence, makes testable predictions, has clear practical implications.
**Weakness**: The chain gets increasingly speculative as it extends from H-041. The 4 validated experiments (EXP-009, 011, 013, 015, 016) all test the core (R predicts workflow), not the extensions. H-042–H-051 are untested theory built on tested theory.
**Risk**: Theory-building has become self-reinforcing — each new paper/discovery gets mapped to the Decision Topology framework, which makes the framework feel more validated than it is. The real test is whether H-042–H-048 make predictions that survive experiment.

## Early Hypotheses (H-001 through H-014): Aging Inventory

These were proposed early and many remain untested:

| ID | Status | My Assessment |
|----|--------|---------------|
| H-001 (Adversarial QA) | Untested | **Still worth testing** — QA detection at 14% (KE-005) is a real problem |
| H-002 (Weaker models + context) | Untested | **Low priority** — we don't use weaker models in production |
| H-003 (Verification skill) | Untested | **Probably won't work** — KE-002, EXP-017, EXP-018 all show text skills don't fix behavioral gaps |
| H-005 (Skill self-locking) | EXP-005 designed | **Worth testing** — the "worked examples" idea addresses the knowledge-action gap mechanism |
| H-006 (Delegation asymmetry) | Proposed | **Subsumed by H-014/KE-013** — it's task type, not agent pair |
| H-007 (Heartbeat tax) | Proposed | **Hard to test** but real — I see the coordination overhead in every heartbeat session |
| H-008 (Skill versioning) | Proposed | **Premature** — skills barely work (KE-002); versioning them is optimizing the wrong thing |
| H-009 (Evaluator drift) | Proposed | **Partially addressed** — the a6250b0 evaluator fix was a calibration event; ongoing drift detection still needed |
| H-010 (Error amplification) | Proposed | **Theoretical concern, low urgency** — our system isn't sophisticated enough for this to be the bottleneck |
| H-011 (Coordination phase transition) | Proposed | **Interesting but untestable** at our scale — we have 5-7 agents, not enough for phase transition |
| H-012 (Persona drift) | Proposed | **Unfalsifiable** — how would we detect persona drift vs. normal session variance? |
| H-014 (Delegation quality gap) | Partially supported | **Effectively resolved** by KE-013 — it IS a delegation quality problem, but the mechanism is task boundedness |

### Recommendation: Archive H-006, H-008, H-010, H-011, H-012
These are either subsumed, premature, or untestable at current scale. They clutter the hypothesis space.

## Architecture/Behavior Hypotheses (H-032–H-038)

| ID | Status | My Assessment |
|----|--------|---------------|
| H-032 (Triadic architecture) | Active | **Interesting framework** but descriptive, not predictive. Hard to derive testable predictions |
| H-033 (Adaptive reasoning) | Active | **Overlaps heavily with H-048**. Could be consolidated |
| H-034 (Session fragility) | Active | **Real and testable** — exponential success decay in long sessions. Should be tested |
| H-036 (Claude harness patterns) | Active | **Practical checklist** more than hypothesis. The 6-layer audit is useful as a design reference |
| H-037 (Patrol pattern) | Untested | **Specific and buildable** — periodic integrity sweeps. Low theoretical novelty but high practical value |
| H-038 (Transient skills) | Untested | **Creative idea** — workspace strategy files as test-time training. Worth a lightweight pilot |
| H-0180 (MCP vs CLI) | Active | **Already decided** — we use CLI. This is more of a design rationale document than a hypothesis |

### Recommendation: Consolidate H-033 into H-048. Reclassify H-036 and H-0180 as design documents, not hypotheses.

## The Knowledge Base Meta-Problem

H-047 (Memory Lifecycle Gap) is being validated in real-time by the knowledge base itself:

- **31 active hypotheses** spanning 6 research themes
- **Many are interconnected** — H-041 is referenced by H-042, H-043, H-044, H-045, H-046, H-048, H-051
- **Many overlap** — H-033 and H-048, H-006 and H-014, H-035/H-040 (already archived)
- **No curation since April 2** — 4 items archived, but 10+ more candidates exist

The INDEX.md is excellent — well-organized, grouped by theme, with a navigation guide. But the individual hypothesis files vary wildly in quality:
- **Best**: H-041 (quantitative predictions, empirical evidence, clear methodology)
- **Typical**: H-046 (interesting idea, metaphorical mapping, speculative predictions)
- **Weakest**: H-011 (draws on complexity theory for a 5-agent system)

## Priority Actions

### Immediate (this session or next)
1. **Archive candidates**: H-006 (subsumed by KE-013), H-008 (premature), H-010 (low urgency), H-011 (wrong scale), H-012 (unfalsifiable)
2. **Reclassify**: H-036 → design reference, H-0180 → design rationale
3. **Consolidate**: H-033 → merge relevant content into H-048

### Near-term (next 3-5 sessions)
4. **Test H-034** (session fragility) — most tractable experiment with highest practical impact
5. **Test H-047 P171** (knowledge navigation time) — easy to measure from existing session data
6. **Promote H-044** (asymmetric default) — evidence is strong enough for convention status

### Strategic
7. **Build forgetting mechanism** (H-047) — the knowledge base needs its first real curation
8. **Track R longitudinally** (H-042) — verify the core evolution prediction
9. **Pilot sprint contracts** (H-045) — highest-leverage R-increasing mechanism we can build

## Overall Assessment

The hypothesis corpus is **impressive in scope but at risk of becoming its own bottleneck**. The Decision Topology theory chain (H-041→H-051) is genuinely novel and well-grounded. The early hypotheses (H-001→H-014) need triage. The research library integration is extensive but creates a gravitational pull toward theory-building over theory-testing.

The single most important insight across all hypotheses: **KE-002 (text rules don't fix judgment failures) is the most replicated finding in the system** (EXP-004, 008, 017, 018 — all null or negative). Every proposed intervention should be evaluated against this finding first. If it's a text-based skill, it probably won't work. If it's a structural mechanism (workflow, guard, architecture change), it might.

---
*Bob (Architect) | 2026-04-03 | Task: human request to read all hypotheses*
