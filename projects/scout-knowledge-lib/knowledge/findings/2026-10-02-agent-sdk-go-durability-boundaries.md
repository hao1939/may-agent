<ai_context>
summary: "Pinned source inspection of agenticenv/agent-sdk-go: completed steps are journal-cached, in-flight steps may retry, local reconnect is step-level, and the documented offset protocol leaves application processing outside the durability boundary."
triggers: ["agenticenv/agent-sdk-go", "Agent SDK for Go", "durable agent stream", "step replay", "stream offset", "crash-resilient tool call"]
last_updated: "2026-10-02"
source_basis: "Scout reviewed HN 49936287 plus repository metadata, README, durable-execution documentation, local durable engine, agent loop, stream handle, and project-authored durability/stream tests at pinned revision a376caadafb856685b4149b20a248d6a91e0a858. Scout did not clone, build, or execute the project."
</ai_context>

# Durable agent execution still has separate step, effect, and consumer checkpoints

**Date:** 2026-10-02  
**HN:** https://news.ycombinator.com/item?id=49936287  
**Repo:** https://github.com/agenticenv/agent-sdk-go  
**Inspected revision:** [`a376caadafb856685b4149b20a248d6a91e0a858`](https://github.com/agenticenv/agent-sdk-go/commit/a376caadafb856685b4149b20a248d6a91e0a858)  
**Disposition:** New knowledge; no existing Scout note declared this repository as a primary source.

## What the source supports

`agent-sdk-go` is an Apache-2.0 Go framework that presents one agent API over an
in-process `durable-go` runtime, Temporal, and Restate. The local implementation
wraps LLM and tool execution in stable, journaled step IDs. On recovery, a completed
step's recorded result can be returned without invoking its function again; an
in-flight step is retried. Local reconnect loads completed or failed step records
and emits one coalesced `step_replayed` event for each before continuing with live
events. Project-authored tests cover completed-step replay while a run waits for
approval, rejection of nonzero local stream offsets, approval double-resolution,
and persistence of circuit-breaker state.

That is meaningful durability, but it is not one end-to-end exactly-once guarantee.
The source exposes three different checkpoints:

1. **Runtime step checkpoint.** A completed `RunStep` is cached in runtime history;
   an incomplete LLM or tool step can execute again after recovery.
2. **External-effect checkpoint.** A tool may mutate a remote system before its
   `RunStep` result is durably recorded. If the process fails in that interval, a
   retry can repeat the mutation unless the tool or provider supplies an idempotency
   key, receipt lookup, transaction, or reconciliation path.
3. **Consumer checkpoint.** Temporal and Restate streams expose durable offsets,
   but the documented five-step reconnect protocol tells clients to save each
   received offset *before* processing the event, then skip offsets less than or
   equal to the saved value after restart. A crash between those two actions can
   leave an event durably delivered yet never processed by the application. Moving
   the save after processing reverses the tradeoff and permits duplicate processing
   unless the consumer is idempotent or commits its effect and offset together.

The local runtime has a narrower reconnect contract. It rejects nonzero offsets and
replays completed history at step granularity rather than reconstructing original
token events. The documentation also says `GetAgentStream` is available only while
the run is still executing; a finished run returns `ErrRunAlreadyCompleted` and no
longer exposes its stream log through that API. Persisting the run ID immediately is
therefore necessary but does not itself provide a durable application inbox.

## Reusable operating rule

Evaluate "crash-resilient" agent systems with explicit cut points rather than one
availability label:

- crash before, during, and after an LLM or tool call;
- crash after the external effect but before the runtime step receipt;
- crash after stream delivery but before application handling;
- reconnect while work is active and after it has already reached a terminal state;
- distinguish exact token replay from coalesced step-history replay; and
- test resolved human approvals independently from subscriber reconnection.

For consequential tools, pass provider-level idempotency identities through the
agent step and retain externally verifiable receipts. For stream consumers, define
whether the offset means **delivered**, **processed**, or **effect committed**; use
an atomic inbox/outbox or idempotent handler when event handling itself matters.
Runtime history, business-effect settlement, and consumer progress should remain
separate observable facts.

## Evidence limits

Scout inspected selected source and documentation at one revision but did not run
Go tests, kill a process, exercise Temporal or Restate, invoke a real LLM, or trigger
a real external tool effect. The crash and reconnect behavior is therefore
repository-authored implementation and test evidence, not independent operational
validation. HN 49936287 had one point and no comments in the retrieved Algolia item;
it is discovery evidence, not adoption evidence. The repository metadata reported
56 stars and seven forks at retrieval.

The README says every runtime provides crash-resilient execution, while fidelity
and liveness differ materially: local recovery needs a later process to reconnect,
local stream history is step-level, and distributed execution depends on Temporal
or Restate. The local journal is plaintext JSON by default and may contain prompts,
tool arguments, and results; the documentation recommends a caller-owned payload
codec, journal MAC, and approval-token key when those controls are required.

## Primary sources

- [Repository README](https://github.com/agenticenv/agent-sdk-go/blob/a376caadafb856685b4149b20a248d6a91e0a858/README.md)
- [Durable execution and reconnect protocol](https://github.com/agenticenv/agent-sdk-go/blob/a376caadafb856685b4149b20a248d6a91e0a858/docs/advanced/durable-execution.mdx)
- [Local durable engine and step-history replay](https://github.com/agenticenv/agent-sdk-go/blob/a376caadafb856685b4149b20a248d6a91e0a858/internal/runtime/local/durable_engine.go)
- [LLM and tool step boundaries](https://github.com/agenticenv/agent-sdk-go/blob/a376caadafb856685b4149b20a248d6a91e0a858/internal/runtime/local/agent_loop.go)
- [Local stream offset boundary](https://github.com/agenticenv/agent-sdk-go/blob/a376caadafb856685b4149b20a248d6a91e0a858/internal/runtime/local/stream_handle.go)
- [Local durability tests](https://github.com/agenticenv/agent-sdk-go/blob/a376caadafb856685b4149b20a248d6a91e0a858/internal/runtime/local/durable_test.go)
- [Local stream-handle tests](https://github.com/agenticenv/agent-sdk-go/blob/a376caadafb856685b4149b20a248d6a91e0a858/internal/runtime/local/stream_handle_test.go)

## Discovery and library comparison

Scout checked the current HN Algolia feed
`search_by_date?query=agent&tags=story&hitsPerPage=20`; HN 49936287 linked this
repository. A case-insensitive search across Scout knowledge found no declaration of
`agenticenv/agent-sdk-go`, its repository URL, or its title. Existing notes cover
Jelly's deliberate interruption boundary and LetItLoop's step/effect crash window.
This source adds a distinct multi-runtime SDK case and, especially, the separate
consumer-offset crash window; it does not replace those assessments.
