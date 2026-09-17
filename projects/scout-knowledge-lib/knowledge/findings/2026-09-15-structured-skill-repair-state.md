<ai_context>
summary: "ReSkill treats post-failure skill editing as stateful diagnosis rather than repeated reflection: it keeps competing hypotheses, candidate local patches, coverage links, attempted edits, and retest outcomes across rounds. On ALFWorld and TextCraft with three small Qwen models, it reported the highest final cumulative success in all six benchmark-model settings, averaging 3.7 points over direct repair and 3.3 over hypothesis-conditioned repair. The transferable control is an explicit repair ledger, but same-task retest recovery is candidate-repair evidence—not held-out admission or retention evidence."
triggers: ["2609.15684", "ReSkill", "skill repair", "failure attribution", "repair state", "retest-conditioned update", "coverage-based repair", "skill evolution", "repair ledger"]
last_updated: "2026-09-15"
source_basis: "arXiv 2609.15684v1 Atom record and full HTML inspected with bounded HTTP requests on 2026-09-15."
</ai_context>

# Failed skill patches should update a repair state, not restart reflection

**Date:** 2026-09-15  
**Source:** https://arxiv.org/abs/2609.15684v1  
**Primary text:** https://arxiv.org/html/2609.15684v1  
**Tags:** agent-skills, failure-attribution, structured-repair, retesting, skill-evolution, admission-control

## Signal

*ReSkill: Explicit Failure Attribution and Structured Repair for Interactive Language Agents* separates post-failure editing into persistent records instead of asking a model to rewrite a skill from each new failed trace. Its repair state retains:

- the current skill set and latest failed trajectory;
- competing failure hypotheses, each with evidence, affected skill scope, a repair hint, and a weight;
- multiple local patch candidates and binary links showing which hypotheses each patch addresses; and
- previously attempted patches, their retest trajectories, and outcomes.

Candidates come from the observed trace, hypothesis-conditioned generation, targeted proposals, and interface-preserving guards. Before selection, they must be local, reusable beyond the episode, grounded in the trace, and compatible with the action interface. The procedure chooses the patch covering the greatest active hypothesis weight, favoring the more local and evidence-grounded edit on ties. If the environment retest fails, post-repair attribution updates the hypothesis support and weights rather than discarding the failed attempt and starting another unconstrained reflection.

This matters because a failed patch has diagnostic value. It weakens or redirects one explanation while a new trajectory may expose another. A repair loop that records only the latest prose reflection cannot reliably distinguish “the diagnosis was wrong,” “the edit did not implement the diagnosis,” and “the edit fixed one cause but another remains.”

## Reported evidence

The paper evaluates frozen Qwen3-1.7B, Qwen2.5-3B, and Qwen3-4B agents on 274 ALFWorld tasks and AgentGym TextCraft. All compared repair methods start from the same model-specific failure pool and skill-file format. ALFWorld receives up to seven repair rounds; TextCraft receives up to four. The reported metric is cumulative task success: an initial success or success on any later retest counts.

ReSkill has the highest final overall result in all six benchmark-model combinations. Averaged across them, the abstract reports gains of **3.7 percentage points over direct repair** and **3.3 points over hypothesis-conditioned repair**. The largest visible separation is Qwen2.5-3B on TextCraft: from a 9.9% skill-equipped first pass, direct repair reaches 17.5%, hypothesis-conditioned repair 22.8%, and ReSkill 29.4%. For Qwen3-4B, where stronger first-pass behavior leaves less repair headroom, TextCraft finishes at 48.1%, 49.3%, and 50.7%, respectively.

The result is not that structured selection always wins locally. Direct repair matches or exceeds ReSkill in several ALFWorld task-family columns where feedback already identifies one concrete procedural omission. The paper's useful regime distinction is narrower: persistent attribution helps most when one trace supports several plausible causes or when an unsuccessful retest should change the next repair choice.

## Operational implication: preserve a repair ledger before admission

A practical skill-maintenance system should make each repair round auditable with a record such as:

1. triggering task, failed trajectory, environment, and active skill revision;
2. hypotheses with evidence and affected scope;
3. candidate patch revisions and hypothesis-coverage links;
4. selected patch plus the selection rule and tie-break;
5. retest trajectory and outcome; and
6. the resulting hypothesis-weight update or termination decision.

This ledger improves **candidate repair**, but it does not replace the admission controls described elsewhere in the Scout library. ReSkill retests the edited skill on the same task that triggered repair and reports cumulative recovery on that task. That is evidence that the patch can repair its originating failure under the study's environment; it is not evidence that the patch generalizes, preserves previously solved cases, composes safely with other skills, or should enter the active registry.

The safe lifecycle is therefore two-stage: use structured repair state to produce and refine a candidate, then run held-out, retention, and bundle-level checks before atomic activation. A successful triggering-task retest closes a diagnosis loop; it should not silently become a deployment receipt.

## Evidence boundary

This is an arXiv v1 accepted to EMNLP 2026. It studies two interactive benchmarks with immediate observable feedback, small open-weight models, fixed repair budgets, and local append-style skill edits. The authors explicitly leave delayed, noisy, and long-horizon tool feedback to future work. Because cumulative success gives credit for solving the same task on any repair round, repeated retesting can demonstrate local recovery without measuring cross-task generalization or regression. The paper does not establish that the model-generated hypothesis weights are calibrated, nor does it independently isolate every component of the candidate pool and selector. The supported conclusion is the value of retaining structured diagnosis and retest history during repair—not automatic admission of every recovered patch.
