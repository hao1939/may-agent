---
summary: "A current XHS explainer describes Pi's in-progress Durable AgentHarness V2 as separating conversation history, work lanes, an operation log, and shared facts, with intent/result records around external effects. The useful design signal is that recoverability needs explicit task and effect state rather than transcript replay; the post is a secondary account and does not link the design or implementation, so shipped behavior remains unverified."
triggers: ["Pi AgentHarness", "Durable AgentHarness V2", "recoverable agent runtime", "operation log", "intent result", "effect boundary", "single writer", "snapshot event"]
last_updated: "2026-09-21"
source_basis: "Full body-level read of XHS note 6aae54980000000028039c42 on 2026-09-21. The post is a secondary technical explainer; its referenced public design, code, images, and implementation status were not independently inspected."
---

# Recoverable agents need operation state, not only conversation history

<ai_context>
Use this finding as a current secondary-source design signal about Pi's in-progress Durable AgentHarness V2. The architectural separation is useful, but do not treat the post as proof that recovery, event delivery, or external-effect handling ships or works: no primary design, repository, commit, test, or artifact URL was exposed in the inspected body.
</ai_context>

**Observed:** 2026-09-21  
**Disposition:** New source-grounded finding  
**Coverage:** Full XHS text body; no comments were present. Attached images and the unnamed public design and implementation were not inspected.

## Source

- **XHS body:** [Pi AgentHarness：可恢复的运行时](https://www.xiaohongshu.com/explore/6aae54980000000028039c42) — AF智域心识, note ID `6aae54980000000028039c42`

## What the source says

The author describes Pi's **Durable AgentHarness V2** as an unfinished effort to turn an agent chat loop into a recoverable runtime. The post says persistent queries, session storage, and telemetry are specified, while complete recovery, the event system, and execution of external actions remain unfinished.

Its proposed state model separates four concerns:

1. a **conversation tree** for semantic history;
2. **lanes** for the progress of distinct work lines;
3. an **operation log** for recovery evidence; and
4. **global facts** shared across work lines.

The post's central claim is that message history cannot prove which work commitments the system accepted or whether an external effect completed. It says accepted prompts therefore become identified, stateful operations. External actions are represented by an **intent** recorded before the effect and a **result** appended afterward; an intent without a result becomes an explicit recovery case rather than evidence that the action did or did not happen.

The author also describes a unified effect boundary around durable writes, model requests, tools, hooks, and timers so tests can pause before a boundary, simulate a crash, reopen, and continue. For clients, the post proposes fetching an authoritative snapshot before consuming events and fetching a fresh snapshot after disconnection. Multiple lanes may progress concurrently, while a session retains a single writer for ordering.

## Why it matters

The reusable design lesson is broader than Pi: **a transcript is context, not a recovery ledger**. Once an agent performs durable or external work, recovery needs at least three separately queryable facts:

- what work the runtime admitted;
- what effect it intended to perform; and
- what completion evidence it recorded.

The intent/result split also avoids a false promise of exactly-once execution. A missing result narrows uncertainty, but safe continuation still depends on effect-specific idempotency, reconciliation, or explicit closure. Likewise, single-writer ordering can simplify one session without proving cross-session consistency or reliable event delivery.

## Limitations and follow-up

- This is a secondary XHS explanation, not a Pi maintainer statement or a primary design review.
- The body provides no repository, design-document URL, revision, schema, test output, or runnable artifact.
- The implementation-status claims and named state layers were not checked against code.
- The attached diagrams were not inspected, so this note covers only the text body.
- Revisit only when a credential-free primary design or repository can be identified. Verify the persisted schemas, crash points, operation state machine, intent/result reconciliation rules, event replay semantics, idempotency contract, and whether single-writer scope is enforced rather than merely documented.
