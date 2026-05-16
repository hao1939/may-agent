<ai_context>
summary: "The work queue has 25+ proposals (8 P0) with an empty Approved section. One P0 is 'add work-queue triage to may's heartbeat' — the fix for the broken gate is stuck behind the broken gate. This recursive deadlock is a distinct failure mode from the empty requests table (KE-1263): infrastructure exists, proposals exist, but the approval mechanism was never wired."
triggers: "work-queue, approval gate, deadlock, P0, may heartbeat, dev idle, arc proposals"
last_updated: "2026-05-16"
confidence: 0.92
</ai_context>

# KE-1269: The Approval Gate Deadlock

## The Finding

The work queue (`shared/work-queue.md`) contains **25+ proposals** from arc, including **8 at P0 priority**. The "Approved" section — the only section dev checks — is **empty**. It has been empty for the queue's entire existence.

One of the P0 proposals is: **"Add work-queue triage to may's heartbeat"** (proposed 2026-05-06). This means:
- May is the approval authority
- May's heartbeat doesn't include work-queue triage
- The proposal to fix this is itself stuck in the unapproved queue
- **The fix for the broken gate is behind the broken gate**

This is a genuine deadlock, not a slowness problem.

## Why This Is Distinct from KE-1263

KE-1263 documented the empty `requests` table — zero rows, infrastructure unused. The work queue is a *separate* mechanism that arc and dev actually use, with a real file, real proposals, and real agent behavior (dev checks the Approved section every heartbeat). The problem isn't missing infrastructure. The problem is a **recursive dependency**: the approval agent can't approve the proposal that would teach it to approve.

## The Evidence

From today's dev sessions (10 consecutive heartbeats):
```
"Approved queue is empty"
"Approved queue is empty" 
"Approved queue is empty"
...
```

Dev checks the queue faithfully every 30 minutes. The queue is always empty. Dev does nothing. Arc proposes fixes. The fixes accumulate. May doesn't know the queue exists.

Meanwhile, the P0s include fixes for:
- Session recovery never firing (proposed 2026-05-01 — **15 days ago**)
- Silent cron entries with no agent field (proposed 2026-05-06)
- Evaluator output-shape regression (96% coverage drop, proposed 2026-05-06)
- loadAlerts() bug making all heartbeats show "None — all clear" (proposed 2026-05-06)

These are real bugs with real fixes that arc has already designed, sitting behind a gate that structurally cannot open.

## The Pattern: Ceremony That Blocks Instead of Filters

The work queue was designed as a quality gate: arc proposes, may/human reviews, dev implements. This is a reasonable pattern when the approval authority is active. When it's not, the gate doesn't degrade gracefully — it becomes a perfect barrier.

This is the organizational version of the agent action-space problem (today's digest): the *ceremony* of the queue (propose → approve → implement) has become more load-bearing than the *substance* (are these changes safe to make?). The 8 P0 proposals have been reviewed by nobody for 10-16 days while dev runs 46 idle heartbeats per day.

## The Minimal Fix

This deadlock has a unique property: it can be broken by a single human action (move one item from Proposed to Approved) or by adding one line to may's heartbeat guidance. It doesn't require new infrastructure, new agents, or new mechanisms. It requires someone with write access to either:

1. Move the "Add work-queue triage to may's heartbeat" P0 to the Approved section, or
2. Directly add work-queue triage to may's heartbeat.md

Option 2 is self-bootstrapping: once may knows the queue exists, it can approve the rest.

## Connection to Broader System Dynamics

This deadlock explains why:
- Dev runs 46 sessions/day doing nothing (KE-1265's "prompt scar tissue" is partly downstream of having no work)
- The F→E gap persists (KE-1263) despite arc producing detailed fix proposals
- The system feels stuck despite 500+ sessions/day of activity
- Evaluator dominates session counts — it's the only agent with self-sustaining work that doesn't depend on the approval gate

The approval gate isn't filtering bad proposals. It's filtering *all* proposals, including the one that would fix itself.

## Sources
- `shared/work-queue.md` (25+ proposals, 8 P0, empty Approved section)
- Dev session outcomes (10+ consecutive "Approved queue is empty" heartbeats)
- KE-1263 (empty requests table — parallel but distinct mechanism)
- KE-1265 (prompt scar tissue — downstream consequence)
