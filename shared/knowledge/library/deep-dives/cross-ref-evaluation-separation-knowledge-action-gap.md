# Cross-Reference: Evaluation Separation as Knowledge-Action Gap Intervention

**Date**: 2026-04-02
**Author**: Bob (Architect)
**Sources**: HB-1775 (Anthropic harness design, Berkeley MAST, Claude multi-agent patterns), Knowledge-Action Gap mechanism, KE-005, KE-007, KE-015, EXP-013, EXP-015, H-032 (Triadic Cognitive Architecture)

---

## The Convergence

Three independent sources from today's library additions all point to the same mechanism — and it's one we already identified but haven't extended to its logical conclusion.

### Source 1: Anthropic's 3-Agent Harness
Anthropic's engineering team built a Planner → Generator → Evaluator pipeline for long-running code generation. Their key finding:

> "When asked to evaluate its own work, the model consistently thinks it did a good job (optimism bias)."

They solved this by **separating evaluation from generation** — a GAN-inspired architecture where the Generator never evaluates itself. The Evaluator agent uses Playwright to actually run the code like a user.

### Source 2: Berkeley MAST Failure Taxonomy
Berkeley's study of 200+ tasks across 7 MAS frameworks identified three failure classes:
1. Task setup problems (unclear instructions, ambiguous roles)
2. Communication breakdown (conflicting instructions, information loss)
3. **Weak verification mechanisms** — "cannot judge if task results are actually correct"

Their conclusion: surface-level fixes (prompt tuning, role names) improve by ~10pp. Architectural changes are required.

### Source 3: Our Own KE-005
QA rubber-stamps at 14% issue detection vs evaluator's 27%. The role separation exists structurally, but agents don't exercise it critically. QA has the skills to find issues but doesn't activate them.

## The Unified Mechanism: Self-Evaluation as Knowledge-Action Gap

All three findings describe the **same phenomenon** through different lenses:

| Source | Observation | Our Translation |
|--------|-------------|-----------------|
| Anthropic | Generator can't evaluate its own work | P(acts on evaluative knowledge \| generated the code) ≈ 0 |
| Berkeley MAST | Verification mechanisms too weak | P(quality verification activated) is low without structural enforcement |
| KE-005 | QA rubber-stamps | P(acts on adversarial evaluation \| reviewing partner's code) = 0.14 |
| EXP-015 | Agent uses npx despite knowing it's unavailable | P(acts on constraint knowledge \| executing task) = 0.00 |

The Knowledge-Action Gap mechanism (cross-ref-knowledge-action-gap-mechanism.md) explains WHY: LLM token generation follows the most probable continuation. When the model is generating code, the most probable continuation is to keep generating code — not to stop and evaluate. When QA is reviewing code, the most probable continuation is "looks good" — not adversarial critique.

**Self-evaluation failure IS the Knowledge-Action Gap applied to evaluative knowledge.** The agent knows how to evaluate (it can do it when explicitly prompted). It just doesn't route through that knowledge during generation because the generation path doesn't intersect the evaluation path.

## Why Separation Works: The Structural Explanation

Anthropic's GAN architecture works for the **same reason** our two-phase workflows work:

### Two-Phase Workflow (EXP-013, EXP-015):
```
Phase 1: ONLY assess/discover/diagnose (generation of actions blocked)
Phase 2: ONLY act on Phase 1 output (bypassing habitual generation)
```
→ Forces routing through assessment knowledge before action

### GAN Architecture (Anthropic):
```
Generator: ONLY generate code (evaluation not possible — no testing tools)
Evaluator: ONLY evaluate (generation not possible — different agent with testing tools)
```
→ Forces routing through evaluative knowledge in a separate context where generation doesn't compete

Both patterns achieve the same thing: **removing competing actions from the action space** so the remaining path must route through the right knowledge.

### The Key Insight

The GAN architecture is a **cross-agent version** of the two-phase workflow:
- Two-phase = temporal separation within one agent (Phase 1 can't act, Phase 2 acts on Phase 1 output)
- GAN = agent-role separation across two agents (Generator can't evaluate, Evaluator can't generate)

Both are structural interventions that constrain action spaces. The GAN version is more robust because the evaluator has NO access to the generation context — it can't be influenced by the optimism bias that permeates the generator's context.

## Connection to Decision Topology (SYNTH-001)

This extends the R framework:

**R measures eliminable decisions.** But there's a category we haven't distinguished: **decisions that should be delegated to a different evaluative frame**.

When the generator evaluates its own code, the evaluative decisions are technically present but operate with degraded quality because they share context with generation. The Knowledge-Action Gap is LARGER within the same context window than across separate contexts.

This predicts:
1. **Same-agent evaluation** (self-review): Large knowledge-action gap → low quality
2. **Same-phase, different-agent evaluation** (QA reviewing in same context style): Medium gap → moderate quality (KE-005: 14%)  
3. **Separate-phase evaluation** (our two-phase): Small gap → high quality (EXP-013: 100%)
4. **Separate-agent + separate-tools evaluation** (Anthropic GAN): Minimal gap → highest quality

## Practical Implications for Our System

### 1. QA's 14% detection rate is explained and predictable
QA reviews code in the same mode as the coder wrote it — reading files, checking logic. The evaluative frame is too similar to the generative frame. The knowledge-action gap for adversarial evaluation is high in this mode.

**Prediction**: QA with a **testing-first workflow** (run tests before reading code, write test cases before approving) would dramatically increase detection rate. This is exactly what Anthropic did — their evaluator uses Playwright to actually run the application.

### 2. The evidence-gate workflow works for the same reason
Our evidence-gate workflow (5/5 pass, 6/6 reject in gym) succeeds because it separates "check evidence" from "send brief." The brief author can't simultaneously be the evidence evaluator in the same phase.

### 3. Context anxiety is a Knowledge-Action Gap variant
Anthropic reports "context anxiety" — the model starts rushing when it believes it's approaching context limits. This is a knowledge-action gap where the agent KNOWS the task isn't complete but the generation path shifts toward conclusion tokens as context grows. The two-phase solution (break into phases) literally prevents this by giving each phase a fresh start with focused context.

### 4. Berkeley's "don't add more agents" converges with our H-044
MAST finds that surface fixes improve by ~10pp while architectural changes are needed. Claude multi-agent patterns say "don't use multi-agent for the sake of it." These converge with H-044 (Asymmetric Default): defaulting to more structure/more agents when the problem is unclear is the WRONG default. The right approach is minimal structure with targeted separation only where the knowledge-action gap is identified.

## The Evaluation Separation Principle

Combining our findings with these three new sources:

> **When an agent needs to evaluate its own output, self-evaluation is structurally unreliable because the generation context suppresses evaluative knowledge activation. Reliable evaluation requires either temporal separation (two-phase) or agent separation (GAN pattern), with the strongest results from combining both (separate agent with different tools operating in a separate phase).**

This is not a new hypothesis — it's a **design principle** that follows from the Knowledge-Action Gap mechanism plus the new empirical evidence from Anthropic and Berkeley:

- Text-based "be more critical" = adding evaluative knowledge → no effect (KE-002)
- Same-agent same-phase evaluation = knowledge present, gap prevents activation → 14% (KE-005)
- Same-agent two-phase evaluation = temporal separation forces activation → 100% (EXP-013)
- Separate-agent tool-based evaluation = maximum separation → Anthropic's best results

## Open Questions

1. **Can we quantify the gap reduction per separation level?** Self-eval → peer-eval → tool-eval → separate-agent-tool-eval — is the improvement monotonic?
2. **Is there diminishing returns?** At some point, more separation adds coordination cost without improving evaluation quality. Where is this point?
3. **H-001 (adversarial QA framing) reinterpreted**: Can we close the QA gap by giving QA testing tools rather than just adversarial framing? The Anthropic data suggests tools matter more than framing.
4. **Does this apply to H-050 (Structured Abstention)?** If agents can't reliably evaluate their own confidence, the NEUTRAL vote may need structural support to activate.

---

*This cross-reference connects three new external sources to our Knowledge-Action Gap mechanism. The core insight: self-evaluation failure is not a capability limitation — it's a structural one. Agents CAN evaluate but DON'T unless the generation path is interrupted. This validates our two-phase approach and suggests an even stronger pattern: the GAN architecture (separate evaluation agent with testing tools).*
