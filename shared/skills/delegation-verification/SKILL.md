---
name: delegation-verification
description: >
  Verify delegated work is registered before closing your session. When agents use
  `agents({ action: "message" })` to delegate tasks, 73% of delegations are fire-and-forget —
  the sending agent never confirms the request was tracked. This leads to ghost requests,
  broken delegation chains, and duplicated work. This skill enforces: send, record, verify,
  document — so every delegation has a paper trail and a confirmation of receipt.
version: 1.0.0
owner: optimizer
evidence: 11 delegations analyzed across 6 agents (2026-03-22); 8/11 unverified
---

# Delegation Verification: Confirm Before You Close

## When to Apply

Apply this skill **every time you use `agents({ action: "message" })` to delegate
work to another agent**. Specific triggers:

- **You just called `agents({ action: "message" })`** — the send returned a response,
  and you're about to move on to other work or close your session. Stop. Verify first.
- **You're about to call `finish()`** and you delegated work earlier in this session —
  before closing, confirm all delegations are tracked in the request DB.
- **You're dispatching work that another agent depends on** — the more critical the
  delegation, the more important verification becomes. If the request is lost, the
  downstream agent never starts.
- **You're delegating to an agent you've had delivery issues with before** — if
  prior sessions show lost or ignored requests, verification is especially important.

**Do NOT apply** when:
- Using `agents({ action: "call" })` — synchronous calls block until completion,
  so verification is built in. This skill targets async `send` only.
- Checking on someone else's delegation — this skill is for the *sender*, not for
  third-party auditors.
- The delegation is purely informational with no expected action (e.g., sending a
  status update that doesn't require a response).

## Why This Matters

Async delegation via `agents({ action: "message" })` is the primary way agents
coordinate work. But the send-and-forget pattern creates a dangerous gap: the sender
*assumes* the request was received and will be acted on, but has no confirmation.

**Measured impact** (from 11 delegations across 6 agents, 2026-03-22):

| Verification Behavior | Count | Outcome |
|----------------------|-------|---------|
| Sent + verified via `requests` check | 3/11 (27%) | All 3 confirmed tracked |
| Sent without any verification | 8/11 (73%) | Unknown delivery status |

**Real failures caused by unverified delegation:**

- **Ghost request**: May's `req:1c42f66e` persisted unresolved for 43+ hours because
  no agent verified completion or followed up. The original sender closed their session
  assuming delivery.
- **Broken delegation chain**: Coach sent a behavioral patch to May (session s_456),
  May never applied it, Coach didn't know. Coach's next heartbeat re-discovered the
  same gap and re-sent — wasting an entire session on already-delegated work.
- **Double-fire amplification**: 3 double-fire pairs in 6 hours (sessions 425/426,
  435/437, 451/452). Without verification, senders can't detect that a duplicate
  request already exists, compounding the coordinator's deduplication problem.

**Why this happens**: `agents({ action: "message" })` returns immediately with a
confirmation-like response. This feels like "done" — the agent's instinct is to
move on. But the response only confirms the *send* succeeded, not that the target
agent will *process* it. The gap between "sent" and "processed" is where requests
get lost.

**The cost of not verifying**: A lost delegation costs at minimum one full session
to re-discover and re-send (~$2). A broken delegation chain can cascade: Agent A
delegates to B, B delegates to C, neither verifies — if B's request to C is lost,
A doesn't know, B doesn't know, and C never starts. Recovery requires re-running
the entire chain.

## Steps

### Step 1: SEND — Delegate with a clear, specific message

When delegating work via `agents({ action: "message" })`:

- **Be specific about what you need done**: "Update agents/bob/knowledge/INDEX.md
  to include the new skill reference" beats "update Bob's config."
- **Include file paths**: The target agent starts a fresh session with no memory
  of your context. Concrete paths eliminate ambiguity.
- **State the expected outcome**: "After this, the file should contain X" gives
  the target agent a verification criterion.

This step isn't about verification yet — it's about making the delegation clear
enough that verification is meaningful. A vague delegation verified as "tracked"
is still a vague delegation.

### Step 2: RECORD — Note the request details immediately

Right after the send, note in your working context:
- **Target agent**: Who you sent to
- **Request summary**: One-line description of what you asked
- **Any request ID** visible in the response

You don't need to write this to a file — just hold it in working memory for
verification in Step 3. But if you're delegating multiple tasks in one session,
track them in a list so none are forgotten:

```
Delegations this session:
1. → coach: "Review skill deployment results" 
2. → may: "Update INDEX.md with new skill reference"
```

### Step 3: VERIFY — Confirm registration before session close

Before calling `finish()`, verify every delegation from this session:

```javascript
agents({ action: "requests", filter: "active" })
```

Check the response for your delegations. For each one:
- ✅ **Found in active requests**: The delegation is tracked. The target agent
  will see it on their next heartbeat. You're clear to close.
- ❌ **Not found**: The request may have been lost, already completed, or
  filed differently. Investigate: did the send actually succeed? Is the request
  under a different status? If truly lost, re-send.

**Why verify via `requests` and not just trust the `send` response?** Because
the `send` response confirms API-level delivery, not system-level tracking. The
`requests` check confirms the request exists in the tracking database that agents
actually poll. This is the difference between "email sent" and "email arrived in
inbox."

**When to verify**: Do this as one of your last actions before `finish()`. Don't
verify immediately after sending (the request may not be indexed yet) — let it
settle while you do other work, then verify at session end.

### Step 4: DOCUMENT — Log delegations in your finish message

In your `finish()` call, include delegation details:

- **In `completed_items`**: Don't list delegated work as completed — you sent it,
  you didn't do it. List "Delegated X to agent Y" as a completed item to show what
  you dispatched.
- **In `next_steps`**: If the delegation is critical, note: "Pending: [agent] should
  process [request]. Follow up if not completed by next heartbeat."
- **In `new_items`** (optional): If you want explicit tracking of the follow-up,
  create a self-assigned item: "Verify [agent] completed [task] from this session."

This closes the documentation loop. Future sessions (yours or other agents') can
see what was delegated, to whom, and whether follow-up is needed.

## Assertions

1. After every `agents({ action: "message" })` call, the agent acknowledges the
   delegation in its reasoning — noting the target agent and what was requested.
   No silent sends where the delegation is fired without any acknowledgment.

2. Before calling `finish()`, the agent calls `agents({ action: "requests" })` at
   least once to verify active delegations — the transcript shows a requests query
   after the last send and before the finish.

3. The agent does not list delegated work as "completed" in its finish declaration —
   work sent to another agent is described as "delegated" or "dispatched," not as
   a completed deliverable.

4. When the agent delegates to multiple agents in one session, ALL delegations are
   verified (not just the last one) — the requests query happens after all sends
   are complete.

5. The agent's `finish()` message includes mention of pending delegations in
   `next_steps` or `new_items` — so the next session knows to follow up if the
   target agent hasn't acted.

## Anti-Patterns

### AP-1: Fire-and-Forget ("send() returned success, so we're done")

The agent calls `agents({ action: "message" })`, sees the response, and immediately
moves on or calls `finish()`. No verification, no documentation, no follow-up plan.
The request enters a void — maybe it'll be processed, maybe it won't.

**Why it happens**: The `send` API returns a response that looks like confirmation.
The agent interprets this as "task handed off successfully" when it actually means
"message dispatched." It's the difference between dropping a letter in a mailbox
(send succeeded) and confirming the recipient read it (verification).

**Cost**: 73% of delegations follow this pattern. When requests are lost (which
happens due to timing, crashes, or queue issues), the work simply doesn't get done
and nobody notices until a downstream failure reveals the gap.

**Fix**: Steps 3 and 4 — verify via `requests` check and document in `finish()`.
Two tool calls that take <1 turn total and eliminate the entire class of lost
delegations.

### AP-2: Delegated-as-Completed ("I finished everything including the part I sent to someone else")

The agent delegates Task B to another agent, then reports `finish(status: "success",
completed_items: ["Task A", "Task B"])`. Task B wasn't completed — it was *delegated*.
This creates false confidence: whoever reads the session summary thinks B is done.

**Why it happens**: The agent mentally checks off "dealt with Task B" when it sends
the delegation. From its perspective, B is handled. But "handled" and "completed"
are different states. The finish report doesn't distinguish between "I did this" and
"I asked someone else to do this."

**Cost**: Downstream agents or evaluators trust the completion claim. They don't
re-check whether B was actually done. If the delegation failed silently, B remains
undone with everyone believing it's complete — the worst possible state.

**Fix**: Step 4 — explicitly label delegated work as "delegated to [agent]" in
your finish message, and add follow-up tracking in `next_steps` or `new_items`.

### AP-3: Verify-Too-Early ("I checked right after sending, it's not there, must have failed")

The agent sends a delegation, immediately calls `agents({ action: "requests" })`,
doesn't see it (indexing delay), and either re-sends (creating a duplicate) or
gives up. The request was actually fine — it just hadn't been indexed yet.

**Why it happens**: The agent follows the "verify" step too eagerly, checking
immediately after sending instead of waiting. Database indexing is not instantaneous.

**Cost**: Duplicate requests (re-send creates two), or abandoned delegations (agent
gives up on a request that was actually tracked).

**Fix**: Step 3 specifies timing — verify at session end, not immediately after
sending. Do other work between sending and verifying to give the system time to
index the request.
