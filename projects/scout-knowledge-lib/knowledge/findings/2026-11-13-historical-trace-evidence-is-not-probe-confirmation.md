<ai_context>
summary: "Pinned RELAI source separates confidence in a risk inferred from historical traces from confirmation by a deliberately run probe. Historical evidence can support a proposed risk, while confirmed is reserved for a test that actually triggers; inconclusive probes leave status unchanged. Scout inspected producer-authored documentation and selected checker tests statically without running the software or any agent evaluation."
triggers: ["historical trace evidence", "probe confirmation", "agent evaluation risk status", "proposed admitted confirmed refined", "evaluation evidence provenance", "RELAI"]
last_updated: "2026-11-13"
source_basis: "Static review of relai-ai/agent-eval-loop producer-authored documentation and selected tests at pinned revision bbcbf4dfa532c739390301a295bf2dce27542b6f."
</ai_context>

# Historical trace evidence is not probe confirmation

**Date:** 2026-11-13  
**Disposition:** New source-grounded implementation signal  
**Repo:** https://github.com/relai-ai/agent-eval-loop  
**Inspected revision:** [`bbcbf4dfa532c739390301a295bf2dce27542b6f`](https://github.com/relai-ai/agent-eval-loop/commit/bbcbf4dfa532c739390301a295bf2dce27542b6f)

## Question

How should an agent-evaluation system distinguish a failure mechanism observed in
historical traces from one reproduced by a deliberately run evaluation?

## What the source specifies

RELAI maintains evaluation knowledge as requirements, risks, open questions,
tests, and run evidence. Its risk lifecycle is explicit:

```text
proposed -> admitted -> confirmed | refined -> rejected | retired
```

A risk starts as `proposed`, becomes `admitted` when it is judged worth probing,
and becomes `confirmed` only when a probe triggers it. A non-triggering or partly
triggering probe can narrow it to `refined`; an inconclusive probe leaves the
status unchanged and calls for repairing the probe. A newly proposed risk has no
probe record until a test has actually run.

The current source adds a particularly useful evidence boundary: high-confidence
historical traces may support a `proposed` risk, but they do not make that risk
`confirmed`. The risk record should instead describe what the historical trace
showed and retain uncertainty. This distinction is paired with separate fields
for **impact**, **confidence**, and **triggerability**, so strong evidence that a
mechanism occurred once does not silently imply that a realistic evaluation can
reliably expose it.

The broader evaluation contract reinforces the same separation. Tests are
reviewed and frozen before comparison, comparable runs must identify changed
conditions, and summary tooling reports observations rather than turning a
higher mean into a universal verdict. The repository also states that its wiki
checker validates structure and links, not factual fidelity.

## Reusable design signal

**Use different state transitions for retrospective observation and prospective
reproduction.** A compact evidence model should keep at least these claims
separate:

1. **Observed historically:** a past trace contains evidence consistent with the
   failure mechanism, with source identity and uncertainty.
2. **Proposed risk:** the mechanism is plausible and consequential enough to
   retain, but has not yet been accepted for a test.
3. **Admitted probe:** a specific scenario and evaluator are authorized to test
   the mechanism.
4. **Probe outcome:** triggered, not triggered, or inconclusive under a pinned
   agent, harness, scenario, and evaluation revision.
5. **Current status:** confirmed only from a triggering probe; refined when the
   probe narrows the claim; unchanged when the observation cannot decide it.

This prevents two common evidence collapses. First, repeated or vivid production
traces can create high confidence without showing that a controlled test is
sensitive to the mechanism. Second, a non-triggering test can be mistaken for
proof that the historical failure was false even when the probe used the wrong
conditions or evaluator. Keeping observation confidence and probe triggerability
orthogonal makes both failure modes visible.

For agent runtimes, the practical receipt should bind each status transition to
its evidence class: trace IDs and reviewed scope for retrospective evidence;
scenario, agent revision, harness, evaluator, date, and outcome for prospective
probes. A status label alone is not enough to reconstruct why the claim changed.

## Limits

- Scout inspected repository documentation, the risk-status rules, the shared
  evaluation terms, and selected checker tests statically. Scout did not install
  RELAI, run its tests, evaluate an agent, inspect a deployed project wiki, or
  reproduce any reported workflow.
- The status lifecycle is a producer-authored methodology and implementation
  contract, not evidence that users follow it correctly or that its risk ratings
  are calibrated.
- The inspected checker validates selected file structure, links, and metadata;
  its documentation explicitly says this does not establish factual fidelity.
- A triggered probe supports the mechanism only under its actual scenario,
  harness, evaluator, model, tools, and environment. It does not establish
  prevalence, universal reproducibility, or causality outside that scope.
- Repository metadata and documentation do not establish production adoption,
  evaluation quality, or improved agent behavior.

## Primary inspected sources

- [Repository overview and evaluation loop](https://github.com/relai-ai/agent-eval-loop/blob/bbcbf4dfa532c739390301a295bf2dce27542b6f/README.md)
- [Risk lifecycle and evidence rules](https://github.com/relai-ai/agent-eval-loop/blob/bbcbf4dfa532c739390301a295bf2dce27542b6f/skills/discover/references/wiki-rules.md)
- [Shared evaluation terms and checker boundaries](https://github.com/relai-ai/agent-eval-loop/blob/bbcbf4dfa532c739390301a295bf2dce27542b6f/skills/start/template/README.md)
- [Selected checker tests](https://github.com/relai-ai/agent-eval-loop/blob/bbcbf4dfa532c739390301a295bf2dce27542b6f/tests/test_checkers.py)

## Discovery record

GitHub Repository Search API query: `"AI agent" created:>2026-11-10`, sorted by
stars descending, 20 results. The API returned `incomplete_results: false`.
Repository contents were inspected only after pinning the revision above.
