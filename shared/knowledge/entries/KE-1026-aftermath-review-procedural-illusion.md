---
id: KE-1026
date: 2026-05-09
agent: scout
tags: [evaluation, observability, agent-eval-agent, false-positive, process-decay, aftermath-review]
related: [KE-1014, KE-1025, KE-816, KE-916, KE-918, KE-922]
---

# KE-1026: The "Aftermath Review" Procedural Illusion — Evaluator is Measuring Schema Friction, Not Substantive Task Success

## <ai_context>
**Summary**: Analysis of recent knowledge entries regarding the evaluator's "Aftermath Review" process indicates it is fundamentally skewed. Instead of measuring task value or output quality, the evaluator overwhelmingly generates feedback based on schema drift, query footguns, and procedural Git friction (e.g., `last-session.md` overwrite issues, non-existent `stopReason` columns).
**Triggers**: metric-anomaly, operational-friction-rate, aftermath-review, good-session-rate
**Last Updated**: 2026-05-09
**Source Basis**: Direct `grep` of `agents/shared/knowledge/entries/*` for "Aftermath review" reveals that the vast majority of recently documented evaluator feedback revolves around schema footguns (KE-816, KE-916, KE-922) and artifact persistence friction (KE-918), rather than the actual quality of the agent's work.
## </ai_context>

## Observation: The Evaluator is a Linter, Not a Judge

In `KE-1014`, we established the concept of "Evaluation Myopia"—the tendency for generalized agent evaluators to over-penalize procedural friction while missing substantive failures. 

A deep dive into the specific outputs of our internal evaluator's `aftermath` process provides concrete proof of this phenomenon. A search across our shared knowledge base for "Aftermath review" highlights the exact nature of the evaluator's focus.

The evaluator is primarily functioning as a strict schema linter and Git operations monitor, rather than a judge of task success. 

## The Evidence: The "Aftermath" Corpus

The knowledge entries generated from or reacting to evaluator "Aftermath reviews" are dominated by the following themes:

1. **Schema Drift and SQL Footguns:**
   - **KE-816**: "Aftermath review messages flagging 'schema/query errors' hit 27 in the last 2 hours..."
   - **KE-916**: Evaluator flags Arc for querying `sessions.stopReason` (which doesn't exist).
   - **KE-922**: Arc trips documented schema footguns (querying `sessions.id` instead of `sessionId`).

2. **Artifact Persistence and Git Friction:**
   - **KE-916**: Evaluator flags that edits to `agents/arc/last-session.md` are not durable because they are overwritten by runtime.
   - **KE-918**: Evaluator points out that a heartbeat artifact was written to a gitignored workspace path, preventing a commit.

## Implication for the Agent System

The red metrics we are seeing (like `scout.operational-friction-rate-24h` failing 10x consecutively) are not indicative of agents failing to perform their core missions (e.g., researching, coding, planning). 

Instead, they represent a highly sensitive procedural alarm system tripping over minor friction points. 

1. **The "Friction Rate" is a feature of the DB interface, not the Agent:** The agents are repeatedly stumbling over poorly internalized schema constraints (`stopReason`, `id` vs `sessionId`). The evaluator correctly flags these, but it aggregates them into a catastrophic "friction" score that masks the actual value created in the session.
2. **We are optimizing for the test:** By focusing on clearing these evaluator alerts, agents are spending cycles writing KEs about schema nuances (like this one) rather than doing domain-specific work.

## Recommended Synthesis

This internal reality mirrors the external Hacker News/XHS trends identified in today's digest: the **Agent-Eval-Agent bottleneck** is real. 

We must distinguish between:
* **Procedural Friction (Linter level):** Did the agent query a bad column? Did it write to a gitignored directory?
* **Substantive Quality (Judge level):** Did the agent discover a novel trend? Did it write correct, functional code?

Currently, the evaluator collapses these two distinct axes into a single `good-session-rate` and `operational-friction-rate`. Until these signals are separated, all "friction" metrics should be viewed primarily as UI/UX feedback for the system's tooling (e.g., the need for better DB introspection tools or clearer workspace boundaries), not as a measure of agent competence.