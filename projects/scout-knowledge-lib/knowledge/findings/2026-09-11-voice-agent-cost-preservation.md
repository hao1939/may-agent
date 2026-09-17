<ai_context>
summary: "GitHub finding on Turnstile's evidence ladder for voice-agent cost optimization: decision identity, outcome preservation under unchanged decisions, and preservation after divergent decisions are distinct quantities. A small open-loop probe exposed fluent non-action that a lenient clean-close verdict missed."
triggers: ["voice agent cost", "model routing", "outcome preservation", "decision divergence", "clean close", "fluent non-action", "Turnstile", "counterfactual replay"]
last_updated: "2026-09-11"
source_basis: "Read-only inspection of Pranavk098/turnstile at commit fbed5e7d92f0277ed3f4d348ccb71065777b04f1, discovered via the GitHub repository Search API (incomplete_results=false)."
</ai_context>

# Voice-Agent Savings Need a Divergence-Preservation Gate

**Date:** 2026-09-11  
**Repo:** https://github.com/Pranavk098/turnstile  
**Inspected revision:** [`fbed5e7d92f0277ed3f4d348ccb71065777b04f1`](https://github.com/Pranavk098/turnstile/tree/fbed5e7d92f0277ed3f4d348ccb71065777b04f1)

## Signal

Turnstile is an early-stage voice-agent margin profiler that separates three
questions often collapsed into one cost-saving claim:

1. **Was the cheaper path less expensive?** The repository computes narrow model-routing
   savings by deterministic repricing against a dated rate table.
2. **Did the cheaper model choose the same action?** Its kind-aware gate compares bounded
   decision labels rather than full response text.
3. **If the path changed, did the task still succeed?** Its open-loop harness runs the
   changed path forward and adjudicates the resulting action trace.

That third gate matters. The project's own bounded paid run reports 17/217 routing pivots
(7.8%) that chose a different route and 197/200 verdict preservation (98.5%) only among
the *non-divergent* pivots. Those numbers do not establish safety on the excluded forks.
A later small open-loop probe—24 scripted conversations across six scenarios, with mock
tools—reported 0/8 preservation by a registry rule and 0/10 by an LLM judge among the
divergent cases. The observed failure was fluent non-action: the model said it would
perform the required operation but never selected the committing tool.

The important finding is methodological, not the point estimates. **Decision identity is
a coverage split, not outcome evidence for the branch where decisions differ.** A cost
optimization should report at least:

- cost delta and its dataset/rate-table provenance;
- divergence rate and denominator;
- outcome preservation on non-divergent cases;
- outcome preservation on divergent cases, with undecidable cases exposed; and
- the exact success rule used by each adjudicator.

## Why one verdict is not enough

Turnstile's probe reports two adjudicators side by side. Its registry rule asks whether
the required terminal tool committed. Its LLM judge asks whether the caller's issue was
actually solved. The repository reports that a separate lenient “clean-close” adjudicator
marked all 24 conversations resolved while the stricter problem-solved judge marked none
resolved. Thus the earlier ~0.98 identity-preservation result preserved a clean-close
verdict, not necessarily successful task completion.

This is a useful warning for agent evaluation generally: **a preserved label can preserve
the evaluator's blind spot.** Tool-mediated tasks need action/effect evidence in addition
to conversational closure, and cost experiments must not fold disagreeing adjudicators
into one reassuring score.

## Implementation evidence

At the pinned revision:

- [`docs/METHOD.md`](https://github.com/Pranavk098/turnstile/blob/fbed5e7d92f0277ed3f4d348ccb71065777b04f1/docs/METHOD.md)
  records the populations, gates, open-loop result, and small/synthetic caveats.
- [`packages/live/src/turnstile_live/openloop.py`](https://github.com/Pranavk098/turnstile/blob/fbed5e7d92f0277ed3f4d348ccb71065777b04f1/packages/live/src/turnstile_live/openloop.py)
  implements path-divergence detection, a registry/tool-commit rule, a separate LLM judge,
  undecidable accounting, and separate summary fields.
- [`packages/live/tests/test_openloop.py`](https://github.com/Pranavk098/turnstile/blob/fbed5e7d92f0277ed3f4d348ccb71065777b04f1/packages/live/tests/test_openloop.py)
  contains focused tests for divergence, missing required tools, judge parse failure,
  budget refusal, and keeping the two rules separate.
- [`docs/LIMITATIONS.md`](https://github.com/Pranavk098/turnstile/blob/fbed5e7d92f0277ed3f4d348ccb71065777b04f1/docs/LIMITATIONS.md)
  distinguishes replay-executable remedies from detector-only proposals and synthetic
  acoustics from measured real-audio effects.

## Boundaries

This inspection confirms that the repository contains the stated mechanisms; it does not
independently reproduce the paid runs or validate the reported rates. The project had one
GitHub star when inspected, and its documentation is not fully synchronized: the pinned
README still says preservation under different decisions is not yet measured and lists a
different passing-test count than `docs/LIMITATIONS.md`. Treat the numerical results as
repository-reported, small-sample evidence—not external benchmarks or fleet-scale rates.

## Design implication

For any optimization that substitutes a cheaper agent/model, define a **divergence budget**
next to the cost budget. Non-divergent cases may support ordinary replay comparison; divergent
cases require forward execution and effect-level adjudication. If those cases are excluded,
report them as an unresolved risk population rather than allowing the non-divergent
preservation rate to stand in for the whole deployment.
