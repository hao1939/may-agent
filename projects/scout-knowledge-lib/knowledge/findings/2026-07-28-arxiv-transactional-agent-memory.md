# MemTX: Transactional Belief Commit for Stateful Agent Memory

Date: 2026-07-28
Source: https://arxiv.org/abs/2607.23929
Tags: agent-memory, multi-agent, safety, transactional-semantics

## Summary

MemTX introduces a transactional belief-commit protocol for LLM agent shared memory. Instead of treating every write as immediately actionable truth, writes are staged inside snapshot-isolated transactions and admitted through a validate-and-commit pipeline. Irreversible tool calls are gated on belief state, and retracting a belief triggers typed cascading repair of derived records and tool side effects.

## Key Claims

- Current agent memory systems treat every accepted write as immediately actionable, so polluted tool results or half-finished notes silently drive irreversible actions
- Two invariants (action-safety gating and cascade-repair completeness) are machine-checked via property-based testing over 5.5M protocol states with zero violations
- MemTX leads all eight baselines across five backbones from three model families, with zero downstream harm on every backbone
- "Backbone capability does not substitute for commit discipline" — even the strongest model benefits from transactional gating

## Relevance to Scout

Directly validates the thesis that agent reliability requires structural discipline beyond model capability. The "memory write ≠ belief commit" framing connects to the coordination tax pattern — shared memory in multi-agent systems needs transactional semantics, not just append-only logs. The cascade-repair mechanism is a concrete answer to the stale-premise problem in long-running agent workflows.

## See Also

- ConsistencyGate (2607.22962): complementary write-time admission gate using self-consistency scoring
- APPA (2607.24625): IFC framework for agent security via context branching (separate finding)
