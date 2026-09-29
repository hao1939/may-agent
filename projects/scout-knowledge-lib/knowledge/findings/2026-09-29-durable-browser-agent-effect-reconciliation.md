<ai_context>
summary: "A pinned inspection of fab shows a useful durability contract for browser agents: commit output before delivery, assign replay identities, checkpoint confirmed work, and stop for explicit reconciliation when a crash or failure leaves a browser effect uncertain. These mechanisms reduce blind retries but do not prove that an effect was correct, make a caller's resolution true, or independently validate the project's self-reported speed and success results."
triggers: ["fab browser CLI", "durable browser agent", "browser effect reconciliation", "uncertain agent effects", "at-least-once agent output", "browser task replay"]
last_updated: "2026-09-29"
source_basis: "HN item 49899942 plus static inspection of ianks/fast-agentic-browser at pinned revision 758a66c5de51494163bed57c3ff689d3b137beeb: README, complete repository tree, output contract, task command and runtime implementations, selected task tests, and benchmark log. Scout did not install or run fab, connect a browser or password manager, reproduce a crash, execute the benchmark, or independently validate site effects."
</ai_context>

# Durable browser tasks must reconcile uncertain effects before retrying

**Date:** 2026-09-29  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=49899942  
**Repo:** https://github.com/ianks/fast-agentic-browser  
**Inspected revision:** [`758a66c5de51494163bed57c3ff689d3b137beeb`](https://github.com/ianks/fast-agentic-browser/commit/758a66c5de51494163bed57c3ff689d3b137beeb)

## Question

What durability contract can prevent a browser-using agent from blindly repeating a possibly completed action after a crash or ambiguous failure?

## Source-grounded observations

`fab` is a young Rust CLI that translates natural-language browser requests into browser work and emits JSON Lines. Its strongest reusable idea is not the natural-language interface but the explicit separation between **confirmed work**, **uncertain effects**, and **output delivery**:

- Every run emits a `start` record carrying a task ID, zero or more records, and one terminal `end` on handled success or failure. If the process dies before `end`, the documented state is unknown rather than silently successful.
- Output records are committed to the task store before being streamed. `(task, seq)` is a replay identity, resumed runs continue sequence numbers, and repeating a request ID replays the prior records and answer instead of rerunning the browser work. Delivery is explicitly at least once, so the consumer remains responsible for deduplication.
- The runtime opens a journaled effect before dispatch, checkpoints confirmed planner calls and program continuations, and recovers an interrupted task. A failure after an action or planner call, or an interruption mid-call, pauses with a pending uncertain effect instead of becoming an ordinary retryable failure.
- Resume is rejected while a pending effect exists. The caller must first resolve that exact effect as applied, not applied, or—only for selected program requests—observed from the current page. Resolutions require a reason, are scoped to the task and session, and update the task revision.
- Definite pre-effect failures such as invalid arguments, invalid programs, schema mismatch, or budget exhaustion finish as failures rather than manufacturing an unnecessary reconciliation step.

The reusable pattern is **journal before dispatch, commit before delivery, and reconcile before retry**. It avoids conflating three different questions: whether the command process returned, whether an external browser effect happened, and whether output reached the consumer.

## Why reconciliation is not proof

The implementation reduces duplicate work but does not turn an assertion into ground truth:

1. **An applied resolution is caller-supplied evidence.** The command accepts a reason and result for the pending effect; the task store can preserve who said what within its session model, but the static review did not establish an independent verifier for that assertion.
2. **Page observation has limited semantics.** Current page state can support selected program-effect reconciliation, but a changed page may not prove the intended server-side transaction, and an unchanged page may not prove nothing happened. Payments, messages, jobs, and other external systems need provider-owned IDs or fresh authoritative reads.
3. **At-least-once delivery still needs consumers to deduplicate.** `(task, seq)` names emitted records, not downstream side effects created by a consumer that processes them twice.
4. **A task/session identifier is not an authorization proof.** The inspected command layer rejects cross-session task access, but this review did not trace the full local authentication, OS isolation, browser-profile sharing, or authorization boundary.
5. **Durability does not establish semantic correctness.** A fully committed run can click the wrong control, act outside authority, or return a schema-valid but incorrect result. Browser state, user consent, and effect correctness remain separate checks.

## Evaluation evidence and limits

The repository reports a blind `held-out-3` gate of 40 tasks on 20 generated applications, with 160 runs per arm. Its benchmark log reports 92.5% success, 16.6-second median time, and $0.0044 per task for fab's agent mode versus 73.1%, 40.7 seconds, and $0.0133 for an LLM using `chrome-devtools-mcp`. The log describes an isolated task author, strict outcome checks, concurrent arms, and later disclosures of post-gate failures and tuning.

Those figures are useful author-reported evidence, not an independent benchmark. Scout did not run the suite, inspect every fixture and scorer, reproduce provider conditions, or validate whether generated applications represent production websites. The repository was created four days before observation and GitHub reported zero stars. The pinned commit itself reports a post-gate change from 32/40 to 33/40 on the same held-out suite, so those later measurements are no longer blind evidence for that change.

## Operational implication

A durable browser runner should retain at least:

- a stable request identity and task revision;
- a pre-dispatch effect record;
- checkpoints only for confirmed work;
- output sequence identities and replay semantics;
- a distinct uncertain state when execution may have crossed an effect boundary;
- an explicit ban on resume until uncertainty is reconciled;
- the evidence, actor, and reason used for reconciliation; and
- provider-owned receipts or fresh authoritative state for consequential effects.

The final rule matters most: **do not retry merely because the client timed out**. Reconcile the actual external state first. When authoritative evidence is unavailable, preserve uncertainty rather than converting it into success or rerunning an irreversible action.

## Comparison with existing Scout knowledge

This complements [unattended execution and replay](../agent-runtime-unattended-execution-and-replay.md), which covers durable job architecture broadly, and [browser checkout identity, consent, and completion](./2026-09-29-shopify-checkout-webmcp.md), which uses provider-returned completion state for purchases. `fab` is a distinct primary source and adds an inspectable local mechanism for task journaling, committed output replay, and mandatory reconciliation of uncertain browser effects.

## Verification evidence and limits

Scout inspected the complete, non-truncated GitHub tree and read the README, `docs/output.md`, `crates/fab/src/task_commands.rs`, `crates/fab/src/task_runtime.rs`, task-store paths and selected tests, and `bench/LOG.md` at the pinned revision. The code contains pre-dispatch effect records, checkpoints, interrupted-task recovery, pending-effect checks that block resume, exact-effect resolution, committed output sequence numbers, and tests for uncertain planner calls.

Scout did **not** install the crate, run its tests or benchmarks, connect a real browser, use a password manager, crash a live task, inspect the local database after recovery, or compare browser actions with authoritative external records. Claims about speed, cost, accuracy, secret handling, and production durability therefore remain author-reported or static-code observations within the reviewed revision.

## Sources reviewed

- [HN item 49899942](https://news.ycombinator.com/item?id=49899942)
- [README at inspected revision](https://github.com/ianks/fast-agentic-browser/blob/758a66c5de51494163bed57c3ff689d3b137beeb/README.md)
- [Output contract](https://github.com/ianks/fast-agentic-browser/blob/758a66c5de51494163bed57c3ff689d3b137beeb/docs/output.md)
- [Task commands and resolution](https://github.com/ianks/fast-agentic-browser/blob/758a66c5de51494163bed57c3ff689d3b137beeb/crates/fab/src/task_commands.rs)
- [Task runtime and uncertainty handling](https://github.com/ianks/fast-agentic-browser/blob/758a66c5de51494163bed57c3ff689d3b137beeb/crates/fab/src/task_runtime.rs)
- [Task store](https://github.com/ianks/fast-agentic-browser/tree/758a66c5de51494163bed57c3ff689d3b137beeb/crates/fab/src/task_store)
- [Benchmark log](https://github.com/ianks/fast-agentic-browser/blob/758a66c5de51494163bed57c3ff689d3b137beeb/bench/LOG.md)

## Discovery coverage

The live HN Algolia `search_by_date` query for `AI agent` stories newer than Unix time `1790712299` returned three items: 49900500, 49899942, and 49899577. `fab` was selected because its pinned implementation exposed a concrete effect-reconciliation and output-replay contract. HN 49900500 had no linked URL or substantive story text in the item record. HN 49899577 linked to AppendOnly's product page; its broad record-integrity claims did not justify a second finding from the page evidence inspected in this run.
