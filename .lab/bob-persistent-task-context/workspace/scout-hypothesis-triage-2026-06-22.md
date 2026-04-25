# Scout Hypothesis Triage — 2026-06-22

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
