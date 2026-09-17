---
title: "HN — Cross-Session Messaging Makes Authority Non-Transitivity Explicit"
source: hn
date: 2026-08-08
last_updated: 2026-09-13
type: finding
tags: [hn, coding-agents, multi-agent, messaging, permissions, local-runtime]
relevance: high
---

# HN — Cross-Session Messaging Makes Authority Non-Transitivity Explicit

## Summary

Claude Code's new cross-session messaging is a useful implementation signal for multi-agent coordination: it lets independent sessions discover and send plain-text messages to one another, but deliberately does **not** let a sender transfer its permissions or user consent. The receiving session applies its own inbound policy and permission rules before acting.

The larger design lesson is that an agent message should carry information, not authority. A coordination channel that can start a new turn is also an instruction-ingress boundary, so delivery authorization and effect authorization must remain separate decisions.

## Primary sources

- **HN (initial submission):** https://news.ycombinator.com/item?id=49217752
- **HN (active discussion):** https://news.ycombinator.com/item?id=49222824
- **Source:** https://code.claude.com/docs/en/cross-session-messaging
- **Source markdown used for retrieval:** https://code.claude.com/docs/en/cross-session-messaging.md
- **Repo:** https://github.com/Hauddy/hauddy
- **Hauddy revision inspected:** https://github.com/Hauddy/hauddy/commit/17b61d53c10da03301305346f5b0f7b58dbf8c93
- **Hauddy protocol:** https://github.com/Hauddy/hauddy/blob/17b61d53c10da03301305346f5b0f7b58dbf8c93/spec/v0.1.md

## Source-grounded evidence

Anthropic's documentation describes a deliberately narrow channel:

- `ListAgents` discovers reachable sessions and `SendMessage` sends text to one by name.
- Messages contain text, sender identity, and usually a reply address—not conversation history or files.
- A receiver reads an arriving message between tool calls; if idle, Claude Code starts a new turn with it.
- Delivery has three states: **delivered**, **held**, or **refused**. `crossSessionInbound` can force `accept`, `hold`, or `refuse`; otherwise the default depends on the sender's and receiver's permission-mode classes.
- A peer message cannot approve a pending permission prompt, alter permission configuration or `CLAUDE.md`, or execute slash commands. Any requested action is still evaluated under the receiver's own permissions.
- The sender is instructed not to route work through a peer when that work was denied locally or would be blocked by its own settings.
- Same-machine sessions communicate through per-session Unix-domain sockets restricted to the operating-system user. Cross-machine traffic uses Anthropic infrastructure and is reply-only; `isolatePeerMachines` can require explicit approval before a message leaves the machine.
- Held messages and accepted delivery queues are bounded, while identical repeats and message loops are throttled.

The feature requires Claude Code v2.1.224 or later and is limited to macOS and Linux under supported providers and feature-flag settings.

## Interpretation

This implementation separates three controls that agent frameworks often collapse:

1. **Reachability** — may session A address session B?
2. **Ingress** — may B's model read this message now?
3. **Effects** — may B perform the action suggested by the message?

That separation blocks a straightforward confused-deputy path. A low-trust or highly autonomous sender cannot gain a more privileged receiver's authority merely by phrasing a request as coordination. Conversely, delivery can remain lightweight between similarly governed sessions without treating every message as user consent.

The default's dependence on permission-mode classes is also notable. Messages from a sender that bypasses prompts are held when the receiver normally prompts, and a receiver that bypasses prompts generally holds messages unless the sender is in the same bypassing class. In effect, **autonomy level becomes provenance metadata** at the messaging boundary.

There are limits. Sender identity is local-runtime identity, not a portable cryptographic delegation; textual messages have no typed task contract, durable acknowledgement protocol, or exactly-once guarantee; and a model can still be persuaded by delivered text even when hard permission checks remain intact. Systems using this pattern should therefore log stable sender/session IDs, inbound-policy decisions, requested versus authorized effects, and delivery outcomes separately.

## Follow-up HN signal — persistent specialists amortize context, but messaging expands the authority graph

A second submission of the same documentation became a materially stronger practitioner discussion. When checked through the HN Firebase API, item `49222824` had 137 points, 59 descendants, and 23 direct replies. Several comments independently described already-built versions using tmux and handoff files, IRC, Telegram, Tailscale, or an MCP-backed message service. That convergence suggests cross-session messaging is formalizing an existing user pattern rather than inventing a wholly new workflow.

The most useful operational claim came from `eigenblake`: a persistent specialist session can pay the prompt cost of a large skill once, then answer other sessions without repeatedly loading that skill into every context. This reframes multi-session messaging as a **context-cost architecture** as well as a coordination feature. The economic unit is not merely “another parallel agent”; it is a warm specialist whose accumulated context can be queried by thinner workers.

Two other reports expose the corresponding control requirement:

- `Cyuonut` said a cross-model, cross-machine version was useful but sometimes required a human to interrupt agents heading in the wrong direction.
- `zeafoamrun` reported Telegram-connected agents autonomously diagnosing alerts and filing tickets while the user was offline, while also observing that agent-to-agent exchanges can become long-winded.

These are anecdotes, not controlled evaluations, but together they identify two measurable failure modes for a messaging runtime: **coordination drift** (peers reinforce a wrong direction) and **communication amplification** (messages consume more time and tokens than the specialist context they save). A production design should therefore couple each messaging edge with bounded turns or budgets, cancellation authority, and attribution from a received request through any resulting ticket, tool call, or state change.

## Complementary GitHub signal — separate delivery, interruption, and effect authority

Hauddy's draft v0.1 protocol provides a useful independent implementation contrast. At revision `17b61d5`, it gives project-scoped agents Ed25519 identities, derives `from` and `to` at the authenticated app/platform boundary rather than trusting payload text, and distinguishes queued asynchronous SMS from synchronous calls. Its strongest boundary is attentional: SMS is pull-only and never interrupts, while a call may inject only a fixed ring telling the receiver who is calling and to invoke `pickup_call`; conversation content then moves through explicit blocking tool calls. A coded wake/ack handshake must succeed before presence advertises call capability.

That design makes **attention authorization** a separate layer between message delivery and effect authorization. Proving that a wake channel works does not authorize arbitrary content injection, and authenticating a sender does not authorize the action requested in its body.

The same draft also exposes two cautionary gaps:

- A curated local contact book limits discovery, not reachability: the specification says an agent may still message any handle it knows. Operators must not mistake UI filtering for an authorization boundary.
- The README recommends optionally pre-approving the entire `mcp__hauddy` server and notes that this covers current and future tools. That is convenient ambient authority whose scope can grow after consent; per-tool or version-pinned capabilities are safer for channels that can send files, place calls, or later gain new effects.

The envelope schema reserves a signature field but sets it to `null` in v0.1, and the README labels cross-person/global routing as upcoming. The durable remote transport and cryptographic claims should therefore be treated as draft design, not deployed-security evidence. The repository's concrete contribution is the narrower pattern: **authenticate routing metadata, keep ordinary messages non-interrupting, inject only a content-free wake signal, and prove the wake path before advertising it**.

## GitHub follow-up — bound what a peer can make you read, not only what it can make you do

Orphus revision [`f69468b`](https://github.com/kelvincushman/orphus/commit/f69468b7876c78efc2a03401df74f1dee07b0099) adds an independent implementation signal for the communication-amplification risk above. Its local roundtable broker keeps peer discussion outside each agent transcript and exposes three deliberately asymmetric paths:

- unsolicited activity pings carry only a room count and author names;
- a pulled digest has a fixed character budget, spends that budget on newest messages first, demotes older content from verbatim text to one-line headlines, and finally collapses the remainder to a count; and
- explicit sequence-range fetch remains lossless and is intentionally outside the digest bound.

The important control is structural rather than prompt-based. [`digest.ts`](https://github.com/kelvincushman/orphus/blob/f69468b7876c78efc2a03401df74f1dee07b0099/packages/roundtable/digest.ts) caps each verbatim body and builds the digest deterministically without a model; its unit tests exercise oversized single messages, 60-message backlogs, and tiny budgets. [`room-store.ts`](https://github.com/kelvincushman/orphus/blob/f69468b7876c78efc2a03401df74f1dee07b0099/packages/roundtable/broker/room-store.ts) assigns monotonic per-room sequence numbers, retains a 500-message ring buffer, and keys read cursors by role name. This makes a verbose peer unable to force an unbounded context insertion through the ordinary digest path while leaving an explicit recovery path when compression hides something important.

This refines the authority model: agent messaging needs an **attention budget** in addition to ingress and effect authorization. A peer may have permission to address a receiver without having permission to occupy an arbitrary fraction of its context window. The digest/fetch split makes that distinction executable: bounded summaries are the default attention grant; raw transcript expansion is a separate receiver-chosen act.

The implementation also exposes where not to overclaim. The broker is same-user and local-only, room state and cursors are in memory, and an idle broker exits after all sessions disconnect; cursors survive a session reconnect only while that broker remains alive, not a broker restart. The bound guarantees size, not semantic sufficiency: newest-first allocation can compress an older decisive message, and raw `fetch` has only paging—not a context bound. Role names are coordination identity rather than authenticated principals. Orphus therefore demonstrates enforceable **context-volume confinement**, not durable messaging, hostile-peer isolation, or trustworthy summarization.

- **Repo:** https://github.com/kelvincushman/orphus
- **Revision inspected:** https://github.com/kelvincushman/orphus/commit/f69468b7876c78efc2a03401df74f1dee07b0099
- **Architecture:** https://github.com/kelvincushman/orphus/blob/f69468b7876c78efc2a03401df74f1dee07b0099/docs/architecture.md

## GitHub follow-up — a handoff should import an inactive branch, not a current mandate

Jiaojie revision [`35cd1bf`](https://github.com/Jordanwei1/jiaojie-skill/commit/35cd1bf474495a61fe8925cfb822779d0dc78d22) applies the same non-transitivity principle to **portable state**, not just live messages. Its handoff model separates a small HOT startup projection from WARM decisions, constraints, rejected options, failed attempts, and answered questions, plus COLD evidence and artifacts. The receiving workflow requires reading the state behind the projection before accepting a proposed action, preserves concurrent decisions as explicit branches, and keeps an imported branch inactive until an explicit merge and current-user approval.

The security boundary then separates four claims that portable-state systems often collapse:

1. hashes establish byte consistency, not origin;
2. a valid origin or signature does not establish source truth;
3. approval to transfer or receive a package does not transfer effect authority; and
4. every protected action still needs a current authorization bound to principal, resource, operation, purpose, and time.

This makes **negative knowledge**—a failed approach or a user-rejected option—portable without making historical instructions executable. The receiver can avoid repeating settled mistakes while still rechecking stale external facts and obtaining present authority before acting. It is a stronger handoff contract than copying a session summary because it treats receipt, merge, and continuation as distinct decisions.

The repository is unusually careful about the limit of its evidence. Its recorded deterministic run reports 28 passing contract, round-trip, mutation-rejection, path-safety, and fixture checks, and GitHub Actions passed the same dependency-free project check at the inspected revision. But its compatibility matrix marks all named model families, language directions, and runtime behaviors `NOT_RUN`. The code therefore demonstrates a structured and security-conscious **candidate protocol**; it does not yet demonstrate cross-model semantic continuity. Package integrity and a well-formed receipt cannot substitute for an isolated receiver recovering the right state and next action.

- **Repo:** https://github.com/Jordanwei1/jiaojie-skill
- **Revision inspected:** https://github.com/Jordanwei1/jiaojie-skill/commit/35cd1bf474495a61fe8925cfb822779d0dc78d22
- **Security boundary:** https://github.com/Jordanwei1/jiaojie-skill/blob/35cd1bf474495a61fe8925cfb822779d0dc78d22/references/security-boundary.md
- **Receive workflow:** https://github.com/Jordanwei1/jiaojie-skill/blob/35cd1bf474495a61fe8925cfb822779d0dc78d22/references/receive-workflow.md
- **Evaluation policy:** https://github.com/Jordanwei1/jiaojie-skill/blob/35cd1bf474495a61fe8925cfb822779d0dc78d22/evals/README.md
- **Compatibility matrix:** https://github.com/Jordanwei1/jiaojie-skill/blob/35cd1bf474495a61fe8925cfb822779d0dc78d22/evals/compatibility-matrix.json
- **Deterministic result:** https://github.com/Jordanwei1/jiaojie-skill/blob/35cd1bf474495a61fe8925cfb822779d0dc78d22/evals/results/project-deterministic-2026-08-20/summary.json
- **Passing workflow:** https://github.com/Jordanwei1/jiaojie-skill/actions/runs/32376266188

## GitHub follow-up — a portable history must preserve epistemic state, not merely text

Orbit revision [`df3de8f`](https://github.com/itsamruth/orbit/commit/df3de8f5a07e075500a3b5baf92c2ef86e44255d) provides a concrete Claude Code–Codex handoff implementation. Its useful contribution is narrower than “Git for conversations”: the handoff bundle preserves the original and latest user requests, workspace identity, previous session, event IDs, explicit coverage, and a stopping-point status. It labels previous exchanges as historical evidence rather than instructions, warns the receiver not to replay recorded tool calls, and tells it to recheck the current workspace.

The bounded-context algorithm adds two important integrity properties:

- tool calls and their results share a selection group, so budget clipping does not deliberately retain one side while dropping the other; and
- omitted event IDs remain explicit, with a retrieval command for older history, so prompt inclusion is not confused with complete history.

The status logic is equally consequential. A completed turn tells the receiver not to answer the old request again; a failed or interrupted turn asks it to identify unfinished work without assuming a tool succeeded; an unknown stopping point requires stating uncertainty rather than inventing continuation. This makes **epistemic state**—complete, failed, interrupted, unknown, or omitted—part of the portable object. A transcript that moves text but erases those distinctions can turn an old effect into a duplicate effect or an unfinished call into presumed success.

The implementation remains early and the local verification was only partial. The repository tree was complete at the pinned revision and its build reached the Node test runner. Of 52 tests, 22 non-database tests passed, including the bounded handoff/tool-pair, redaction, stable replay-ID, and unknown-outcome cases. The other 30 could not execute because the environment had Node 24 but no prebuilt `better-sqlite3` binary; rebuilding then failed because `make` was absent. This is an environment-bound test gap, not evidence that the database paths pass or fail. The source demonstrates a reviewable handoff contract; cross-agent semantic continuity and full runtime behavior remain unverified here.

- **Repo:** https://github.com/itsamruth/orbit
- **Revision inspected:** https://github.com/itsamruth/orbit/commit/df3de8f5a07e075500a3b5baf92c2ef86e44255d
- **Handoff implementation:** https://github.com/itsamruth/orbit/blob/df3de8f5a07e075500a3b5baf92c2ef86e44255d/src/sessions/handoff/index.ts
- **Architecture:** https://github.com/itsamruth/orbit/blob/df3de8f5a07e075500a3b5baf92c2ef86e44255d/docs/architecture.md
- **Switch tests:** https://github.com/itsamruth/orbit/blob/df3de8f5a07e075500a3b5baf92c2ef86e44255d/tests/switch.test.mjs

## Operational pattern

For any agent-to-agent message bus:

- authenticate the sender and attach its execution/permission class;
- make accept, quarantine, and refuse explicit ingress states;
- treat message content as untrusted text, never as user approval;
- re-authorize every requested effect in the receiver's capability context;
- prevent denied work from being laundered through a peer;
- bound queues and loops, and expose held/dropped outcomes; and
- distinguish local transport trust from cross-machine or cross-organization trust.

## Calibration

This combines a **primary-source product-design signal** with a stronger but still self-selected practitioner discussion. The initial HN item `49217752` had little engagement; the later submission `49222824` reached 137 points and 59 descendants in the observed Firebase response. Multiple commenters claimed independent implementations, but those reports do not establish prevalence, token savings, correctness, or security. The documented authority model is firm evidence; context-cost savings and unattended coordination are hypotheses that should be benchmarked.
