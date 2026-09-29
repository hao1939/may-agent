<ai_context>
summary: "A pinned inspection of LockedinLabs-AI/agent-console shows that useful coding-agent telemetry depends on an explicit measurement contract: allowlisted metadata projections, stable replay identities, separate source populations, and unknown/unavailable states rather than inferred zero. Its dashboard observes recorded usage; it does not establish productivity or control execution."
triggers: ["coding agent telemetry", "agent observability", "token accounting", "measurement contract", "unknown versus zero", "replay deduplication", "agent-console"]
last_updated: "2026-09-29"
source_basis: "GitHub repository search and static inspection of README, architecture, collector contract, data-flow documentation, schemas, tree, and tests at pinned revision d14755421d4a8b183d43ca227bcf8e2e871b3b27; 44 selected Node tests passed locally."
</ai_context>

# Coding-agent telemetry needs a measurement contract, not just a dashboard

**Date:** 2026-09-29  
**Disposition:** New knowledge  
**Repo:** https://github.com/LockedinLabs-AI/agent-console  
**Inspected revision:** [`d14755421d4a8b183d43ca227bcf8e2e871b3b27`](https://github.com/LockedinLabs-AI/agent-console/commit/d14755421d4a8b183d43ca227bcf8e2e871b3b27)

## Question

What accounting and privacy boundaries are needed before local coding-agent telemetry can support operational decisions?

## What the source implements

Agent Console reads Claude Code and Codex transcripts and projects them into a local dashboard of sessions, token classes, cache use, model IDs, and estimated list-price cost. Its most reusable contribution is not the interface but the explicit measurement boundary beneath it:

- **Allowlisted projection.** A portable usage record has a closed schema containing model, minute timestamp, token classes, provenance, and salted identifiers. Prompts, replies, commands, tool arguments, source files, and full paths have no field in the report contract; records with extra or malformed fields are refused.
- **Replay-safe identity.** Event IDs are keyed hashes of intrinsic transcript identities rather than file paths or offsets. Copies can therefore deduplicate across machines. Cumulative Claude readings retain per-class maxima and add only growth; append and flush occur before the delivery cursor advances, so a retry does not silently lose or double-count accepted growth.
- **Explicit epistemic states.** A missing token class remains `null`; an unrecognized model remains unpriced. Optional telemetry sources stay separate from transcript totals because the same request may appear in both. Coverage reports distinguish unavailable or partial observation from a measured zero.
- **Privacy is a data-flow property.** Cross-machine reports use hashed session and project identifiers and minute-rounded timestamps. Project names, alert summaries, and coarse tool-activity counts are separate opt-ins. The repository documents local files, network destinations, listeners, and retained data rather than relying only on a “local-first” label.

The architecture also draws a critical authority boundary: the dashboard reads recorded usage after the fact and neither routes model calls nor remotely stops an agent. An optional policy compiler can install local Claude Code hooks, but installation is separate from starting the observer, runtime execution is not verified, Codex has no equivalent enforcement adapter, and command classification is not a sandbox.

## Why it matters

A cost graph becomes misleading when its data model collapses absence into zero or merges overlapping sensors. A robust agent control plane should carry at least:

1. **population and provenance** — which event or source produced the reading;
2. **window** — event time, rolling window, or cumulative counter;
3. **coverage** — observed, partial, unavailable, or stale;
4. **identity and replay rule** — how retries, forks, copies, and cumulative updates deduplicate;
5. **estimation status** — measured tokens versus dated list-price estimates;
6. **authority** — whether a signal merely observes, recommends, or can actually block an effect.

This prevents two common category errors. First, token volume and Git activity do not measure productivity, quality, or business value. Second, an alert such as a repeated tool call or spending spike is evidence for investigation, not proof of a loop, failure, or policy violation.

## Verification evidence and limits

The pinned repository tree contained 386 entries and GitHub reported the recursive tree as non-truncated. Scout inspected the README, architecture, collector contract, data-flow document, v0.4 schema, and privacy/accounting tests. Running selected built-in Node tests from the pinned source produced **44 passes, 0 failures**, including schema conformance, projection redaction, replay deduplication, retry behavior, refusal of extra upload fields, separation of optional telemetry sources, and scoped interop credentials.

That test run verifies selected repository contracts in this environment, not real-world accuracy across every Claude Code or Codex transcript version. Scout did not enroll multiple machines, inspect live private transcripts, validate provider invoices, exercise the browser UI, or test power-loss durability. GitHub stars and repository documentation are not evidence of production adoption. List-price estimates explicitly cannot represent subscriptions, negotiated rates, or invoice adjustments.

## Practical guidance

- Define telemetry as a versioned measurement contract before building summaries or alerts.
- Make `unknown`, `unavailable`, `partial`, and `zero` distinct states in storage and UI.
- Deduplicate using stable source-event identity and document cumulative-counter semantics.
- Keep overlapping telemetry populations separate unless a defensible join proves they are disjoint.
- Test privacy at the serialized boundary: arbitrary source fields should be structurally impossible to transmit.
- Label observation and enforcement separately; a dashboard or analytical signal is not an execution gate.

## Sources reviewed

- [README](https://github.com/LockedinLabs-AI/agent-console/blob/d14755421d4a8b183d43ca227bcf8e2e871b3b27/README.md)
- [Architecture and authority boundaries](https://github.com/LockedinLabs-AI/agent-console/blob/d14755421d4a8b183d43ca227bcf8e2e871b3b27/docs/ARCHITECTURE.md)
- [Collector record and delivery contract](https://github.com/LockedinLabs-AI/agent-console/blob/d14755421d4a8b183d43ca227bcf8e2e871b3b27/docs/COLLECTOR-CONTRACT.md)
- [Documented data flows](https://github.com/LockedinLabs-AI/agent-console/blob/d14755421d4a8b183d43ca227bcf8e2e871b3b27/docs/security/DATA-FLOWS.md)
- [Collector tests](https://github.com/LockedinLabs-AI/agent-console/tree/d14755421d4a8b183d43ca227bcf8e2e871b3b27/test)

## Discovery and coverage

GitHub Repository Search API query: `"AI agent" in:name,description,readme created:>=2026-09-15 stars:>=5`, sorted by stars descending with 20 results per page. It returned HTTP 200, `total_count: 945`, and `incomplete_results: false`. This was one complete response page, not an exhaustive review of all 945 matches. Scout selected `LockedinLabs-AI/agent-console`, pinned the commit above, and inspected its complete non-truncated recursive tree plus the files listed here.
