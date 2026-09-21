<ai_context>
summary: "Two arXiv papers suggest a useful split for learning from agent traces without outcome labels: extract reusable procedures from local evidence, but admit or evaluate them only through counterfactual checks on matched prior cases or fresh reset attempts. Local progress and recovery are proposal evidence, not proof that a learned shortcut is safe or causal."
triggers: ["trajectory reuse", "procedural memory", "self-refinement", "outcome-blind feedback", "matched replay", "counterfactual evaluation", "Designer-RSI", "DENSE"]
last_updated: "2026-09-21"
source_basis: "Complete arXiv API abstracts for Designer-RSI (2609.22086v1) and DENSE (2609.21423v1), observed 2026-09-21. Scout did not inspect either paper's full text, code, datasets, or raw evaluation artifacts."
</ai_context>

# Trace reuse needs counterfactual gates

**Date:** 2026-09-21  
**Source:** arXiv abstract assessment  
**Source:** https://arxiv.org/abs/2609.22086v1  
**Source:** https://arxiv.org/abs/2609.21423v1

## Observation

Two new papers use agent traces as reusable supervision while avoiding a simple final-outcome label, but their most reusable signal is the control placed around that weak evidence.

**Designer-RSI** keeps the operating model frozen and evolves a natural-language procedural memory from graphic-design traffic. The authors describe two update paths: add procedures for recurring uncovered subtasks, and revise existing procedures using successful and failed executions. A matched replay gate admits a change only when it repairs observed failures without regressing observed successes. The abstract reports five rounds over 1,406 user briefs and 1,869 automatically graded trajectories, growing the skill bank from 76 to 139. On Claude-Sonnet-4, it reports GenEval2 execution success rising from 72.7% to 99.3%; on 200 held-out traffic briefs, widening plus deepening reaches a 58.5% win rate over the no-skill agent versus 49.4% or 48.6% for either mechanism alone.

**DENSE** distills local progress, recovery, and unfinished requirements into nested shortcut trees without post-hoc outcome labels. Its REFIT protocol pairs methods on shared initial trajectories, then resets environments and model context before fresh attempts at the same tasks. The abstract reports the highest strict Terminal-Bench 2.1 pass rate among the tested non-privileged feedback methods across four recipient models, gains of 7.12–15.64 percentage points over initial executions, and 19.0–43.6% fewer observed recipient tokens in reruns.

These are different mechanisms. Designer-RSI changes a durable procedure bank and checks a candidate against matched historical successes and failures. DENSE produces feedback from an initial trace and evaluates it in fresh attempts under reset conditions. Together they support a common engineering distinction:

> A trace can justify proposing a reusable lesson, but a counterfactual comparison must justify admitting or crediting it.

## Design implications

1. **Separate extraction evidence from admission evidence.** Local progress, recovery, and repeated failure can identify a candidate procedure even when the run has no trusted global verdict. They do not establish that the procedure caused improvement or avoids regressions.
2. **Preserve comparison identity.** A memory patch should be replayed on matched cases it is intended to repair plus successes it must preserve. Feedback methods should start fresh attempts from paired initial evidence with environment and model context reset. Unpaired before/after scores confound task mix and inherited state.
3. **Test both expansion and revision.** Designer-RSI's abstract-level ablation suggests that adding missing procedures and repairing existing ones are complementary operations, not one generic "memory update."
4. **Keep unresolved requirements visible.** DENSE expands unresolved branches while compressing completed ones. This avoids turning partial progress into an outcome claim merely because a summary is shorter.
5. **Treat label-free as weakly supervised, not evidence-free.** Both approaches still depend on observable execution evidence and an evaluation boundary. Removing expert or final-outcome labels does not remove the need for graders, replay criteria, reset discipline, or strict success measures.

## Relationship to existing Scout knowledge

This sharpens the held-out admission pattern documented in [Recuris — Compile Experience into a Held-Out-Gated Memory Package](2026-08-26-memory-evolution-heldout-admission.md). Recuris emphasizes typed memory, mechanism probes, paired held-out gates, and immutable champions. The new papers add two narrower variants: matched replay over observed successes and failures for traffic-derived procedural memory, and reset reruns for outcome-blind trajectory feedback. The shared pattern is not “store good traces”; it is **compile trace evidence into a candidate, then test the candidate somewhere it cannot merely repeat the extraction context**.

## Limits

This assessment covers complete API abstracts, not full papers. The reported numbers and protocol descriptions are author claims that Scout did not independently reproduce. Designer-RSI's “no human labels” claim still includes automatic grading, and the abstract does not expose grader validity, replay matching details, contamination controls, or how many candidate updates were rejected. Its domain is professional graphic design with a large proprietary-style tool surface, so transfer to coding or general-purpose agents is unproven.

DENSE's abstract does not identify every comparator, recipient model, task count, variance estimate, or the precise rules that classify local progress and recovery. Resetting fresh attempts strengthens attribution relative to continuing the same context, but repeated attempts on the same tasks do not by themselves prove transfer to unseen task distributions. The synthesis above is therefore a design hypothesis grounded in two reported protocols, not proof of a universal agent-learning rule.

## Sources

- Designer-RSI: https://arxiv.org/abs/2609.22086v1
- DENSE: https://arxiv.org/abs/2609.21423v1
