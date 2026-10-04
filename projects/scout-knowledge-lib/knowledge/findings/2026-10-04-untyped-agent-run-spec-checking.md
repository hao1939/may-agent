<ai_context>
summary: "Untyped applies one bounded TLA+ protocol model both to design configurations and to recorded harness event streams, distinguishing invariant violations from traces that the model cannot explain. It is a compact pattern for checking retry/idempotency, approval, and budget assumptions against execution evidence, but it is new, narrow, safety-only, and its bundled traces are hand-written rather than production recordings."
triggers: ["Untyped", "TLA+ agent trace validation", "agent retry invariants", "recorded run checking", "idempotency key", "approval timeout", "budget scope"]
last_updated: "2026-10-04"
source_basis: "HN item 49953789 and static inspection of untyped-ai/untyped at revision 4da0814e85a9c796be2536373a6f4f57d20b7dee, including its README, model, trace adapter, check script, example logs, and CI. Scout verified pinned tool hashes but could not execute the checks because this environment has neither make nor Java."
</ai_context>

# One protocol model can check both harness designs and recorded agent runs

**Date:** 2026-10-04  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=49953789  
**Repo:** https://github.com/untyped-ai/untyped  
**Inspected revision:** [`4da0814e85a9c796be2536373a6f4f57d20b7dee`](https://github.com/untyped-ai/untyped/commit/4da0814e85a9c796be2536373a6f4f57d20b7dee)

## Question

What does Untyped add to verification of side-effecting agent harnesses under retries and crashes?

## Source-grounded finding

Untyped is a small TLA+ model of the protocol between an agent harness, a retrying durable-execution runtime, and a side-effecting tool. It deliberately leaves the LLM's choice and ordering of steps unconstrained. Instead, it models infrastructure decisions that should be deterministic and reviewable:

- whether an idempotency key is scoped to a logical step, a retry attempt, or absent;
- whether a timed-out approval aborts or proceeds;
- whether a call budget survives retries; and
- how lost acknowledgements, dropped calls, and redelivery interact with those choices.

The model checks three safety invariants: at most one effect per step, approval before a destructive effect, and total calls within budget. Its one-line configuration variants produce counterexamples for per-attempt idempotency keys, missing keys, fail-open approval timeouts, and per-attempt budget counters. A separate negative control requires an effect to remain reachable, reducing the risk that all safety checks pass only because the harness never calls a tool.

The more reusable contribution is that the same protocol model is also used as a trace oracle. A JSONL header supplies the run's declared configuration, followed by events such as `Grant`, `Call`, `Timeout`, and `Ack`. The trace adapter advances only through model transitions compatible with each observed event while leaving unlogged fields nondeterministic. It reports three materially different outcomes:

1. **accepted:** the trace is a modeled behavior and no invariant breaks;
2. **violated:** the trace is a modeled behavior and is itself a counterexample; or
3. **rejected:** some observed event cannot occur under the declared protocol.

That distinction prevents an out-of-model log from being mislabeled as a clean run. It also exposes ambiguity honestly: a timeout without tool-side evidence can branch into either a dropped call or a lost acknowledgement. Passing means only that no modeled branch violates an invariant within the declared bounds and available events.

## Why this is useful for agent runtimes

Agent-runtime evidence often separates design-time models from execution receipts. Untyped demonstrates a compact bridge: name the retry, approval, idempotency, and budget contract once, then ask both whether the configured design admits a bad interleaving and whether a recorded execution belongs to that contract. For a production adaptation, a completion or recovery receipt could be normalized into a pinned trace schema and checked against the exact protocol revision that governed the run.

The operational pattern is:

1. encode infrastructure assumptions and safety guarantees independently of model output;
2. include negative controls so a passive system cannot satisfy safety vacuously;
3. pin the protocol revision, bounds, configuration, and trace schema with each verdict;
4. distinguish a genuine invariant counterexample from an event stream the model rejects;
5. retain counterexample states as reproducible recovery evidence; and
6. treat missing events as an observability defect, not as permission to infer success.

This complements [runtime replay evidence and boundaries](../agent-runtime-replay-evidence-and-boundaries.md): replayable receipts become stronger when the runtime can also state whether their event sequence is admitted by a reviewed protocol model.

## Evidence and limits

- Static inspection confirmed the model's three invariants, transition choices, trace adapter, expected-exit-code checks, example JSONL traces, and CI command. The repository pins hashes for its bundled TLA+ and CommunityModules JARs; Scout independently matched those two hashes after cloning the inspected revision.
- Scout could not reproduce the model-checking results here: `make` was unavailable, and direct execution of `check.sh` returned exit 127 because Java was also unavailable. The README's state counts and expected verdicts therefore remain author-reported.
- The four bundled trace files are explicitly hand-written examples, not recordings from real frameworks. A separate [`untyped-ai/receipts`](https://github.com/untyped-ai/receipts) repository currently lists one LangGraph reproduction, but Scout did not assess or execute that reproduction in this finding.
- The model is intentionally narrow. It checks bounded safety properties, not liveness, application-level correctness, authorization completeness, tool semantics, or whether the event log itself is faithful.
- Trace validation cannot recover omitted events. If an omission makes the visible sequence impossible, the trace is rejected; if an important real event leaves no observable contradiction, the model cannot discover it.
- An accepted trace is one observed path, not a proof about the harness code. Conversely, bounded model checking proves only the explored configuration and bounds.
- The repository was created on the observation date, had no stars in the retrieved metadata, and had no HN discussion. There is no independent adoption or maturity evidence yet.

## Sources reviewed

- [HN item 49953789](https://news.ycombinator.com/item?id=49953789)
- [Untyped README at the inspected revision](https://github.com/untyped-ai/untyped/blob/4da0814e85a9c796be2536373a6f4f57d20b7dee/README.md)
- [`harness.tla`](https://github.com/untyped-ai/untyped/blob/4da0814e85a9c796be2536373a6f4f57d20b7dee/harness.tla)
- [`trace/harnessTrace.tla`](https://github.com/untyped-ai/untyped/blob/4da0814e85a9c796be2536373a6f4f57d20b7dee/trace/harnessTrace.tla)
- [`check.sh`](https://github.com/untyped-ai/untyped/blob/4da0814e85a9c796be2536373a6f4f57d20b7dee/check.sh)
- [CI workflow](https://github.com/untyped-ai/untyped/blob/4da0814e85a9c796be2536373a6f4f57d20b7dee/.github/workflows/check.yml)
- [Receipts repository at revision `403cf83d3690afba9c5d21ae8adec6ce22dd1894`](https://github.com/untyped-ai/receipts/tree/403cf83d3690afba9c5d21ae8adec6ce22dd1894)

## Discovery coverage

The live HN Algolia `search_by_date` query for `agent` stories (20 newest hits) surfaced item 49953789. It was selected because it contributes an inspectable protocol model and trace-validation mechanism rather than only product claims. Case-insensitive searches for the HN item ID and primary repository URL found no existing Scout note. Broader TLA+ searches found related verification notes, but none covered this source or its design-and-trace reuse pattern, so a distinct source-level finding was warranted.
