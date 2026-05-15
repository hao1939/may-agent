# ❌ REJECTED — Self-Service Override Model

> **REJECTED by Hao (2026-04-15).** Self-service override is the wrong model. Guards are never bypassed by the agent they guard. The correct design is owner-escalation: see `guard-escalation-proper.md`.

---

# Design: Guard Escalation Override (REJECTED)

**Author:** Bob · **Date:** 2026-04-15 · **Status:** ❌ REJECTED — superseded by `guard-escalation-proper.md`

## Problem

Guards can permanently block agents with no escape hatch. The cost-limit guard blocks at 200 calls — after that, the agent can't even call `finish()` to exit cleanly. The agent is trapped in a loop: every tool call is blocked, including the one that would end the session gracefully.

**Principle:** Guards are advisors, not jailers. They warn, they block bad patterns, but they must always allow escalation.

## Current Architecture

```
composeGuards(guard1, guard2, ..., costLimitGuard)
  → first guard returning { block: true } wins
  → blocked call returns error text to agent, tool never executes
  → agent retries, gets blocked again, loops until timeout
```

Key file: `src/lib/tools/compose-guards.ts` → `BeforeToolCallResult { block, reason, steer?, redirect? }`  
Dispatch: `src/lib/manager-receipts.ts` lines 164–208 — checks `guardResult?.block`, returns reason as tool error.

## Design

### 1. Guard Categories: Overridable vs. Hard

Every guard declares its category via a new field on `BeforeToolCallResult`:

```typescript
interface BeforeToolCallResult {
  block: boolean;
  reason: string;
  steer?: string;
  redirect?: { workflow: string; task: string };
  // NEW:
  overridable: boolean;  // Can the agent escalate past this block?
  guardId: string;       // Unique identifier (e.g., "cost-limit", "finish-fm33")
}
```

**Hard guards** (`overridable: false`) — cannot be bypassed:
- `tool-schema-guard` — malformed tool calls (would crash)
- `path-hallucination-guard` — prevents writes outside project
- `empty-args-guard` — invalid invocations

**Overridable guards** (`overridable: true`) — agent can escalate:
- `cost-limit-guard` — resource limits
- `finish-guard` (FM-3.3 verification) — agent may know verification isn't needed
- `verification-depth-guard` — style/quality warnings
- `completeness-guard` — may be wrong about what's "complete"
- `read-dedup-guard` — agent may legitimately need to re-read
- `scrape-dedup-guard` — same

### 2. `finish()` Is Never Blocked

**Absolute rule:** No guard may block a `finish()` call, regardless of category. This is enforced in `composeGuards()` itself, not in individual guards:

```typescript
// In composeGuards(), before running any guard:
if (context.toolCall.name === "finish") {
  return undefined; // Always allow — guards log but never block
}
```

This is the nuclear escape hatch. Even if the agent is over budget, over limits, or has unverified work — it can always exit. The finish-guard (FM-3.3) moves from blocking to **warn-only** on `finish()`: it still injects a steer message, but doesn't prevent the call.

**Why not keep the finish-guard as a blocker?** Because the alternative is worse — the agent loops endlessly trying to satisfy a guard that may be wrong about what constitutes "verification." A steer warning gives the agent the information; blocking removes its agency.

### 3. Override Protocol

When a guard blocks with `overridable: true`, the block message includes an override instruction:

```
⚠️ BLOCKED by [cost-limit]: 201 tool calls exceeds limit of 200.
To override: call finish() to exit, or call override_guard("cost-limit", "reason for override") to continue.
```

**The override mechanism is a new tool:** `override_guard(guardId, justification)`

```typescript
interface OverrideGuardArgs {
  guardId: string;       // Which guard to override (from the block message)
  justification: string; // Why the agent needs to continue (logged for review)
}
```

When called:
1. The override is logged (see §4).
2. The specified guard is suppressed for the **next N tool calls** (default: 10). Not permanently — the agent gets a window to finish what it's doing, then the guard re-engages.
3. If the guard blocks again after the window, the agent must override again (with a new justification).

**Why a window, not permanent?** Prevents a single override from disabling safety for the rest of a session. The agent must consciously re-escalate, creating natural friction against runaway overrides.

### 4. Override Logging

Every override produces a structured log entry:

```typescript
interface GuardOverrideEvent {
  timestamp: string;
  sessionId: string;
  agentName: string;
  guardId: string;
  justification: string;
  callCountAtOverride: number;
  windowGranted: number;  // How many calls the override allows
}
```

Logged to:
- Session transcript (visible in the conversation)
- `.state/guard-overrides.jsonl` (persistent, queryable)

**Review pattern:** A periodic check (heartbeat or human) scans `guard-overrides.jsonl` for:
- Agents that override the same guard repeatedly → guard may be miscalibrated
- Overrides with weak justifications → agent may be gaming the system
- Override frequency trends → systemic issues

### 5. Migration Path

**Phase 1 — `finish()` exemption (immediate, no agent changes):**
Add the `finish()` bypass to `composeGuards()`. This fixes the worst problem (trapped agents) with zero risk. Guards still block everything else normally.

**Phase 2 — Guard categorization (low effort):**
Add `overridable` and `guardId` fields to `BeforeToolCallResult`. Update each guard to declare its category. Default: `overridable: false` (safe default — guards must opt in to being overridable).

**Phase 3 — Override tool (requires agent awareness):**
Add `override_guard` tool. Update blocked-message text to include override instructions. Add logging infrastructure.

Each phase is independently valuable and shippable. Phase 1 alone fixes the critical bug.

## Escalation Chain (from Hao — final authority)

When a guard blocks an agent and the agent cannot self-resolve, escalation follows a strict chain:

```
Agent → Session Owner → May → Hao
```

### Steps

1. **Agent blocked by guard** → Agent tries to fix the issue (satisfy the guard's condition, or call `finish()` which is never blocked per Phase 1).
2. **Can't fix** → Agent escalates to **session owner** (whoever dispatched the task — e.g., tech-lead if it forked a coder session).
3. **Owner can't resolve** → Owner escalates to **May** (system supervisor).
4. **May can't resolve** → May escalates to **Hao** (via telegram).
5. **Hao approves or rejects** — Hao is the final authority. No further escalation.

### Key Points

- **Most escalations should resolve at step 1-2.** If guards are well-calibrated, agents can satisfy them or exit cleanly via `finish()`. Session owners can adjust task scope or accept partial results.
- **May escalations are for systemic issues** — guard miscalibration, missing infrastructure, cross-agent coordination failures.
- **Hao escalations are rare** — only for policy decisions (should this guard exist? should this agent be exempt?).
- The override_guard tool (Phase 3) replaces step 1 for overridable guards. The escalation chain handles cases where even overrides aren't sufficient.

### Implementation Notes

- Steps 1-2 are already possible via `finish()` exemption (Phase 1) and existing agent-to-agent messaging.
- Step 3 uses existing `agents.message("may", ...)` or request tracking.
- Step 4 uses May's existing telegram escalation path.
- No new infrastructure needed for the chain itself — it's a behavioral protocol, not a code system.

## Open Questions

1. **Window size:** 10 calls is a guess. Should this be configurable per guard? (Cost-limit might want 5, read-dedup might want 20.)
2. **Override budget:** Should there be a max overrides per session? (Prevents infinite override loops, but adds complexity.)
3. **Hard guard list:** Is the proposed split right? Should `commit-guard` be hard or overridable?

## Summary

| Change | Risk | Value | Phase |
|--------|------|-------|-------|
| `finish()` never blocked | Very low | Fixes trapped-agent bug | 1 |
| Guard categorization | Low | Enables override design | 2 |
| `override_guard` tool | Medium | Full escalation protocol | 3 |
| Override logging | Low | Visibility into overrides | 3 |
