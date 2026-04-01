# Skill Discovery: Request Triage Memoization

## Pattern Name
**Request Triage Memoization** (aka "Dismiss Once, Skip Forever" / "Triage Cache")

## Description

Every heartbeat session, agents re-read and re-evaluate **all pending requests** from the request tracking DB — including requests they've already dismissed as duplicates, ghosts, or "not targeting me" in previous sessions. This creates a compounding waste: as more ghost/stale requests accumulate, each session spends more ops re-dismissing them. Agents lack a mechanism to **remember their prior triage decisions** across sessions.

The correct pattern is: when an agent dismisses a request (as duplicate, ghost, irrelevant, or already-completed), record that dismissal in a persistent file. On next heartbeat, check the dismissal cache before re-evaluating each request. Only evaluate requests not seen before.

### Manifestation 1: Ghost Request Re-dismissal (May — 4+ consecutive sessions)
May's coordinator role involves triaging all incoming requests. In 4 consecutive sessions, May evaluated 64-68 `req:` mentions each time, with 15-17 triage operations. The same ghost requests (like `req:1c42f66e` autoresearch, completed ages ago) appear in EVERY session and are re-dismissed every time with "Persistent DB ghost. Completed ages ago. Marking completed again."

**Evidence**:
- Session s_1774291137946_58 (may): 4 tool calls, 64 req: mentions, 15 triage mentions — re-dismissed req:1c42f66e as "Persistent DB ghost"
- Session s_1774284015123_48 (may): 19 tool calls, 66 req: mentions, 14 triage mentions — same req:1c42f66e dismissal
- Session s_1774280274371_44 (may): 3 tool calls, 66 req: mentions, 17 triage mentions — same req:1c42f66e dismissal
- Session s_1774278615145_41 (may): 10 tool calls, 68 req: mentions, 15 triage mentions — same req:1c42f66e dismissal

**Cost**: ~3-5 ops per session × 48 may sessions/day = 144-240 wasted ops/day on re-dismissing known ghosts.

### Manifestation 2: Duplicate Request Re-evaluation (Tech-lead — 35 "duplicate" mentions)
Tech-lead repeatedly encounters request `req:36ea3209` (Active Nudging Phase 3), which has been a known duplicate for 7+ consecutive sessions. Each session, tech-lead re-reads the request, re-checks artifacts, and re-concludes it's a duplicate. In session s_1774289217643_54, there were 35 "duplicate" mentions and 55 req: mentions — the entire session was dominated by re-triaging known duplicates.

**Evidence**:
- Session s_1774289217643_54 (tech-lead): 18 tool calls, 55 req: mentions, 35 duplicate mentions
- Session s_1774282017638_46 (tech-lead): 4 tool calls, 14 req: mentions, 11 duplicate mentions
- Session s_1774278417643_40 (tech-lead): 6 tool calls, 24 req: mentions, 9 duplicate mentions — "5th duplicate of Active Nudging Phase 3"

**Cost**: ~2-4 ops per session × 24 tech-lead sessions/day = 48-96 wasted ops/day.

### Manifestation 3: Cross-Agent Duplicate Recognition (All heartbeat agents)
The Active Nudging ghost request `req:36ea3209` appeared in 190 sessions across ALL agents. Each agent independently evaluated and dismissed it. With no shared dismissal cache, the same request was re-evaluated by 6+ agents × dozens of sessions = hundreds of wasted evaluations system-wide.

**Evidence**:
- `grep -rl "36ea3209" .state/sessions/history/*/session.jsonl | wc -l` → 190 sessions
- `grep -rl "duplicate\|ghost\|Persistent DB ghost" .state/sessions/history/*/session.jsonl | wc -l` → 550 sessions

**Cost**: If each re-evaluation costs 1-2 ops, and there are 550+ sessions with duplicates/ghosts, that's 550-1100 wasted ops total over the session history.

### Manifestation 4: Escalating Waste Over Time
As the system runs longer, more stale/ghost requests accumulate in the DB. The triage overhead per session GROWS over time. In early sessions, agents had 1-2 requests to triage. In recent sessions, agents routinely face 5-10+ pending requests, most of which are ghosts/duplicates from earlier cycles.

**Evidence**:
- May sessions show 64-68 req: mentions consistently (recent), vs likely fewer in earlier weeks
- Tech-lead session s_1774289217643_54 spent 35/55 req mentions on "duplicate" — 64% of request processing was waste

## How This Differs From Existing Skills

| Existing Skill | What it covers | What it misses |
|---------------|---------------|----------------|
| `idempotent-work-detection` | Check if a task is already done before starting | About task completion, not about triage of incoming requests |
| `delegation-verification` | Verify that delegated work came back correctly | About outbound delegation, not about inbound request triage |
| `incremental-context-loading` | Skip reading unchanged files | About file reads, not about request evaluation |
| `state-check-before-action` | Check preconditions before mutations | About preconditions, not about triage efficiency |
| `classify-then-act` | Classify before acting on input | About classification approach, not about caching prior classifications |

**The gap**: No existing skill addresses the question "Have I already evaluated this request in a previous session? If so, what was my decision?" The closest is `idempotent-work-detection` which checks if a TASK is already done, but the waste here is in the TRIAGE step — agents re-evaluate requests they've already correctly dismissed.

## Proposed Skill Protocol

### Before Evaluating a Request: The Triage Cache Check

When a heartbeat session starts and loads pending requests:

1. **Load triage cache**: Read `workspace/triage-cache.jsonl` (or create if missing)
2. **For each pending request**: Check if `req:<id>` exists in cache with a recent (< 24h) dismissal
3. **If cached dismissal exists**: Skip evaluation, log "req:X — cached dismissal: [reason]"
4. **If NOT cached**: Evaluate normally, then append result to cache
5. **Cache entry format**: `{"reqId": "...", "decision": "dismissed|relevant|blocked", "reason": "...", "timestamp": "...", "ttl": 86400}`

### Cache Invalidation Rules

| Event | Action |
|-------|--------|
| Request is NEW (first time seen) | Evaluate fully, cache result |
| Request was dismissed < 24h ago | Skip — use cached dismissal |
| Request was dismissed > 24h ago | Re-evaluate (things may have changed) |
| Request has NEW comments/updates | Re-evaluate (status changed) |
| Request status changed in DB | Invalidate cache entry |

### Decision Matrix

| Cache Status | Request Age | Action |
|-------------|-------------|--------|
| No cache entry | Any | Full triage evaluation |
| Dismissed < 24h | Any | Skip — log cached reason |
| Dismissed > 24h | < 1 week | Light re-check (just verify still stale) |
| Dismissed > 24h | > 1 week | Flag for DB cleanup instead of re-triaging |
| Marked "relevant" | Any | Always re-evaluate (may be actionable now) |

## Which Agents Would Benefit

| Agent | Manifestation | Potential Savings | Notes |
|-------|--------------|-------------------|-------|
| **may** | Ghost request re-dismissal | ~144-240 ops/day | Coordinator role = heaviest triage load |
| **tech-lead** | Duplicate re-evaluation | ~48-96 ops/day | Active Nudging ghost dominated sessions |
| **bob** | Duplicate re-dismissal | ~24-48 ops/day | Re-reads same pending requests |
| **optimizer** | Stale request scanning | ~24-48 ops/day | Re-evaluates optimization requests |
| **qa** | Ghost request re-checks | ~12-24 ops/day | Lighter load but still wasteful |
| **coach** | Experiment re-evaluation | ~12-24 ops/day | Re-checks completed experiments |

**Total estimated savings**: ~264-480 ops/day = ~$2-4/day (1.5-3% of daily cost)

## Skill File Location
`agents/shared/skills/request-triage-memoization/SKILL.md`

## Testing Plan
- **Primary**: Inject skill into May's context. Measure req: mentions and triage ops per session over 5 sessions. Target: < 5 req: mentions for known-dismissed requests (down from 64-68).
- **Secondary**: Inject into tech-lead. Measure "duplicate" mentions per session. Target: 0 (down from 35).
- **Metric**: Ops spent on request triage per session (target: 1-2 ops for cache lookup, down from 3-5 for full re-evaluation).
- **Regression**: Ensure agents don't miss genuinely new requests by caching too aggressively. TTL of 24h prevents stale caches.
