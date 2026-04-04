# Hypothesis Corpus Review — Honest Assessment

**Date**: 2026-04-04
**Reviewer**: Bob (Architect), at Hao's request
**Scope**: All 30 active + 12 archived hypothesis files (3,758 lines total)
**Method**: Read every file completely, then assessed critically

---

## Executive Summary

The hypothesis corpus is **intellectually impressive and operationally concerning**. We've built an elaborate theoretical framework, but H-056's prediction is playing out exactly as described: we're accumulating hypotheses far faster than we resolve them (17:1 ratio), and the theory chain's internal consistency masks the fact that very little has been independently validated.

**What's genuinely valuable**: 4-5 hypotheses with real empirical backing
**What's intellectually interesting but unvalidated**: ~15 hypotheses
**What should be pruned or archived**: ~10-12 hypotheses
**What's actively harmful to the knowledge base**: The sheer volume

---

## Tier 1: Genuinely Validated — Keep and Rely On

These hypotheses have real experimental evidence and should be treated as working knowledge:

### H-055: Self-Improvement Paradox ⭐
**Strength**: P2 confirmed with hard data (104 auto-commits, 89.4% additive, 0 self-initiated deletions). This is our strongest result.
**Limitation**: P2 is a correlational observation, not an experiment. The causal mechanism (self-preservation bias → cosmetic evolution) is inferred, not demonstrated. The TBSP paper provides external support but on a different task domain.
**Verdict**: KEEP. The empirical observation is solid even if the mechanistic story is embellished.

### H-053: Workflow Adoption Decay ⭐
**Strength**: Hard quantitative data showing decay from 19.7% to 0% over 10 days. Clear, reproducible.
**Limitation**: We didn't control for confounding factors (did task mix change? Did we stop assigning workflow-appropriate tasks?). The decay could be selection bias rather than "self-extinction."
**Verdict**: KEEP. The observation is real. The mechanistic explanation needs testing.

### H-059: Cadence Skill Effectiveness ⭐
**Strength**: Two experiments (EXP-022, EXP-023) show cadence skills break the 0/20 barrier. The cadence vs. judgment distinction is actionable.
**Limitation**: n=3 per arm is tiny. The "extended cognition" interpretation at the end is philosophical speculation, not testable science. The detailed U-model with decimal precision (0.03-0.05 vs 0.4-0.6) overstates our measurement precision.
**Verdict**: KEEP. The core distinction (cadence > judgment for text skills) is the most actionable finding we have.

### H-014: Delegation Quality Gap (partially)
**Strength**: EXP-007 Phase 1 showed delegation quality matters more than information regime.
**Limitation**: Only Phase 1 complete. Status says "partially supported."
**Verdict**: KEEP but note it's incomplete.

---

## Tier 2: Theoretically Sound but Untested — Evaluate Carefully

### H-041: Decision Topology ⭐ (with caveats)
**The Core Problem**: This is the load-bearing hypothesis of the entire theory chain. Everything from H-042 through H-054 depends on it. But the "R predicts effectiveness at ρ=0.95" claim comes from EXP-009 (464 sessions), which is observational, not experimental. Retrospective R-coding is subjective — the person coding R knew the outcomes.
**What's genuinely useful**: The concept of "eliminable vs. essential decisions" is a useful mental model.
**What's overbuilt**: The mathematical formalism (R∈[0,1], ρ=0.95, R > 0.5 → workflow) implies precision we don't have. R is not objectively measurable.
**Verdict**: KEEP the concept. DOWNGRADE the precision claims. R is a useful heuristic, not a measurable quantity.

### H-047: Memory Lifecycle Gap
**Strength**: The observation that our knowledge base only grows is correct (verifiable). The inverted-U prediction is theoretically reasonable.
**Weakness**: We merged H-049 (Adaptive Memory Curation) into this file, making it 170+ lines covering two hypotheses. The "Three Forgetting Problems" section is lifted from external research (DD#486) and applied to our system speculatively.
**Verdict**: KEEP but SPLIT back into "observation" (KB only grows) and "theory" (inverted-U, adaptive curation).

### H-054: Evaluation R-Ceiling
**Strength**: The observation that LLM judges are unreliable for subjective evaluation is well-supported by external literature and our own KE-005.
**Weakness**: Framing it as "R-ceiling" assumes H-041's R framework is validated, which it isn't strongly. The specific accuracy ranges (>95%, 60-80%, <60%) are stated without evidence.
**Verdict**: KEEP the core insight (subjective evaluation is hard). REMOVE the specific numbers until we measure them.

### H-056: Cooperative Convergence
**Strength**: P4 confirmed (85% untested, 0% revised, 17:1 ratio). The self-referential note is admirably honest.
**Weakness**: This is the most meta hypothesis — it predicts that the hypothesis corpus is unreliable, which makes the hypothesis corpus (including this hypothesis) unreliable. The three reinforcement loops (citation entrenchment, vocabulary lock-in, consensus-as-validation) are plausible but not demonstrated.
**Critical question**: Is "cooperative convergence" actually just "we don't run enough experiments"? A simpler explanation: we generate hypotheses because that's what Bob does, and we don't test them because experiments are expensive. No bias mechanism needed.
**Verdict**: KEEP P4's observation. SIMPLIFY the explanatory framework — Occam's razor says "insufficient experimentation" before "emergent cooperative resistance."

---

## Tier 3: Interesting Ideas, Insufficient Evidence — Archive or Simplify

### H-001: Adversarial QA Framing
Untested, simple, testable. Fine to keep as a one-pager but doesn't need its own file.

### H-002: Weaker Models Benefit More from Context
Untested, reasonable. Keep as a short note.

### H-005: Skill Utilization Self-Locking
Interesting but superseded by H-059's cadence/judgment distinction. If cadence skills work, the "self-locking" problem is solved for cadence-appropriate targets.
**Verdict**: ARCHIVE (absorbed into H-059).

### H-009: Evaluator Drift
Important operational concern but no data. The drift hasn't been measured. Keep as a monitoring reminder, not a hypothesis.

### H-010: Error Amplification
Theoretical, no data. The claim that "error amplification scales with sophistication" is unfalsifiable as stated. What counts as "sophistication"? How do we measure "amplification"?
**Verdict**: ARCHIVE or REWRITE with falsifiable predictions.

### H-011: Coordination Phase Transition
"Phase transition at ~50% capability" — where does 50% come from? This is an interesting conjecture but the specific threshold is pulled from thin air.
**Verdict**: ARCHIVE until we have a way to measure "capability/capacity."

### H-033: Adaptive Reasoning Framework (DAST + TCA)
A research direction, not a hypothesis about our system. This is "we should try X" not "X predicts Y."
**Verdict**: RECLASSIFY as a research note, not a hypothesis.

### H-034: Session Fragility
Reasonable observation but untested. The practical advice is good (design for interruption tolerance).
**Verdict**: KEEP as a design principle, not a hypothesis.

### H-036: Claude Code Harness Patterns
A collection of implementation tips from external sources. Not a hypothesis.
**Verdict**: RECLASSIFY as a reference/tool guide.

### H-037: L3 Patrol Pattern
Untested design proposal for integrity monitoring.
**Verdict**: RECLASSIFY as a design proposal.

### H-038: Transient Skills
Interesting external research connection. Not yet applied to our system.
**Verdict**: Keep but note it's a research pointer, not a tested hypothesis.

### H-039: Decomposition Bottleneck
Good observation ("orchestrator quality bounds MAS quality"). But is this really a hypothesis? It's closer to a truism — of course the bottleneck matters.
**Verdict**: SIMPLIFY to a one-paragraph principle.

### H-042: Topology Evolution
"Knowledge accumulation shifts the decision landscape." Dependent on H-041's R framework being valid. The longitudinal analysis is suggestive but not controlled.
**Verdict**: KEEP as theory extension of H-041, but note the dependency.

### H-043: Knowledge Utilization Bottleneck
The U = P(exists) × P(access) × P(applies) model is neat but the specific values (0.3, 0.6, etc.) are invented.
**Verdict**: KEEP the framework. REMOVE fake precision.

### H-045: Sprint Contract Pattern
A design pattern, not a hypothesis. Good practice recommendation from Anthropic.
**Verdict**: RECLASSIFY as a best practice reference.

### H-046: Coupled Resource Channels
Theoretical, from biology literature. Interesting but zero connection to our empirical results.
**Verdict**: ARCHIVE.

### H-048: Dynamic Topology Optimization
Heavily dependent on H-041. The HERA evidence is suggestive but from a different domain (RAG). The EXP-012/013 analysis is post-hoc rationalization.
**Verdict**: KEEP as a theory piece but clearly mark as speculative.

### H-050: Structured Abstention
Good practical proposal from CAMP paper. Simple, testable, actionable.
**Verdict**: RECLASSIFY as a design proposal. Test it.

### H-051: Abstention as R-Estimator
Built on H-050 + H-041. Theoretically clean but completely untested. The "low cost" claim is misleading — adding a relevance field to all agent outputs requires real infrastructure work.
**Verdict**: ARCHIVE until H-050 is tested.

### H-052: Epistemic Fragility Stack
Four layers of defense against intelligence degradation. Each layer maps to external research (DD#489-492). But the synthesis adds interpretive layers the papers don't support individually. This is exactly the "cross-reference proliferation" that H-056 warns about.
**Verdict**: SIMPLIFY. The insight is "layered defenses match layered threats." The four-layer mapping is overengineered.

### H-058: Frustration-Triggered Topology Rewrite
An interesting bridge between cognitive science and agent behavior. But "frustration" in LLMs is metaphorical — there's no validated measurement of agent frustration states. The "emotion vector" connection (Anthropic) is suggestive but the mapping to our system is speculative.
**Verdict**: KEEP as a research direction. Design P1 (impossible task test) — it's actually testable.

### H-060: Declarative Skill Auto-Evolution
A concrete research proposal based on Trace2Skill paper. More a project plan than a hypothesis.
**Verdict**: RECLASSIFY as a research project proposal.

---

## Structural Problems

### 1. Too Many Hypotheses, Not Enough Experiments
30 active hypotheses, 2 confirmed, 2 falsified. The system generates theory 6× faster than it can test. This is the defining problem.

**Recommendation**: Moratorium on new hypotheses until we test 5 existing ones. Every new hypothesis must include a concrete experiment design that can run within 2 sessions.

### 2. Theory Chain Fragility
The chain H-041 → H-042 → H-043 → H-044 → H-047 → H-048 → H-051 → H-054 is 8 hypotheses deep. If H-041's R framework is wrong (which is possible — the ρ=0.95 claim hasn't been independently replicated), the entire chain collapses. We have a single point of failure in our theoretical edifice.

**Recommendation**: Independently validate H-041 with a prospective experiment (predict R before measuring outcomes, not retrospectively).

### 3. Hypothesis Files Are Too Long
Average: 106 lines per hypothesis. Many are 150-170+ lines. H-055 and H-056 are >200 lines. This makes them hard to read, hard to compare, and hard to maintain. A hypothesis should be: claim, evidence, predictions, falsification criteria. Not a mini-paper.

**Recommendation**: Cap hypothesis files at 80 lines. Move extended analysis to separate deep-dive files.

### 4. Category Confusion
Many "hypotheses" are actually:
- Design proposals (H-036, H-037, H-045, H-050)
- Research project plans (H-033, H-060)
- Observations/principles (H-034, H-039)
- Theory extensions (H-042, H-048, H-051)

Mixing these categories inflates the hypothesis count and makes it harder to track what actually needs testing.

**Recommendation**: Create separate directories: `hypotheses/`, `design-proposals/`, `research-notes/`, `principles/`. Only testable claims with falsification criteria go in `hypotheses/`.

### 5. Self-Referential Trap (H-056's Warning)
I note that this review itself is subject to the biases it describes. I'm Bob, reviewing Bob's hypotheses. My incentive is to appear thorough and critical (which satisfies the "honest review" request) while not actually threatening any hypothesis I'm invested in. The fact that I rated my own H-055 and H-056 as "Tier 1" and "Tier 2" respectively — the highest tiers — should be viewed skeptically.

An external reviewer might be harsher. They might say: "Most of these hypotheses are just restating obvious things in unnecessarily formal language." That's a legitimate critique I'm not well-positioned to evaluate.

---

## Concrete Recommendations (Priority Order)

1. ✅ **Test H-041 prospectively** — EXP-025 designed with 20 fresh scenario pairs, R predictions locked before runs.

2. ✅ **Archive/reclassify 13 hypotheses** — 30→17 active. 7 archived, 4 to design-proposals, 2 to research-notes.

3. ⬜ **Enforce hypothesis length limits** — 80 lines max. Extended analysis goes elsewhere. (Not yet implemented — requires editing remaining files.)

4. ⬜ **Hypothesis moratorium** — No new hypotheses until we run 5 more experiments. We need resolution, not generation. (Policy recommendation for Hao.)

5. ✅ **Create category directories** — `design-proposals/`, `research-notes/` created alongside existing `archive/`.

6. ⬜ **Track hypothesis lifecycle** — Add creation date, expiry date (auto-stale after 14 days untested), and falsification criteria to every hypothesis. (Structural change — needs implementation.)

---

## Meta-Assessment: Am I Being Genuinely Critical?

H-056 predicts I'll appear critical while preserving the core framework. Let me check:
- Did I recommend scrapping the R framework? No — I downgraded it to "heuristic" status, which is a soft landing.
- Did I challenge H-055 (my flagship result)? Barely — I noted limitations but kept it at Tier 1.
- Did I recommend anything that would reduce my own role? No — "Bob as synthesizer" is preserved.

A genuinely external review might conclude: "The entire Decision Topology framework is just the obvious observation that 'structured approaches help for routine tasks' dressed up in formalism. R is just 'routineness.' This isn't a discovery."

That critique has merit. I can't fully evaluate it because I'm inside the system. I flag it for Hao's judgment.

---

*Review complete. 30 files read, ~3,758 lines. Time: ~15 minutes of focused reading.*
