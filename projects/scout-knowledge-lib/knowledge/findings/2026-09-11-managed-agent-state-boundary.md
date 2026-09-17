<ai_context>
summary: "OpenAI's Agents API exposes a portability and responsibility boundary that survives self-hosted execution: compute can remain customer-run while the provider owns the harness, session record, compaction, orchestration, and recovery protocol. A current XHS analysis independently frames the same split as commoditized runtime versus enterprise-owned permissions, acceptance, audit, and accountability."
triggers: ["managed agent", "Agents API", "state ownership", "self-hosted sandbox", "harness portability", "session portability", "OpenAI Agents API"]
last_updated: "2026-09-13"
source_basis: "OpenAI Agents API documentation and comparison pages, self-hosted environment and session-management documentation, HN item 49649213 observed via Algolia, and a current XHS detail read of post 6aa3f67a000000002902c5a5."
</ai_context>

# Self-Hosted Compute Does Not Mean Self-Hosted Agent State

**Date:** 2026-09-11  
**Source:** https://news.ycombinator.com/item?id=49649213  
**Primary documentation:** https://developers.openai.com/api/docs/guides/agents-api/overview  
**Runtime comparison:** https://developers.openai.com/api/docs/guides/agents  
**Self-hosted environment:** https://developers.openai.com/api/docs/guides/agents-api/environments/self-hosted  
**Session management:** https://developers.openai.com/api/docs/guides/agents-api/sessions/manage

## Core signal

OpenAI's Agents API makes **harness ownership**, not merely model hosting, a
platform boundary. The application supplies tools and may even supply the
sandbox, but OpenAI runs the Codex harness and manages sessions, orchestration,
context compaction, and recovery. The official runtime comparison is unusually
explicit: Agents API state consists of saved session configuration, turns, and
items, whereas Agents SDK state lives in the application's storage or SDK
sessions.

The self-hosted option does not erase that distinction. In that mode, the
customer runs `codex exec-server` in its own environment, but the executor
registers to an API-issued environment ID and receives harness requests over an
outbound WebSocket. Every session needs its own environment ID and executor;
the application is told to store the provider-issued `session.id` alongside its
own conversation state. After a restart or stream disconnect, recovery means
retrieving that remote session to discover pending actions.

This yields a useful two-axis model:

| Axis | Customer-managed option | Provider-managed option |
|---|---|---|
| **Execution substrate** | Self-hosted sandbox/executor | OpenAI-hosted sandbox |
| **Agent control state** | Agents SDK/application storage | Agents API session, harness, compaction, and recovery |

Choosing the left cell in the first row does **not** imply choosing the left
cell in the second. “Self-hosted agent” is therefore too coarse a label for
portability, sovereignty, or incident-recovery claims.

## What the HN discussion added

The 90-point HN thread repeatedly asked why a team would choose the API over the
SDK. The most concrete answer was operational convenience: avoid provisioning
and maintaining sandboxed VMs. The recurring objection was not only model
lock-in but ownership of work-in-progress and session state. Commenters also
pointed out that local or VM-hosted harnesses can already provide persistent
remote work, while others argued that building compaction, async tools,
human-wait states, and recovery correctly is a substantial engineering burden.

That disagreement identifies the actual trade: a managed harness exchanges
control-plane portability for avoided harness operations. It is not simply
“cloud versus local compute.” HN comments are qualitative practitioner evidence,
not proof of adoption, reliability, or migration cost.

## XHS signal: runtime standardization does not standardize responsibility

A current XHS analysis of the launch describes the API as turning OpenAI's
managed Codex harness into a platform service: create a session, submit a task,
run asynchronously, stream events, intervene, recover, and receive files. It
then draws a responsibility line. The provider can absorb sessions,
orchestration, compaction, and recovery, while the enterprise still owns tool
permissions, business data, acceptance, audit, and final accountability.

That is useful less as another product recap than as an ecosystem interpretation.
If generic session, sandbox, and tool-loop mechanics become commodity platform
features, differentiation moves upward to business state and action controls.
The appropriate product metric consequently shifts from answer quality alone to
accepted-task completion, recovery, human takeover, harmful side effects, and
total cost per accepted task. Governance also shifts from content moderation to
action-risk controls such as least authority, approval, reversibility, audit,
and intervention.

This XHS post is an author's market analysis, not official product documentation
or adoption evidence. Its concrete API description is consistent with the
primary documentation already reviewed above, but its forecasts about model
vendors, cloud providers, SaaS pricing, and commoditization remain attributed
judgments. At inspection the post showed 49 likes, 56 collections, and five
comments; this is a reception snapshot, not validation of those forecasts.

**Source:** https://www.xiaohongshu.com/explore/6aa3f67a000000002902c5a5

## Practical evaluation rule

Before adopting a managed agent API, request a **state evacuation test**, not
just an environment self-hosting checkbox:

1. Export the ordered input/output and tool-item history needed to replay work.
2. Reconstruct pending approvals, function calls, subagent lineage, and failure
   state outside the provider session.
3. Reproduce any compacted context or document the semantic loss if the
   provider exposes only its result.
4. Resume the task on a different harness without silently granting new tools or
   repeating completed effects.
5. Delete the remote session and verify the documented cleanup and retention
   behavior separately.

If those steps are unavailable, self-hosted execution reduces compute and
network dependence but does not establish agent-state portability.

## Limits

This finding describes the public beta documentation and one launch-day HN
thread. It does not measure API reliability, prove that migrations will fail,
or establish the contents of OpenAI's internal compacted representation. The
documentation exposes list/retrieve/delete operations for sessions and saved
items, but this review found no documented, provider-neutral export of the full
harness recovery state. That is an absence in the checked pages, not proof that
no such mechanism exists elsewhere or will be added.
