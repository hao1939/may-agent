<ai_context>
summary: "Agent cost telemetry needs parser-shape conformance and separate detection, recommendation, measurement, and settlement verdicts; a fail-closed evidence policy must also constrain claim arithmetic, not merely disclose unsupported rows afterward."
triggers: ["AgentMeasure", "erabot", "token accounting", "agent cost telemetry", "usage dashboard", "cache pricing", "resume accounting", "conformance fixtures", "cost scanner evaluation", "settlement evidence", "UNPROVABLE"]
last_updated: "2026-09-19"
source_basis: "AgentMeasure audit and conformance materials at commits 3a9f58b1ca36b7dae520113163962d3c4f1e345e and a475812d5377c594306fbd87f83aaff36a514527; erabot detector and planted-truth evaluation materials at commit 207a84a6e3165ffead72f081fa824ffe8ae5b468."
</ai_context>

# Agent Cost Telemetry Needs Parser-Shape Conformance

Date: 2026-09-10  
Source: Hacker News  
HN: https://news.ycombinator.com/item?id=49639249  
Repo: https://github.com/roy-tong/AgentMeasure

## Signal

An AgentMeasure audit of roughly 110 AI-usage repositories reports 45 or more
public, evidence-backed accounting defects across Claude Code, Codex, gateways,
evaluation tools, and observability dashboards. The reusable signal is not the
headline count. It is that apparently straightforward token and cost sums fail
at **serialization and lifecycle boundaries** that ordinary happy-path tests do
not represent.

The audit groups recurring failures into concrete fixture shapes:

- Claude Code may serialize one assistant message as several content-block
  lines, each repeating the same message ID and usage; summing lines inflated
  totals by 2–5× in ten reported tools.
- Codex can re-emit cumulative `token_count` totals after compaction or state
  refresh; treating each emission as a delta added 0.5–15% on the cited real
  corpora.
- Anthropic input usage excludes cache tokens while OpenAI input usage includes
  them, and Anthropic cache-write prices differ by TTL; one shared formula can
  double-charge, clamp input to zero, or apply the wrong multiplier.
- Resumed and forked sessions can share an original session ID or replay a
  parent prefix, causing replacement stores to lose history and additive stores
  to duplicate it.
- Streaming protocols distribute usage across different event types and may
  expose cumulative rather than incremental values; early termination can also
  drop a usage-only terminal chunk.
- Embedded model-price snapshots drift independently of parser correctness.

The audit report links each class to public issues or pull requests with pinned
code arguments or synthetic reproductions. At the inspected revision, it says
ten fixes had been merged or accepted and explicitly notes that most audited
repositories passed. This is evidence for recurring, identifiable defect
classes—not evidence that every dashboard is wrong or that AgentMeasure's
counts are an independent ecosystem census.

## Operational implication

A cost receipt needs more than an epistemic label such as “exact” or
“estimated.” It also needs a **versioned accounting contract** that states:

1. the provider and event-schema revision;
2. whether each field is a delta, cumulative snapshot, subset, or inclusive
   total;
3. the deduplication identity and aggregation grain;
4. how compaction, retry, resume, and fork events reconcile;
5. cache category and TTL semantics;
6. the dated price-table revision; and
7. synthetic fixtures that exercise every boundary above through the product's
   own parser and billing path.

This extends the typed-receipt lesson in
[CtxRay](./2026-08-10-github-ctxray-typed-usage-receipts.md): a runtime-emitted
counter can be exact for the event and still become an incorrect session total
when the consumer applies the wrong cardinality or lifecycle rule. Provenance,
economic meaning, and aggregation semantics are separate dimensions.

## Important implementation gap

AgentMeasure's public generic conformance pack should not be mistaken for a
ready-made token-accounting test suite. Its own v0.1 table marks `token-subset`
and `cache-distinction` as **not supported** because the core FMT-002 schema has
no token or cache fields. The repository contains generic operation, retry,
cost-preservation, and evidence-boundary checks, plus some product-specific
healthcheck fixtures, but the checked tree does not expose a general fixture
corpus covering all eight token-accounting hazard classes.

Therefore the audit's linked per-project reproductions are the primary evidence
for the reported defects, while teams adopting the pattern still need to encode
their provider-specific token and cache fixtures. The project's explicit
`UNPROVABLE` result is the right behavior for absent evidence; it should remain
distinct from pass and zero.

## GitHub update — cost scanners need three separate evaluation layers (2026-09-14)

[erabot](https://github.com/rohan3008/erabot) makes a useful separation visible
between finding a model call, recommending an optimization, and measuring its
economic effect. At the pinned revision, its deterministic scanner uses
Tree-sitter patterns plus receiver gates to reject lookalikes such as database
`query`, tool `invoke`, file-management calls, and browser-extension
`sendMessage`. The project's hand-labeled corpus reports about 97% call-site
precision on its held-out sample, while explicitly limiting its 100% recall
claim to 20 unambiguous direct-SDK calls. Custom wrappers and dynamic dispatch
are outside that recall claim.

The repository evaluates its agentic optimization layer separately on ten tiny,
planted-truth fixtures. The committed 2026-09-14 result reports all nine planted
issues found, both clean fixtures left clean, ten unmatched findings, and a raw
`precision_proxy` of 0.474. A separate author adjudication for an earlier run
labels 21 of 24 findings legitimate (0.875), but openly notes both the
self-adjudication bias and duplicate issue framing. These are useful, inspectable
evaluation artifacts; they are not one interchangeable accuracy number.

The economic layer remains separate again. The detector documentation says
monthly spend is modeled from assumed call volume unless the user supplies one,
and agent-loop turns are statically inferred. Some committed audit outputs also
mark model-quality checks `INCONCLUSIVE` when live provider access is absent.
Accordingly, a cost-analysis receipt should carry at least three verdicts:

1. **Detection:** what call sites were in the scanned universe, with precision
   and coverage/recall boundaries?
2. **Recommendation:** was each proposed saving grounded, non-duplicative, and
   quality-preserving, and who adjudicated it?
3. **Economics:** which inputs were measured at runtime versus inferred,
   assumed, or priced from a table?

A synthetic 9/9 recall result can validate fixture discovery without validating
real-repository coverage; a high call-site precision can coexist with weaker
recommendation precision; and a correct recommendation can still have an
unmeasured dollar impact. Collapsing these layers into “the scanner is accurate”
loses the exact boundary operators need.

## GitHub update — fail-closed evidence must change the arithmetic (2026-09-19)

AgentMeasure's draft AMS-1 settlement standard introduces a useful distinction
between **counting integrity** (whether records were altered) and **judgment
integrity** (whether a `resolved` verdict is supportable). Its policy says rows
without incrementality evidence are `cannot settle`, must be removed from the
claim, and must remain distinct from zero. It also keeps provider-counted Tier 1
and affected-party-confirmed Tier 2 separate, and requires disclosure when the
input cannot reveal underbilling.

Static inspection of the pinned implementation reveals a policy-to-code gap.
[`generate_bundle`](https://github.com/roy-tong/AgentMeasure/blob/a475812d5377c594306fbd87f83aaff36a514527/healthcheck/am_healthcheck/settle.py)
counts records whose `incrementality_evidence` is absent or `none` as
`unprovable_count`, but both `settlement_statement` and `statement_markdown`
still compute Tier 1 from every `resolved` or `assumed_resolved` row and Tier 2
from every affected-party `resolved` row. They do not filter those rows by
incrementality evidence. The resulting statement can therefore say unsupported
rows were “removed from any outcome claim” while retaining them in both the
claim counts and dollar arithmetic.

The committed tests make the mismatch especially concrete: their shared
`effect()` fixture omits `incrementality_evidence`, while tests expect those
same rows to contribute to Tier 1, Tier 2, and dollar totals. The tests validate
crossing outcome class with observer grade and printing the `cannot settle`
disclosure, but do not validate that unsupported rows are excluded from the
numbers. Tests were inspected, not executed.

The reusable lesson is that **disclosure is not enforcement**. A fail-closed
billing or outcome policy needs one eligibility predicate used by every count,
amount, export, and display path. Conformance should include an adversarial row
that is semantically resolved and strongly attested but lacks the separately
required evidence, then assert that it appears in the rejection ledger and in
neither payable tier. Otherwise a system can pass presentation tests while its
financial claim violates its own evidence rule.

This is a static finding at draft commit
[`a475812d5377c594306fbd87f83aaff36a514527`](https://github.com/roy-tong/AgentMeasure/commit/a475812d5377c594306fbd87f83aaff36a514527),
not a claim about a released service or the repository after that revision.

## Primary sources

- GitHub discovery query: https://api.github.com/search/repositories?q=%22AI+agent%22+%22MCP%22+pushed%3A%3E2026-09-17&sort=updated&order=desc&per_page=20
- Latest inspected AgentMeasure revision: https://github.com/roy-tong/AgentMeasure/commit/a475812d5377c594306fbd87f83aaff36a514527
- AMS-1 settlement policy: https://github.com/roy-tong/AgentMeasure/blob/a475812d5377c594306fbd87f83aaff36a514527/standard/SETTLEMENT.md
- Machine-readable clause manifest: https://github.com/roy-tong/AgentMeasure/blob/a475812d5377c594306fbd87f83aaff36a514527/standard/settlement.manifest.json
- Bundle and statement implementation: https://github.com/roy-tong/AgentMeasure/blob/a475812d5377c594306fbd87f83aaff36a514527/healthcheck/am_healthcheck/settle.py
- Settlement tests: https://github.com/roy-tong/AgentMeasure/blob/a475812d5377c594306fbd87f83aaff36a514527/healthcheck/tests/test_settle.py
- Settlement conformance ladder: https://github.com/roy-tong/AgentMeasure/blob/a475812d5377c594306fbd87f83aaff36a514527/conformance/README.md
- HN discovery item: https://news.ycombinator.com/item?id=49639249
- Inspected revision: https://github.com/roy-tong/AgentMeasure/commit/3a9f58b1ca36b7dae520113163962d3c4f1e345e
- Audit report: https://github.com/roy-tong/AgentMeasure/blob/3a9f58b1ca36b7dae520113163962d3c4f1e345e/campaigns/audit-report-2026-09.md
- Tool-author hazard guide: https://github.com/roy-tong/AgentMeasure/blob/3a9f58b1ca36b7dae520113163962d3c4f1e345e/campaigns/tool-authors.md
- Conformance-pack scope: https://github.com/roy-tong/AgentMeasure/blob/3a9f58b1ca36b7dae520113163962d3c4f1e345e/conformance/pack/README.md
- erabot inspected revision: https://github.com/rohan3008/erabot/commit/207a84a6e3165ffead72f081fa824ffe8ae5b468
- Deterministic detector evaluation: https://github.com/rohan3008/erabot/blob/207a84a6e3165ffead72f081fa824ffe8ae5b468/docs/precision-eval.md
- Planted-truth evaluation method: https://github.com/rohan3008/erabot/blob/207a84a6e3165ffead72f081fa824ffe8ae5b468/eval/README.md
- Latest committed evaluation result: https://github.com/rohan3008/erabot/blob/207a84a6e3165ffead72f081fa824ffe8ae5b468/eval/results-2026-09-14-verify.json
- Author adjudication and caveats: https://github.com/rohan3008/erabot/blob/207a84a6e3165ffead72f081fa824ffe8ae5b468/eval/ADJUDICATION-2026-09.md
