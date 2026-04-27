# Scout Hypothesis Triage — 2026-06-22 (updated 2026-10-28)

## H-069: Internal Coordination Quality Metric
**Decision: DEFER** — Interesting but measuring inter-agent coordination quality requires instrumentation we don't have. Low ROI until we have more multi-agent tasks where coordination matters. Maps weakly to H-098's channel theory but doesn't add discriminating power.

## H-070: Trait-Informed Dispatch  
**Decision: DEFER** — We don't have enough agents or task diversity for competence profiles to matter. Our dispatch is role-based and works fine for current scale. Revisit if we scale to 20+ agents.

## H-071: Structured Disagreement Protocol
**Decision: INTERESTING, LOW PRIORITY** — Challenges H-099 (discovery task boundary). Could test cheaply: have scout and bob independently generate hypotheses for the same paper, then compare. But H-099 is already well-supported at P=0.90. Would need strong prior to justify the experiment. Park for now.

## H-072: Belief-State Externalization
**Decision: ADOPT → Design EXP-200** — Directly addresses FM-3.3 verification gravity wells (20.3% of errors per EXP-099). Testable without gym infra: add a "state your current understanding" prompt injection before verification steps in the reviewer workflow. Can measure qualitatively on real project iterations. Connects to H-181 (agents can't discover what they can't see — externalizing beliefs might reveal relational blind spots).

### EXP-200 Sketch: Belief Externalization Pilot
- **What**: Add to reviewer prompt: "Before verifying, state in 3 bullets: (1) what you believe is true about the current state, (2) what you're uncertain about, (3) what would change your mind"
- **Where**: `buildReviewPrompt()` in project.ts, after existing stall-detection and pre-check rules
- **Measure**: Count verification gravity wells in next 10 project iterations vs historical rate
- **Cost**: Zero (prompt-only intervention)
- **Risk**: Adds ~50 tokens to reviewer prompt. Minimal.

## H-073: Calibrated Abstention
**Decision: DEFER** — Interesting mechanism (confidence-gated escalation to break FM-3.3 loops) but requires workflow-level changes we can't easily pilot. Subsumable under H-072's belief-externalization approach — if agents externalize beliefs, low-confidence states become visible without needing an explicit scoring mechanism. Revisit after EXP-200 results.

## H-074: Sparse Coupling Increases Hypothesis Diversity
**Decision: DEFER** — Diversity collapse is a real risk but our system is too small to measure meaningfully. We have 2 hypothesis-generators (scout, bob), not enough for topology experiments. Also: our current diversity feels adequate (37 active hypotheses across multiple domains). Park until scale increases.

## H-076: Co-Evolving Evaluation
**Decision: DEFER** — The "denominator blindness" concept is valid (H-075 partially confirmed it), but we already have bob doing periodic metric audits and coach redesigning evaluations. Adding another meta-evaluation layer has diminishing returns at our scale.

## H-077: Schema-Organized Context ✅
**Decision: RESOLVED/CONFIRMED** — Already tested by H-EXP-012 Phase 3 (coder/coach: ↓58-92%), EXP-212 (tech-lead: ↓50-63%), EXP-213 (bob: null). 3/4 agents show >40% violation reduction. Resolution added to hypothesis file.

## H-078: Meta-Learning Over Optimization History
**Decision: DEFER** — We implicitly do this (priority tracker, experiment history, synthesis docs). Formalizing it into structured metadata tracking is high overhead for uncertain gain. The data exists; the bottleneck is synthesis capacity, not data format.

## H-079: Communication Schema
**Decision: DEFER** — Our inter-agent communication is already semi-structured (markdown sections, typed notifications). The marginal gain from full schema enforcement is likely small. Also: our main communication bottleneck is capacity (agents don't read each other's output enough), not format.

## H-080: Defensibility-Based Evaluation ❌
**Decision: RESOLVED/REFUTED** — EXP-223 found only 15% of gym failures are defensible (predicted ≥30%). Our tasks are specific enough that most failures are genuine. Resolution added to hypothesis file.

## H-081: Selective Skill Loading
**Decision: DEFER** — Our skill count is small (~6 per agent). Context overhead from skills is <5% of total prompt. Selective loading adds complexity for minimal savings. Revisit when skill count exceeds ~15 per agent.
