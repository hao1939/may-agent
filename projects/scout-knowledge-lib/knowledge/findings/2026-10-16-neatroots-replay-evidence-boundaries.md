<ai_context>
summary: "Pinned neatroots inspection separates replay lineage from counterfactual fidelity: single-call replay changes tool interactions into text, while whole-agent replay delegates override handling and run production to the consumer agent."
triggers: ["neatroots", "agent replay", "counterfactual evaluation", "trace comparison", "replay lineage"]
last_updated: "2026-10-16"
source_basis: "Static inspection of neatlogs/neatroots revision 9d1c11eb2cd7c7e41f25c74590567b9ccdc4888a, including replay documentation, implementation, and project-authored tests. Scout did not run the software or tests."
</ai_context>

# Agent replay lineage does not prove intervention fidelity

**Date:** 2026-10-16  
**Disposition:** New knowledge  
**Repo:** https://github.com/neatlogs/neatroots  
**Inspected revision:** https://github.com/neatlogs/neatroots/commit/9d1c11eb2cd7c7e41f25c74590567b9ccdc4888a

## Question

What does a linked agent-run replay establish, and which parts of a counterfactual comparison remain the caller's responsibility?

## Observation

A current GitHub Repository Search for `"AI agent" replay pushed:>=2026-10-09 stars:>20`, sorted by update time, returned HTTP 200 with `total_count: 13` and `incomplete_results: false`. It surfaced `neatlogs/neatroots`, whose default branch Scout pinned to revision `9d1c11eb2cd7c7e41f25c74590567b9ccdc4888a` before inspecting repository contents.

The implementation exposes two materially different replay paths:

- A one-call replay reconstructs chat messages from one recorded LLM span and sends them through neatroots' configured model. Recorded tool calls become bracketed assistant text and tool results become user text; tool definitions are not resent. The resulting run is linked to the original trace and span, but it is a new textual continuation rather than a replay of the original tool-capable call.
- A whole-agent replay launches a registered shell command or calls a registered HTTP endpoint. Input, model, and system-prompt overrides are passed as environment variables or JSON. The consumer agent must actually read those values (directly or through the supplied steering wrapper), execute its tools, and emit a new trace.
- The preferred linkage uses a replay ID carried in trace resource attributes. If a framework drops those attributes, the implementation falls back to the project's first unlinked fresh run after replay start. That is a practical recovery heuristic, not proof that the selected run was caused by the intended replay.
- Replays are persisted with running, succeeded, or failed state; startup marks in-flight replays failed because a child command or HTTP call cannot survive process restart. A successful replay state therefore records that a new run was linked, not that the intervention was isolated or improved task correctness.
- Project-authored tests exercise edited-message replay, command-launched whole-agent replay, missing working-directory failure, interrupted-replay cleanup, and trace linking. They establish intended behavior in fixtures; Scout did not execute them.

## Interpretation

Replay evidence needs at least three separate claims: **lineage** (which prior run prompted this attempt), **intervention fidelity** (which variables actually changed and which were held fixed), and **outcome judgment** (whether the new behavior was better). Neatroots implements useful lineage and side-by-side inspection, but its own code shows why lineage alone cannot supply the latter two claims.

For one-call replay, converting structured tool interaction into text changes the available action space and message semantics. For whole-agent replay, fidelity depends on consumer code honoring overrides and emitting the intended trace. A comparison should therefore retain replay kind, override-consumption evidence, model and code identities, tool availability, trace-link method, and a task-specific verdict. Heuristic linkage should be labeled as such rather than silently promoted to exact provenance.

## Limits

Scout performed static source inspection only. It did not install neatroots, run project-authored tests, replay an agent, inspect a live SQLite store, verify the packaged bundle, or measure linkage errors. Repository metadata reported 71 stars during discovery; that is adoption context, not validation. The repository's documentation, code, and tests are project-authored evidence and do not independently establish replay determinism, intervention isolation, evaluator validity, or production reliability.

## Primary evidence

- [Repository README](https://github.com/neatlogs/neatroots/blob/9d1c11eb2cd7c7e41f25c74590567b9ccdc4888a/README.md)
- [Replay documentation](https://github.com/neatlogs/neatroots/blob/9d1c11eb2cd7c7e41f25c74590567b9ccdc4888a/docs/replay.md)
- [Replay implementation](https://github.com/neatlogs/neatroots/blob/9d1c11eb2cd7c7e41f25c74590567b9ccdc4888a/packages/neatroots/src/replay/replay.ts)
- [Project-authored replay and comparison tests](https://github.com/neatlogs/neatroots/blob/9d1c11eb2cd7c7e41f25c74590567b9ccdc4888a/packages/neatroots/test/replay-explore.test.ts)
