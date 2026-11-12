<ai_context>
summary: "Pinned NeMo Helix source shows that fair agent-candidate comparisons require explicit evaluation and test-case identities at ingest, not time windows or temporary agent names. Its intake rejects unknown or deleted evaluation cohorts before storage, preserves compatible field renames only when values agree, and reports partial OTLP rejection in a success response's error list. Scout did not run Helix, its tests, candidate evaluations, Compass analysis, or Studio comparisons."
triggers: ["NeMo Helix", "agent candidate evaluation", "evaluation cohort", "test case identity", "OTLP ingest", "partial acceptance", "trace provenance", "candidate comparison"]
last_updated: "2026-11-12"
source_basis: "Static review of producer-authored GitHub documentation, implementation, and tests at pinned revision bd544d7223e14bfeddc2fd7de7b3600a75795ecd."
</ai_context>

# Agent candidate comparisons need explicit trace cohorts

**Date:** 2026-11-12  
**Disposition:** New source-grounded implementation signal  
**Repo:** https://github.com/NVIDIA-NeMo/nemo-helix  
**Inspected revision:** [`bd544d7223e14bfeddc2fd7de7b3600a75795ecd`](https://github.com/NVIDIA-NeMo/nemo-helix/commit/bd544d7223e14bfeddc2fd7de7b3600a75795ecd)

## Question

How should an evaluation system keep concurrent versions of one agent separate
without losing the ability to compare the same task across candidates?

## What the source implements

NeMo Helix's candidate-evaluation workflow assigns each candidate an explicit
**Evaluation** identity while retaining one shared agent name. Every run can also
carry a **test-case name**. The documentation rejects two tempting substitutes:
time windows mix concurrent and discarded candidates, while temporary agent
names scatter the history of one logical agent across identities.

The intake implementation turns the Evaluation identity into an admission
boundary rather than a display label. Before storing an evaluation-scoped run,
it resolves the named Evaluation in the current workspace and rejects names
that do not exist or refer to a deleted Evaluation. Its OTLP integration tests
specifically verify that rejected spans are not already stored when validation
fails. In a mixed batch, spans for a known Evaluation can be kept while a sibling
naming an unknown Evaluation is dropped.

The compatibility model accepts canonical `evaluation_name` and
`test_case_name` fields as well as deprecated `*_id` aliases, but rejects a
payload when old and new spellings disagree. This preserves migration support
without allowing two identities to be silently collapsed.

## Reusable design signal

**Comparison provenance should be admitted before telemetry is stored.** A
credible candidate comparison needs three related but distinct identities:

1. **Logical agent:** the continuing subject whose behavior is being improved.
2. **Candidate cohort:** the exact prompt, model, tool, or policy variant being
   evaluated.
3. **Test case:** the task identity shared across candidate cohorts so matched
   comparisons and independence counts remain meaningful.

This separation prevents two common attribution failures. Candidate-specific
agent names fragment longitudinal findings, while time-window grouping lets
unrelated or overlapping runs enter the comparison. A test-case key adds a
second protection: repeated attempts at one task should not masquerade as
independent coverage. In the inspected Compass documentation, three failures
from the same named test case count as one independent case for recurrence
thresholds.

The source also exposes an operational hazard in partial-acceptance APIs. OTLP
ingest can return HTTP 200 while dropping spans that name an invalid Evaluation;
the response body's `errors` list carries the rejection. A producer that treats
transport success as storage success can therefore create an apparently clean
but incomplete cohort. The reusable receipt should include at least accepted
and rejected item counts, per-item cohort identity, and rejection reasons—not
only the request status.

A compact evaluation pipeline is therefore:

```text
create immutable candidate cohort with change metadata
  -> validate logical-agent / cohort / test-case identity
  -> reject unknown, deleted, or conflicting identity before storage
  -> return item-level acceptance and rejection receipts
  -> compare matched test cases across cohorts
  -> count independent cases separately from repeated attempts
```

This complements the library's [isolated effect-ledger finding](./2026-11-12-black-box-agent-tests-need-isolated-effect-ledgers.md). Argus isolates the
effect world for each security probe; NeMo Helix contributes the telemetry-side
rule that candidate and task membership must also be explicit, validated, and
receipted before later aggregation.

## Limits and open boundaries

- Scout inspected producer-authored source and tests but did not install NeMo
  Helix, run its test suite, start Intake or Compass, ingest OTLP data, or perform
  a candidate comparison.
- The source establishes declared cohort validation, not that every telemetry
  producer labels every span correctly or that all ingest routes are completely
  mediated.
- A valid Evaluation name does not prove that the candidate's actual prompt,
  model, tools, code, dataset, or environment match its metadata. Stronger
  reproducibility needs immutable configuration or artifact digests.
- The inspected recurrence threshold is a producer policy, not evidence that
  three independent cases is universally sufficient.
- Partial acceptance preserves valid siblings but increases receipt complexity.
  Callers that ignore the response error list can still lose observations.
- Repository metadata and documentation do not establish production adoption,
  benchmark quality, model accuracy, or successful operation at scale.

## Primary inspected sources

- [Candidate evaluation workflow](https://github.com/NVIDIA-NeMo/nemo-helix/blob/bd544d7223e14bfeddc2fd7de7b3600a75795ecd/docs/agents/traces-and-insights/evaluate-agent-candidates.mdx)
- [Trace analysis and independent-case thresholds](https://github.com/NVIDIA-NeMo/nemo-helix/blob/bd544d7223e14bfeddc2fd7de7b3600a75795ecd/docs/agents/traces-and-insights/insights-from-traces.mdx)
- [Evaluation-context compatibility model](https://github.com/NVIDIA-NeMo/nemo-helix/blob/bd544d7223e14bfeddc2fd7de7b3600a75795ecd/services/intake/src/nhx/intake/spans/ingest/evaluation_context.py)
- [Evaluation admission validation](https://github.com/NVIDIA-NeMo/nemo-helix/blob/bd544d7223e14bfeddc2fd7de7b3600a75795ecd/services/intake/src/nhx/intake/spans/ingest/evaluation_context_validation.py)
- [Compatibility and conflict tests](https://github.com/NVIDIA-NeMo/nemo-helix/blob/bd544d7223e14bfeddc2fd7de7b3600a75795ecd/services/intake/tests/test_evaluation_context.py)
- [OTLP pre-storage rejection and partial-acceptance tests](https://github.com/NVIDIA-NeMo/nemo-helix/blob/bd544d7223e14bfeddc2fd7de7b3600a75795ecd/services/intake/tests/integration/spans/test_otlp_ingest_evaluation_context.py)

## Discovery record

GitHub Repository Search API query: `topic:ai-agents stars:>100`, sorted by
`updated` descending, 20 results. The API returned `incomplete_results: false`.
Repository contents were inspected only after pinning the revision above.
