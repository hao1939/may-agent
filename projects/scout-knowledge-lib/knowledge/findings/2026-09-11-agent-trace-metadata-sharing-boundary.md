<ai_context>
This finding separates content removal from anonymity when operational AI-agent traces are shared. It is based on a pinned GitHub implementation and documentation, not on an independent execution of the software. Use it when designing trace export, incident-sharing, or observability policy.
</ai_context>

# Content-Free Agent Traces Can Still Disclose Operational Shape

**Date:** 2026-09-11  
**Source:** GitHub repository discovery and pinned source inspection  
**Repo:** https://github.com/FankChen/tracecrate  
**Pinned revision:** [`1c92be40abb75114033ba2624e386e55e51f42e2`](https://github.com/FankChen/tracecrate/tree/1c92be40abb75114033ba2624e386e55e51f42e2)

## Observation

TraceCrate is a new client-side workbench for selected Claude Code, Codex, native, and partial OTLP JSON traces. Its most useful design signal is not the viewer itself but the explicit distinction between **removing trace content** and **anonymizing the remaining execution shape**.

At the pinned revision, its default `structure` export uses an allowlist rather than regex-only scrubbing. The implementation replaces trace and event identifiers, genericizes event names, excludes model and arbitrary content/input/output fields, and remaps known parent links. But it deliberately retains event kind, status, order, parent relationships, timestamps, durations, and usage when present ([export implementation](https://github.com/FankChen/tracecrate/blob/1c92be40abb75114033ba2624e386e55e51f42e2/src/core/export.ts#L88-L137)). Its privacy table states the same boundary and warns that timing, relationships, statuses, and metrics may reveal business activity, workloads, working hours, or identifiable patterns ([privacy documentation](https://github.com/FankChen/tracecrate/blob/1c92be40abb75114033ba2624e386e55e51f42e2/docs/privacy.md#two-export-modes)).

This is stronger than claiming that a generic “redacted trace” is safe. It exposes two separately testable properties:

1. **Content minimization:** arbitrary text, original names, model labels, and original identifiers do not survive the strict transform.
2. **Residual-shape disclosure:** the transformed event graph and its timing/usage labels may still fingerprint a workflow or disclose operating cadence.

The repository also distinguishes strict structure export from opt-in pattern redaction. Pattern mode preserves text after best-effort matching and explicitly does not claim coverage for all code, prompts, names, URLs, paths, proprietary facts, encodings, or future secret formats. That makes “redacted” a mode with a declared threat boundary, not a binary safety property.

## Evidence boundary

Repository Search API query `topic:ai-agents created:>=2026-09-08`, sorted by stars, returned `total_count: 1519` and `incomplete_results: false`; TraceCrate appeared as `FankChen/tracecrate`. Repository metadata and README claims were not treated as proof of behavior. The inspected tree was pinned to commit `1c92be40abb75114033ba2624e386e55e51f42e2`, and the allowlist/remapping claims above come from source at that revision.

The project records a tested v0.1.0 release at earlier commit `52d9ae9b73f815c264a3eb39f5fc3eedc5cb9715`, including 107 unit tests and 36 browser tests, while explicitly limiting its coverage and verification claims ([verification record](https://github.com/FankChen/tracecrate/blob/1c92be40abb75114033ba2624e386e55e51f42e2/docs/verification.md)). Scout did not independently run the application, audit all adapters, or validate anonymity against real traces. The later pinned revision is therefore source evidence for the transform design, not independent proof that every build or input path is safe.

## Design implication: authorize shape disclosure separately

An agent platform should model trace sharing as at least two permissions:

- **content disclosure authority** for prompts, tool arguments/results, names, and model labels;
- **operational-shape disclosure authority** for event topology, timestamps, durations, statuses, and token usage.

A structure-only export may satisfy the first policy while violating the second. Before release, produce a machine-readable field manifest, test forbidden-field absence, and review the retained graph against an explicit recipient and purpose. For stronger minimization, offer independent controls for relative time bucketing, timestamp removal, relationship flattening, status suppression, and usage aggregation rather than forcing users to choose between full structure and full text.

This creates a useful observability rule: **the same provenance that makes an agent run diagnosable can make a sanitized trace linkable.** Diagnostic completeness and safe disclosure should be measured independently. “No prompt text remains” is evidence of content minimization; it is not evidence of anonymity.
