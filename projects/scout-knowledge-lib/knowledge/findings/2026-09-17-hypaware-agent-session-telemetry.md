<ai_context>
summary: "HypAware treats agent observability as a local queryable event history spanning conversations, API traffic, and OTLP signals, but its content-level capture makes privacy classification, export boundaries, and deletion semantics part of the observability contract rather than optional policy." 
triggers: ["HypAware", "agent observability", "session telemetry", "OTLP", "local-first telemetry", "agent privacy", "telemetry export boundary"]
last_updated: "2026-09-17"
source_basis: "GitHub repository documentation and selected implementation/test files at commit 2581ee4fa705e3326fc67eb95da97779f42ac48f."
</ai_context>

# Agent Observability Needs a Data-Boundary Contract

Date: 2026-09-17  
Source: GitHub  
Repo: https://github.com/hyparam/hypaware  
Inspected revision: https://github.com/hyparam/hypaware/commit/2581ee4fa705e3326fc67eb95da97779f42ac48f

## Observation

HypAware is an early open-source implementation of a unified, queryable history
for local AI-agent activity. Its README says it can ingest Claude Code, Codex,
and OpenCode conversations, raw Anthropic/OpenAI gateway traffic, and
OpenTelemetry logs, traces, and metrics. Records land in a local query cache and
can optionally be exported or forwarded to a central organization server.

This is a useful architectural signal because it joins two evidence planes that
are often kept separate:

- **semantic activity:** prompts, responses, tool calls, working directories,
  token usage, and session identity; and
- **runtime activity:** OTLP logs, spans, metrics, receive errors, and storage
  operations.

The inspected OTLP collector is implementation evidence for part of this claim,
not just repository metadata. It flattens logs, traces, and metrics into separate
datasets, appends rows to the query cache, and annotates receive spans with the
signal type, payload bytes, row count, and parse-versus-persist error kind. A
committed smoke flow boots the plugin, posts one OTLP/JSON log, queries the row,
and specifies checks for the corresponding receive and cache-append spans. I
read that test but did not execute the repository, so it establishes an
inspectable test contract rather than an independently reproduced result.

## The non-obvious lesson: capture and governance are one design

HypAware's own privacy documentation states that conversation capture includes
message text, not only metadata. That makes the privacy boundary inseparable
from the telemetry design. The repository describes three directory classes:

| Class | Local recording | Team forwarding |
|---|---:|---:|
| `sync` | yes | yes |
| `local-only` | yes | no |
| `ignore` | no | no |

The distinctions matter operationally:

- classification is prospective; changing a directory to `ignore` does not
  erase rows already captured;
- local purge does not retract copies already exported or forwarded;
- directory classification depends on a working directory and therefore does
  not govern raw API proxy or generic OTLP sources;
- session ignore is distinct from directory policy and does not delete earlier
  records; and
- attended remote enrollment has a first-sync review hold, whereas documented
  token-based unattended enrollment does not.

These are not small product details. They expose four different control points:
**collection, local retention, export eligibility, and remote deletion**. An
agent-observability system that offers only a single “telemetry on/off” control
cannot express them accurately.

## Reusable design implication

A trustworthy agent event store should attach a data-boundary receipt to each
record or batch, alongside its technical provenance. At minimum, the contract
should identify:

1. source and capture mode (transcript, proxy, hook, OTLP, or import);
2. content class (payload text, tool arguments, metadata, metric, or trace);
3. resolved collection policy and the scope used to resolve it;
4. local retention and deletion state;
5. export eligibility and every destination that accepted a copy; and
6. whether deletion is local-only or confirmed at each downstream destination.

This complements ordinary trace provenance. A span can be technically genuine
while its retention or forwarding status is ambiguous. Conversely, deleting a
local row is not evidence that every exported copy was deleted. Observability
receipts therefore need both **execution lineage** and **data-movement lineage**.

## Limitations

- The repository had seven GitHub stars at inspection time and should be treated
  as an emerging implementation signal, not an ecosystem standard.
- Review covered the README, privacy documentation, OTLP collector, one OTLP
  smoke flow, and the names of Claude OTEL attachment tests at the pinned
  revision; it was not a full security audit or full-repository review.
- The implementation was not installed or run during this assessment.
- Central-server behavior, operator audit trails, end-to-end deletion, and all
  client adapters were not independently verified.

## Primary sources

- Repository: https://github.com/hyparam/hypaware
- Pinned revision: https://github.com/hyparam/hypaware/commit/2581ee4fa705e3326fc67eb95da97779f42ac48f
- README: https://github.com/hyparam/hypaware/blob/2581ee4fa705e3326fc67eb95da97779f42ac48f/README.md
- Privacy controls: https://github.com/hyparam/hypaware/blob/2581ee4fa705e3326fc67eb95da97779f42ac48f/docs/PRIVACY.md
- OTLP receive path: https://github.com/hyparam/hypaware/blob/2581ee4fa705e3326fc67eb95da97779f42ac48f/hypaware-core/plugins-workspace/otel/src/collector.js
- OTLP smoke contract: https://github.com/hyparam/hypaware/blob/2581ee4fa705e3326fc67eb95da97779f42ac48f/hypaware-core/smoke/flows/otel_listener_writes_rows.js
