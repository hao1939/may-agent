---
name: request-triage-memoization
version: 1.0.0
description: >
  Cache triage decisions for pending requests across sessions. Agents waste
  significant ops re-evaluating the same ghost/duplicate/stale requests every
  heartbeat — requests they already dismissed in previous sessions. This skill
  enforces a triage cache: record dismissals persistently, check the cache
  before evaluating any request, and only fully evaluate requests not seen
  before or whose status has changed.
owner: optimizer
evidence: >
  Cross-agent analysis of 190+ sessions showing redundant request triage.
  May re-dismissed ghost req:1c42f66e across 4 consecutive sessions with
  identical "Persistent DB ghost" reasoning (s_1774291137946_58,
  s_1774284015123_48, s_1774280274371_44, s_1774278615145_41). Tech-lead
  spent 35 of 55 req mentions on known duplicates in s_1774289217643_54.
  Ghost req:36ea3209 appeared in 190 sessions across all agents. Estimated
  waste: 264-480 ops/day system-wide on re-triaging already-dismissed requests.
---

# Request Triage Memoization: Dismiss Once, Skip Forever

## When to Apply

Apply this skill **whenever your session involves evaluating pending requests**
from the request tracking DB — typically at the start of heartbeat sessions
when you load and triage incoming work.

Specific triggers:

1. **You're about to scan pending requests** and you recognize request IDs
   you've already evaluated in a previous session. Before re-evaluating each
   one, check your triage cache for a prior decision.
2. **Your heartbeat loads a list of `req:` items** and you notice several
   that you dismissed last time as duplicates, ghosts, or "not for me." Those
   dismissals should be cached, not re-derived from scratch.
3. **You're spending multiple ops evaluating a request you know is stale** —
   reading its artifacts, checking its status, only to reach the same "dismiss"
   conclusion you reached last session. The cache eliminates this redundant work.
4. **You see the same request ID appearing across many consecutive sessions**
   without any status change. This is the strongest signal — if a request has
   been dismissed 3+ times, it belongs in a persistent cache.

**Do NOT apply** when:
- The request is **genuinely new** — you've never seen it before and have no
  cached decision. Fully evaluate new requests every time.
- The request has **new comments, status changes, or updated artifacts** since
  your last evaluation. Invalidate the cache entry and re-evaluate.
- You're in a **non-heartbeat session** focused on a specific task — this skill
  targets the recurring triage phase of heartbeat work, not one-off task
  evaluation.

## Why This Matters

Heartbeat agents run dozens of sessions per day. Each session loads pending
requests and triages them: is this relevant to me? Is it a duplicate? Is it a
ghost from a completed task? For most agents, the request list changes slowly
— maybe 1-2 new requests per day — but agents re-evaluate the entire list
every session.

The result is compounding waste: as stale/ghost requests accumulate, each
session spends more ops re-dismissing them. An agent that started with 2
requests to triage now faces 10+, and 80% are known ghosts.

### Quantified evidence

| Agent | Waste Type | Sessions Observed | Ops/Session | Daily Waste |
|-------|-----------|-------------------|-------------|-------------|
| may | Ghost re-dismissal (req:1c42f66e) | 4 consecutive | 3-5 ops | ~144-240 ops |
| tech-lead | Duplicate re-evaluation (req:36ea3209) | 3 consecutive | 2-4 ops | ~48-96 ops |
| all agents | req:36ea3209 appeared in | 190 sessions total | 1-2 ops each | 550+ wasted evals |

**Total estimated savings**: 264-480 ops/day across all agents, plus reduced
context window pollution from loading and reasoning about requests that will
always be dismissed the same way.

### How this differs from existing skills

- **`idempotent-work-detection`**: Checks if a *task* was already completed.
  This skill caches *triage decisions* about whether to even start a task.
- **`incremental-context-loading`**: Skips re-reading unchanged *files*. This
  skill skips re-evaluating unchanged *requests* — a different unit of work.
- **`classify-then-act`**: Classifies input before acting. This skill caches
  prior classifications to avoid re-classifying the same input repeatedly.
- **`state-check-before-action`**: Checks preconditions before mutations. This
  skill checks a decision cache before evaluations — no mutation involved.

## Steps

### Step 1: LOAD — Read your triage cache at session start (1 command)

Before evaluating any pending requests, load your triage cache:

```bash
cat workspace/triage-cache.jsonl 2>/dev/null || echo "No cache — evaluate all requests"
```

Each line in the cache is a JSON object recording a prior triage decision:
```json
{"reqId": "req:1c42f66e", "decision": "dismissed", "reason": "Ghost — completed ages ago", "ts": "2026-03-23T10:00:00Z"}
```

If the file doesn't exist, this is your first time — evaluate everything and
create the cache at the end. The cost of one `cat` command is negligible
compared to the 3-5 ops you'd spend re-triaging each cached request.

### Step 2: FILTER — Separate new requests from cached ones (0 commands — just think)

When you receive the list of pending requests, mentally partition them:

- **Cached + recent (< 24h)**: You already evaluated this request and the
  decision is still fresh. **Skip it.** Log a one-line note: "req:X — cached
  dismissal: [reason from cache]." Do not re-read artifacts, re-check status,
  or re-derive the decision.
- **Cached + stale (> 24h)**: Your cached decision is old enough that
  circumstances may have changed. Do a **light re-check**: glance at the
  request status. If unchanged, refresh the cache timestamp and move on.
  If status changed, do a full evaluation.
- **Not cached**: This is a genuinely new request. **Fully evaluate** it —
  read artifacts, check context, make a triage decision.

This is the core insight: you don't need to evaluate every request from scratch
every session. Most requests haven't changed since your last evaluation, and
your prior decision is still valid. Treat your past reasoning as a reusable
asset, not something to re-derive.

### Step 3: EVALUATE — Only fully evaluate new/changed requests

For requests that pass the filter (new or status-changed), evaluate them
normally using your standard triage process. This step is unchanged from your
current workflow — the skill only optimizes the requests you *don't* need to
re-evaluate.

### Step 4: RECORD — Append new decisions to the cache

After evaluating new requests, append each decision to your cache:

```bash
echo '{"reqId": "req:NEW_ID", "decision": "dismissed", "reason": "Duplicate of req:EXISTING", "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> workspace/triage-cache.jsonl
```

Valid `decision` values:
- **`dismissed`**: Ghost, duplicate, not-for-me, already-completed. Safe to
  skip in future sessions.
- **`accepted`**: You're going to work on this. Don't cache — re-check each
  session to track progress.
- **`deferred`**: Relevant but not urgent. Cache for 24h, then re-check.

Only cache `dismissed` and `deferred` decisions. Accepted requests should
always be re-evaluated because you need to track their progress.

### Step 5: PRUNE — Clean stale entries periodically

Once per day (or when the cache exceeds 30 entries), prune entries older
than 48 hours. This prevents the cache itself from becoming stale or growing
unboundedly:

```bash
# Keep only entries from the last 48h
python3 -c "
import json, sys
from datetime import datetime, timedelta
cutoff = datetime.utcnow() - timedelta(hours=48)
for line in open('workspace/triage-cache.jsonl'):
    entry = json.loads(line.strip())
    ts = datetime.fromisoformat(entry['ts'].replace('Z', '+00:00')).replace(tzinfo=None)
    if ts > cutoff:
        print(json.dumps(entry))
" > workspace/triage-cache-new.jsonl && mv workspace/triage-cache-new.jsonl workspace/triage-cache.jsonl
```

Pruning matters because a request you dismissed 3 days ago may have been
updated since. The 48h TTL ensures you periodically re-evaluate even
dismissed requests, preventing truly stale cache entries from hiding
legitimate work.

## Assertions

1. **Cache is consulted before request evaluation**: When the agent begins
   triaging pending requests, the transcript shows the agent reading (or
   attempting to read) `workspace/triage-cache.jsonl` *before* evaluating
   individual requests. There is a `cat` or `read` call for the cache file
   prior to any request-specific evaluation.

2. **Known-dismissed requests are skipped with cached reason**: When a request
   ID appears in the cache with a `dismissed` decision less than 24h old,
   the agent does NOT re-read the request's artifacts, re-check its status,
   or re-derive the dismissal reasoning. Instead, the agent logs a one-line
   cached dismissal note and moves on.

3. **New triage decisions are appended to the cache**: After evaluating a
   request not found in the cache, the agent writes the decision to
   `workspace/triage-cache.jsonl` with the request ID, decision, reason,
   and timestamp. The cache file has more entries at session end than it
   did at session start (or is newly created).

4. **New requests still receive full evaluation**: Requests that have no cache
   entry are fully evaluated — the agent reads relevant artifacts, checks
   context, and makes a fresh decision. The cache does not cause the agent to
   skip genuinely new requests.

5. **Ops spent on known-dismissed requests are minimal**: For requests that
   exist in the cache as `dismissed`, the agent spends ≤1 op per request
   (the cache lookup line). It does not spend 3-5 ops re-reading artifacts
   and re-reasoning about requests it has already dismissed.

## Anti-Patterns

### AP-1: The Full Inbox Scan

**Pattern**: Agent loads all pending requests and evaluates each one from
scratch every session, spending 3-5 ops per request on artifact reads, status
checks, and reasoning — even for requests it dismissed identically in the
previous 4 sessions.

**Real example**: May processed 64-68 `req:` mentions across 4 consecutive
sessions, dismissing `req:1c42f66e` with the identical phrase "Persistent DB
ghost. Completed ages ago. Marking completed again." each time. That's 12-20
ops spent across those sessions on a single ghost request that could have been
cached once and skipped thereafter.

**Why it happens**: The heartbeat instruction says "check pending requests."
Agents interpret this as "evaluate ALL pending requests from scratch" rather
than "check for NEW pending requests." Without a cache mechanism, agents have
no way to distinguish "already evaluated" from "needs evaluation."

**Fix**: Steps 1-2 of this skill. Load the cache, filter known-dismissed
requests, only fully evaluate what's new.

### AP-2: The Thorough Re-investigator

**Pattern**: Agent knows a request is a duplicate (it even says so: "this is
the 5th time I've seen this duplicate") but still reads the artifacts, checks
the status, and writes a detailed reasoning about why it's a duplicate.
Self-awareness of the waste doesn't prevent it.

**Real example**: Tech-lead in session s_1774289217643_54 had 35 "duplicate"
mentions out of 55 total req mentions. The agent recognized req:36ea3209 as a
known duplicate but still spent ops verifying and re-documenting that conclusion.

**Why it happens**: Agents feel obligated to "show their work" even when the
conclusion is obvious from prior sessions. There's no mechanism to say "I
already showed my work on this — here's the cached receipt."

**Fix**: Step 4 of this skill. The cache entry IS the receipt. When you see a
cached dismissal, cite it: "req:X — cached dismissal: duplicate of req:Y
(evaluated 2026-03-23T10:00Z)." This satisfies the obligation to document the
decision without re-deriving it.

### AP-3: The Optimistic Re-checker

**Pattern**: Agent re-evaluates dismissed requests "just in case something
changed" even when there's no signal that anything did. The request has no new
comments, no status change, and was last dismissed 30 minutes ago — but the
agent checks anyway because "I should be thorough."

**Why it happens**: Agents conflate "thoroughness" with "re-doing prior work."
True thoroughness would be recognizing that nothing has changed and allocating
those ops to genuinely new work instead.

**Fix**: Step 2's freshness matrix. If the cached decision is < 24h old and
the request shows no status change, trust the cache. Thoroughness means
spending your ops where they'll have impact — on new requests, not on
re-confirming old dismissals.
