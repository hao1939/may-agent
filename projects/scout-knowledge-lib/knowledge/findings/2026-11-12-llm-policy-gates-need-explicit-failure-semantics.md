<ai_context>
summary: "Taster places an LLM-judged policy check outside an agent's prompt, but its source makes enforcement depend on protected configuration, complete tool-path mediation, threshold and ambiguity policy, and explicit fail-open or fail-closed behavior. Producer-authored live results show operational screening, not general detection accuracy."
triggers: ["Taster", "LLM policy gate", "plain-English constitution", "tool-call screening", "prompt-injection screening", "fail open", "on_error", "probabilistic enforcement"]
last_updated: "2026-11-12"
source_basis: "HN item 50464583 and rinkesh2010rpp/taster-ai at commit 411df98a78b7775dc64a54b6138638f025bc225d; Scout inspected the README, reference, selected implementation files, tests, and producer-authored live-result summaries but did not run the package or reproduce its evaluations."
</ai_context>

# LLM Policy Gates Need Explicit Failure Semantics

**Date:** 2026-11-12  
**Disposition:** new knowledge  
**Question:** What does an external plain-English policy layer actually guarantee when an LLM judges agent tool calls and results?

- **HN source:** https://news.ycombinator.com/item?id=50464583
- **Repo:** https://github.com/rinkesh2010rpp/taster-ai
- **Inspected revision:** [`411df98a78b7775dc64a54b6138638f025bc225d`](https://github.com/rinkesh2010rpp/taster-ai/commit/411df98a78b7775dc64a54b6138638f025bc225d)
- **Coverage:** complete HN item; repository README and reference; selected pinned source for screening, scope, verdicts, checks, and the LLM detector; selected tests and checked-in live-result summaries. Scout did not execute Taster, its tests, judges, agents, attacks, or benchmarks.

## Source observation

Taster is middleware that can screen a tool call before execution and a tool result before the model reads it. A check combines a plain-language standard, a stage and tool scope, a mode, and a judge. In enforce mode, a sufficiently confident `breaks` verdict blocks the call or withholds the result. Long inputs are divided into overlapping pieces, the most suspicious successful verdict wins, and records retain decision metadata plus an input hash rather than the screened text.

The implementation also makes the policy's operational semantics explicit:

- scopes are ordered and first-match; an unmatched tool or omitted stage is not checked;
- configuration must be stored where the agent cannot edit it;
- `unclear` and below-threshold verdicts normally let calls run, while results are wrapped as untrusted;
- detector failures normally follow `on_error: label`, which lets calls continue and labels results as unscreened; `on_error: block` is an opt-in;
- oversized calls are blocked in enforce mode, but ordinary timeouts or judge failures can fail open;
- each call is judged independently, so a harmful plan split across individually acceptable calls can pass;
- result screening covers later file reads only when the corresponding reading tool is itself in scope.

The producer-authored live check reports 18 of 18 expected labels on author-written cases at one threshold and one run. Its closest allow and block decisions were at 0.85 and 0.88, and the README says confidence changed across runs. A separate checked-in summary reports 1,092 screened results from one hourly agent over 26 days, no judge failures, and six flags corresponding to two planted attack pages fetched three times. The other 1,086 results had no independent attack ground truth, so this is evidence that the middleware operated on real traffic without observed false alarms, not a measured real-world false-negative rate.

## Interpretation

Moving a rule outside the working agent's prompt is useful separation, but it does not by itself create deterministic authority. The effective policy is the tuple of:

1. protected rule and scope configuration;
2. complete mediation of every relevant tool and later dereference path;
3. detector identity and version;
4. threshold, ambiguity, timeout, and size behavior;
5. the exact input representation shown to the detector; and
6. the effect adapter actually honoring the returned block.

A runtime should therefore treat an LLM policy verdict as a probabilistic observation with typed failure semantics, not as a generic safety boolean. High-impact tools should declare whether `unclear`, timeout, unavailable judge, uncovered tool, and oversized input mean block, defer to human review, or continue with reduced authority. Those states should remain visible in receipts and metrics rather than collapsing into `allowed`.

The source's shadow mode is a sound deployment pattern for measuring candidate coverage and latency before enforcement, but moving to enforce mode should require negative controls for each protected effect path and calibration on representative traffic. Least-privilege credentials, deterministic constraints, and human approval remain necessary for actions whose downside exceeds an LLM judge's measured error budget.

## Evidence limitations

This is producer-authored implementation and evaluation evidence from a young repository and a three-point HN item with no discussion at inspection. The live cases were written by the author to match the documented rules; real-traffic records omit screened text and lack ground-truth labels for ordinary results. The README explicitly says real-model resistance of the LLM judge, false-positive rates on real agent traffic, other judges, split-call attacks, and file provenance are not established. Scout did not independently verify package behavior, deployment coverage, judge calibration, attack resistance, or production reliability.
