# Design: Proper Guard Escalation — Ask Owner, Don't Self-Bypass

**Author:** Tech-Lead · **Date:** 2026-04-15 · **Status:** Approved design direction (per Hao)

## Problem

Guards block tool calls to enforce quality (FM-3.3 verification, dedup, etc.). Sometimes agents are legitimately stuck — the guard is wrong, or the situation is unusual. We need an escalation path that doesn't undermine the guard system.

**Rejected approach:** `guard-escalation-override.md` proposes an `override_guard()` tool that lets agents bypass their own guards. This is wrong — agents will game it. A guard the agent can override itself is not a guard; it's a suggestion. The justification field becomes a formality ("I need to continue").

## Core Principle

**Guards are enforced. Agents escalate to their owner, not to themselves.**

The supervisor (May, human, or parent agent) decides whether to override — never the blocked agent. This preserves the guard's authority while ensuring no agent is permanently stuck.

## Design

### 1. Escalation via `agents('message')`

When a guard blocks a tool call, the block message includes escalation instructions:

```
🔍 BLOCKED by [verification-depth]: No post-write verification detected.
Verify your deliverables, then call finish() again.

If you cannot resolve this: use agents('message', {
  agent: '<your-owner>',
  message: 'Guard verification-depth blocked my finish(). I believe my work is correct because [reason]. Session: <session-id>',
  priority: 'P0'
})
```

The agent's owner (configured in agent definition or defaulting to May) receives the message and decides:
- **Tell the agent what to do** — e.g., "Run `read()` on the file you wrote, then finish again"
- **Issue a one-time override token** — if the guard is genuinely wrong (see §3)

### 2. `finish(status: "blocked"|"failure")` Always Allowed

Guards MUST NOT block `finish()` when status is `"blocked"` or `"failure"`. An agent that can't satisfy a guard should always be able to exit cleanly:

```typescript
// In the guard's beforeToolCall handler:
if (ctx.toolCall.name === "finish") {
  const args = ctx.args as { status?: string };
  // Only guard finish(status: "success") — never block exits
  if (args.status !== "success") return undefined;
}
```

This is already the pattern in `verification-depth-guard.ts`. All guards should follow it. The agent is never trapped — it can always `finish(status: "blocked", blockers: [{ reason: "Guard X won't let me finish" }])`.

**Important:** `finish(status: "success")` remains guarded. The agent doesn't get to claim success without satisfying quality checks.

### 3. Owner Override Tokens

When an owner decides a guard should be overridden, they provide a one-time token via the agent's next message:

```
Override granted for guard [verification-depth] in session [session-id].
Token: OVERRIDE-<guardId>-<sessionId>-<timestamp>
Call finish() with override_tokens: ["OVERRIDE-verification-depth-s123-1776277000"]
```

**Implementation:**
- `finish()` (and potentially other guarded tools) accepts an optional `override_tokens` array
- `composeGuards()` checks incoming tokens against active blocks
- A valid token bypasses the specific guard for that one call
- Tokens are single-use and session-scoped (can't be reused)
- Token use is logged to `.state/guard-overrides.jsonl` for audit

**Token validation (in composeGuards):**
```typescript
interface OverrideToken {
  guardId: string;
  sessionId: string;
  issuedBy: string;  // Which agent/human issued the override
  timestamp: number;
}

// Parse token string: OVERRIDE-<guardId>-<sessionId>-<timestamp>
// Validate: sessionId matches current session, not expired (1h TTL)
```

### 4. Guard Block Messages Include Context

Every guard block message should include:
1. **What failed** — the specific rule that triggered
2. **How to fix it** — concrete steps the agent can take
3. **How to escalate** — the `agents('message')` template
4. **How to exit** — `finish(status: "blocked")` always works

Template:
```
⚠️ BLOCKED by [{guardId}]: {reason}

**To resolve:** {specific_fix_instructions}

**To escalate:** agents('message', { agent: '{owner}', message: 'Guard {guardId} blocked me: {reason}. Session: {sessionId}', priority: 'P0' })

**To exit cleanly:** finish(status: "blocked", blockers: [{ reason: "Guard {guardId}: {reason}" }])
```

### 5. Why Not Self-Service Override

The `guard-escalation-override.md` design proposes `override_guard(guardId, justification)` — an agent calls it with a text justification and the guard is suppressed for N calls.

Problems:
1. **Agents game justifications.** The justification is evaluated by no one in real-time. The agent writes "I need to continue" and proceeds. Post-hoc review of `guard-overrides.jsonl` is too late.
2. **Window-based suppression is dangerous.** Suppressing a guard for "the next 10 calls" means 10 unguarded calls. The whole point of guards is per-call enforcement.
3. **No accountability loop.** The agent that's being guarded is the one deciding whether the guard applies. This is like a student grading their own exam.
4. **`finish()` exemption alone doesn't solve it.** Making `finish()` always pass (as Phase 1 proposes) means guards on finish are effectively removed — agents just call finish and skip verification.

The owner-escalation model fixes all of these: a different entity (the supervisor) evaluates whether the guard should be overridden, and issues a scoped token for exactly one call.

## Migration Path

### Phase 1: Ensure `finish(status: "blocked"|"failure")` always passes (immediate)
- Audit all guards to confirm they only block `finish(status: "success")`
- Already true for verification-depth-guard; verify for others

### Phase 2: Enriched block messages with escalation template (low effort)
- Update `composeGuards()` to append escalation instructions to block reasons
- Configure owner mapping per agent (default: May)
- No new tools, no new infrastructure — just better error messages

### Phase 3: Override token system (medium effort)
- Add `override_tokens` parameter to guarded tool schemas
- Implement token parsing/validation in `composeGuards()`
- Add token issuance flow for May/human owners
- Add audit logging

## Open Questions

1. **Token issuance UX:** How does a human issue a token? CLI command? Chat message to May who relays it?
2. **Owner mapping:** Where is "agent X's owner is Y" configured? In agent definitions? In a central config?
3. **Multi-hop escalation:** If May is the owner but May is also an agent — can May self-override? (Probably yes — May is the system owner, different trust level.)

## Comparison

| Aspect | Self-Service Override (Bob's) | Owner Escalation (This) |
|--------|-------------------------------|------------------------|
| Who decides | Blocked agent | Supervisor/owner |
| Gaming risk | High (agent writes justification) | Low (external review) |
| Latency | Instant | Async (message round-trip) |
| Agent stuck? | No — overrides immediately | No — `finish(blocked)` always works |
| Audit quality | Post-hoc, easily gamed | Pre-override, owner validated |
| Complexity | New tool + windowing | Token system + owner mapping |
