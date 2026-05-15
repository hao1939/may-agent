# Brief: Guard Escalation Implementation

**Author:** Bob · **Date:** 2026-07-28 · **Priority:** P1 (highest unbuilt infra mechanism in common-sense.md)

## Problem

Common-sense.md states: *"Guards can be overridden by the escalation chain, never bypassed unilaterally."* This describes a mechanism that **does not exist**. The approved design (`agents/shared/may-agent-docs/design/guard-escalation.md`, approved 2026-04-15) has never been built.

**Two agents independently flagged this:**
- **Coach** (2026-04-17): "I have never seen a guard-override pathway actually used. Either document the mechanism (which command? who acknowledges?) or drop the sentence."
- **Optimizer** (undated): "In practice guards are *satisfied*, not overridden. 'Override' implies a mechanism I don't think exists."

## What Exists Today

- Guards block tool calls → agent retries or gives up
- `finish(status: "blocked")` is always allowed (agents can exit cleanly)
- No override token mechanism
- No structured escalation-to-owner flow
- Agents work around guards by satisfying them or finishing as blocked

## What the Approved Design Specifies

1. **Escalation via `agents('message')`** — blocked agent messages its session owner with guard ID + reason
2. **One-time override tokens** — owner/May can issue a token that lets a specific guard pass once
3. **`finish(blocked|failure)` always allowed** — already implemented
4. **Block messages include escalation instructions** — not implemented

## Recommendation

**Option A (Build it):** Implement the override-token mechanism from the approved design. ~2 days of tech-lead work. Benefits: closes the gap between docs and reality, unblocks agents stuck on false-positive guards.

**Option B (Simplify the docs):** Remove the "overridden by escalation chain" claim from common-sense.md. Replace with: *"If a guard blocks you and you can't satisfy it, finish(status: 'blocked') and escalate."* This matches current reality.

**My recommendation: Option B now, Option A later.** The current workaround (finish-as-blocked) is adequate — no agent has been permanently stuck. The override-token system adds complexity for a rare edge case. Update the docs to match reality, and build the full mechanism when guard false-positive rate becomes a real problem.

## Secondary Finding: Coach "Event-Driven" Item

Coach's behavioral verification tracker shows "Event-driven" as the only **unverified** item in common-sense.md's "How to Think" section. This is behavioral, not infra — no infra help needed. The event-driven principle is aspirational guidance, and Coach can verify it through session sampling like the other items.

## Source Files

- `agents/shared/common-sense.md` — the doc under review
- `agents/shared/may-agent-docs/design/guard-escalation.md` — approved but unbuilt design
- `agents/shared/designs/guard-escalation-override.md` — rejected self-service model
- `agents/coach/workspace/common-sense-tracker.md` — coach's verification log
- `agents/coach/workspace/common-sense-feedback.md` — coach feedback
- `agents/optimizer/workspace/common-sense-feedback.md` — optimizer feedback
