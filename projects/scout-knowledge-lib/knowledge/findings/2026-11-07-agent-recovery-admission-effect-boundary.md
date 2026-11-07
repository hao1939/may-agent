<ai_context>
summary: "Pinned review of Rui: lightweight dormant agent sessions come from durable facts without per-session workers, while crash recovery must replay committed admission answers but preserve uncertain external effects instead of replaying them."
triggers: ["Rui coding agent", "lightweight waiting agents", "agent crash recovery", "admission replay", "indeterminate tool effect", "durable agent session"]
last_updated: "2026-11-07"
source_basis: "HN item 50403797 plus static inspection of DivyanshGolyan/rui documentation, repository tree, and project-authored qualification records at commit 0d033ccd801090647aa0f819827baa2c6cacc19f; Scout did not build or run Rui, its tests, a provider, Bash recovery, or memory qualification."
</ai_context>

# Lightweight waiting agents need durable facts, not resident workers

**Date:** 2026-11-07  
**Disposition:** new knowledge  
**Question:** What architecture supports many waiting coding-agent sessions without making crash recovery replay unsafe?  
**HN source:** [item 50403797](https://news.ycombinator.com/item?id=50403797)  
**Repo:** https://github.com/DivyanshGolyan/rui  
**Reviewed version:** commit [`0d033ccd801090647aa0f819827baa2c6cacc19f`](https://github.com/DivyanshGolyan/rui/commit/0d033ccd801090647aa0f819827baa2c6cacc19f)  
**Coverage:** project README, architecture and verification documents, qualification inventory, complete repository tree, and selected project-authored measurement descriptions. Scout did not execute the software or independently reproduce any result.

## Source observation

Rui is a local Zig/SQLite coding-agent runtime whose useful design signal is more precise than the HN headline about “100 waiting coding agents in 2.5 MB.” Its architecture says dormant sessions and terminal turns retain no resident graph, worker, socket, or execution credit. Runnable state is derived from committed queue, turn, operation, permission, and effect facts. When capacity is unavailable, work remains durable without a per-session worker or spinning process; lost in-memory notifications cannot lose the work.

The same design separates two very different kinds of retry:

1. **Admission replay.** Every state-changing caller command has a stable idempotency key. A matching resend recovers the original committed acceptance or rejection and its original work binding, even after newer work or a process crash. It does not enqueue a second message or reinterpret the request against current state.
2. **Effect recovery.** If the host crashes after a Bash attempt was admitted but before its result was committed, the durable facts cannot prove whether launch or mutation happened. Rui records an indeterminate tool result and does not automatically rerun the command. A committed result remains authoritative.

This means “resume after restart” is not one operation. Durable queue facts can safely make unfinished internal work discoverable again, while an external effect that crossed an uncertain boundary must remain uncertain.

## Interpretation

A scalable waiting-agent runtime should make **waiting a database state, not an allocated actor**. Session identity, admitted input, prerequisites, attempt ownership, and terminal results can persist without retaining a model process, socket, timer, or in-memory conversation graph per session. A bounded scheduler can derive a small runnable frontier from indexed durable facts.

Crash safety then depends on preserving three identities separately:

- **caller command identity**, which makes a lost admission reply recoverable;
- **operation/attempt identity**, which binds execution and settlement;
- **external effect identity or evidence**, which determines whether retry is safe.

The first can be replayed exactly because it recovers a committed decision. The third cannot be inferred from a missing response. Reusing the word “idempotent” for both hides the dangerous gap: request deduplication does not make arbitrary Bash or provider effects exactly once.

The HN memory headline also needs a measurement boundary. Rui’s retained qualification records report several different counters and workloads. One pinned macOS queue run with 10,000 historical, 1,000 stopped, and 100 eligible sessions reports a 5,654,016-byte conservative lifetime-peak physical-footprint upper bound and 10,190,848 RSS bytes while its first request was held. Other 100-operation output workloads report peaks around 20.5 MiB. These are project-authored, workload-specific measurements using deterministic loopback providers, not one universal “per 100 agents” number. The durable-state design is the transferable result; the headline number is not.

## Comparison with existing Scout knowledge

This source complements [Agent Runtime Effect Integrity](../agent-runtime-effect-integrity.md), which already explains why unknown effects must survive replanning, and [Durable browser tasks must reconcile uncertain effects before retrying](./2026-09-29-durable-browser-agent-effect-reconciliation.md), which applies that rule to browser work. Rui is a distinct implementation subject and adds the coupled scheduling lesson: large dormant populations can stay cheap precisely because canonical lifecycle state is durable and runnable work is derived rather than represented by one resident worker per session.

## Limitations

Rui is in development. Its README says file editing and structured answers are not yet available. Commands run with the user’s full authority; the project directory is not a sandbox, and detached processes or blocked I/O can outlast stop requests. The documented recovery promise covers a terminated Rui process followed by restart on supported local storage; it does not add a guarantee for OS crashes, power loss, storage failure, or exactly-once external effects.

Scout performed static inspection only. The repository-authored qualification evidence uses controlled fixtures and explicitly does not qualify every live provider, TLS path, mixed 1,000-operation workload, filesystem power-loss case, or detached-descendant behavior. Scout did not build Rui, run tests, inspect every source path, reproduce a crash, execute Bash, verify SQLite durability on hardware, or reproduce the memory measurements. The HN item had one point and no comments when retrieved, so it is discovery evidence rather than community validation.
