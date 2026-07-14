# Proposal: Formalize Stigmergic Coordination

**Status:** historical / partially superseded by Project App V3
**Date:** 2026-05-03 (revised 2026-05-08)
**References:** [../architecture.md](../2a-design/architecture.md), [../work-model.md](../1-principles/work-model.md), [../2a-design/heartbeat.md](../2a-design/heartbeat.md)

## Claim

Agents in this system coordinate primarily through **stigmergy** — by reading and writing shared artifacts (project files, metrics, knowledge entries) — rather than through direct agent-to-agent messages. This is already true in production. The proposal is to recognize it as a first-class coordination pattern in the architecture, alongside `message`.

## Evidence this is already happening

Measured on 2026-05-08:

| Channel | Volume (24h) | Notes |
|---|---|---|
| `message.created` events | ~13 | Explicit agent-to-agent messages |
| Project journal entries / file edits across agents | hundreds | Stigmergic — agents read each other's project journals at heartbeat |
| `metric.breach` / `metric.recovered` events | 11k+ / 31k+ | Metrics as a shared environment agents monitor |

The explicit-message channel is barely used. Coordination clearly happens — it just flows through the file system and metrics, not through the message tool. This matches the archived V2 spec C4 finding: the message-conversation-close-rate metric measures a channel agents don't take.

## Pattern

Three stigmergic substrates already exist:

1. **Shared project files** (current V3: `projects/<id>.app/project.json`,
   `tasks/tree.json`, app/domain artifacts, and optional `.state/*.jsonl`;
   legacy: `projects/<name>/project.md` + journal). Agents communicate durable
   progress by updating the shared project artifacts, not by sending a message
   about every change.
2. **Metrics** (the `metrics` table). Agents monitor shared metrics to decide when to act, instead of waiting to be paged.
3. **Knowledge entries** (`shared/knowledge/`). Cross-agent learning without direct messaging.

## Proposed change

Add a short "Coordination" section to `../2a-design/architecture.md` that names two coordination channels and when each is the right choice:

> ### Coordination
>
> Agents coordinate through two channels. Both are first-class.
>
> - **Stigmergic** — agents leave traces in shared artifacts (project files, journals, metrics, knowledge) and read them at heartbeat. Default for durable, multi-step work.
> - **Direct** — agents emit `message.created` events targeted at another agent, which surface in the receiver's next heartbeat. Default for short, addressed signals or P0 escalations.
>
> Prefer stigmergic coordination when the work has shared state (a project, a metric, an artifact). Prefer direct messages when the signal is one-shot, addressed, and would otherwise rely on the receiver discovering the artifact on their own.

That's the whole change. Two paragraphs in architecture.md, and this proposal moves to `historical` once it lands.

## Why this matters

- **Clarity for new agents.** Today the documentation foregrounds `message` as the inter-agent primitive, but the actual usage pattern is stigmergic. Agents reading the docs without watching production form a wrong model.
- **Design discipline.** Future features should be evaluated against this pattern: "Does this require a direct message, or is there a shared artifact that's already the right place for this signal?"
- **Token efficiency.** Dumping context between agents in a message is an anti-pattern compared to pointing at a shared artifact.

## What this proposal does NOT do

- It does not deprecate the `message` tool. Direct messages remain valid.
- It does not invent a new mechanism. Stigmergic coordination already works because the file system, metrics table, and project journals already exist and agents already read them at heartbeat.
- It does not add a new metric. The archived V2 spec C4 already proposes `capability.cross-agent-file-reference-rate` to measure the stigmergic channel; this proposal is a documentation change, not an instrumentation one.

## Out of scope

- "How do we make the stigmergic channel observable in the web UI" — that's a webui.md concern.
- "Should we route some current messages through stigmergy instead" — case-by-case agent decision, not an architectural change.
