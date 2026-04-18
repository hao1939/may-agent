# Session Startup Flow: Complexity Analysis

**Date**: 2026-04-11  
**Lens**: B — Session startup flow complexity  
**Status**: Analysis complete  

## 1. The 9-Layer Flow (cron fire → LLM first token)

### Layer 1: Cron.fire() — `src/app/cron.ts:419-525`
**What**: Timer fires → overlap check → auto-pause state machine → route to fireHeartbeat/fireHandler/fireDetachedJob.  
**Load-bearing**: YES. Overlap protection prevents duplicate sessions. Auto-pause prevents wasting money on broken agents.  
**Complexity**: Moderate. The auto-pause state machine (running/auto-paused/probe) adds ~100 lines but has clear value — it's the circuit breaker for agent failures.

### Layer 2: Cron.fireHeartbeat() — `src/app/cron.ts:~530-600`
**What**: Request tracking (DB insert) + context file injection + task text assembly.  
**Load-bearing**: YES. Request tracking enables the coordinator to know what's running.  
**Note**: Context injection here is REDUNDANT with Layer 6 — it just sets `contextFiles` on the definition, which Layer 6 then reads.

### Layer 3: manager.run() — `src/lib/manager.ts:900-1060`  
**What**: Directory setup, session persistence, registry save, timeout setup, activity tracking, event emission, then builds context and kicks off the agent.  
**Load-bearing**: YES. Core session lifecycle management.  
**Note**: 160 lines of setup before `agent.prompt()` fires. Most of it is essential plumbing (persistence, events, timeouts). The `ActiveSession` object has **25 fields** — growing over time as features accumulate.

### Layer 4: manager.createAgent() — `src/lib/manager.ts:349-408`
**What**: Checkpoint tool injection, tool filtering, Agent() construction with 10 composed guards + receipt wrapping.  
**Load-bearing**: YES. The guard chain and receipt wrapping are the core safety/integrity layer.  
**Analysis of 10 guards** — see Section 3 below.

### Layer 5: resolveSystemPrompt() — `src/lib/manager.ts:410-510`  
**What**: Assembles system prompt from SOUL.md + common-sense.md + skills/*.md + Runtime Env section + Available Tools section. Wraps in `<system_instructions>` tags.  
**Load-bearing**: YES. This is the agent's identity and behavioral framework.  
**Size measurements** (tech-lead):
| Component | Chars | ~Tokens |
|-----------|-------|---------|
| SOUL.md | 5,353 | 1,338 |
| common-sense.md | 2,931 | 733 |
| skills/*.md (4 files) | 7,964 | 1,991 |
| Runtime Environment | 274 | 69 |
| Available Tools | 212 | 53 |
| **Total system prompt** | **16,774** | **~4,194** |

**Coder is heavier**: 11 skill files = 45,693 chars (~11,400 tokens) in skills alone.  
**Concern**: Coder's system prompt is approaching ~15K tokens, which is substantial.

### Layer 6: buildSessionContext() — `src/lib/manager.ts:514-640`  
**What**: Per-session volatile context prepended to the first user message.  
**7 sub-components**:
1. Session ID + timestamp (100 chars)
2. Digest history — recent task outcomes (currently 0 digests in DB; designed for ~1,500 chars)
3. Active Recall — failure warnings from ERROR_LOG.jsonl (~400 chars when triggered)
4. Checkpoint injection — resume state from last session (~500 chars)
5. context_files — loaded from agent.json `contextFiles` field
6. context.md — persistent learned facts (tech-lead: 2,935 chars)
7. Knowledge routing — keyword-matched knowledge pointers (heartbeat only, ~300 chars)

**Total user context (tech-lead heartbeat estimate)**: ~5,735 chars (~1,434 tokens)

### Layer 7: Few-shot routing — `src/lib/manager.ts:1015-1025`
**What**: Matches task text against regex patterns in example files. Injects worked examples between context and task.  
**Phase 1 scope**: Only coder + optimizer agents.  
**Load-bearing**: MARGINAL — see Section 4 below.

### Layer 8: gatedPrompt() — `src/lib/manager.ts` (varies)
**What**: API rate limiting via `apiGate`. Ensures we don't exceed provider rate limits.  
**Load-bearing**: YES. Essential for staying within API limits.

### Layer 9: runAgentWithRetry() — infrastructure retry wrapper
**What**: Wraps the agent.prompt() call with retry logic for transient API failures.  
**Load-bearing**: YES. Without this, temporary API errors would kill sessions.

---

## 2. Total Context Budget (before task text)

| Section | Tech-lead | Coder (est) |
|---------|-----------|-------------|
| System prompt | 16,774 chars / ~4.2K tok | ~50K chars / ~12.5K tok |
| User context | 5,735 chars / ~1.4K tok | ~2K chars / ~500 tok |
| **Pre-task total** | **~22.5K chars / ~5.6K tok** | **~52K chars / ~13K tok** |

The coder agent's **45KB of skill files** dominates its context. This is worth auditing separately — are all 11 skill files pulling their weight?

---

## 3. Guard Chain Analysis (10 guards in createAgent)

### Guard Hit Rates (last 100 sessions)

| Guard | Sessions with blocks | Rate | Verdict |
|-------|---------------------|------|---------|
| finish-guard (evidence validation) | 45 | 45% | **ESSENTIAL** — prevents false success claims |
| commit-guard | 31 | 31% | **ESSENTIAL** — forces agents to commit work |
| read-dedup-guard | 22 | 22% | **VALUABLE** — prevents infinite read loops |
| session-read-guard | 11 | 11% | **VALUABLE** — blocks expensive session.jsonl reads |
| path-hallucination-guard | 9 | 9% | **VALUABLE** — catches hallucinated filesystem paths |
| empty-args-guard | 1 | 1% | LOW but cheap — catches missing params |
| tool-schema-guard | 1 | 1% | LOW but cheap — catches cross-tool confusion |
| completeness-guard | ~0* | ~0% | **OPTIMIZER-ONLY** — can't measure precisely |
| verification-depth-guard | ~0* | ~0% | Fires on finish(); captured in finish-guard count |
| scrape-dedup-guard | 1 | 1% | LOW — only relevant for scout agent |

\* Completeness and verification-depth guards fire as part of the finish() interception. Their blocks are subsumed in the finish-guard count. They're not independently measurable without adding logging.

**Also active but not in the 10-guard chain**: 
- **Pivot Heuristic** (in receipt wrapper): 31% of sessions see `⚠️ PIVOT REQUIRED` warnings; 2% see `🚫 E_RETRY_LIMIT` blocks.
- **Cross-edit guard**: Built into edit/write tools directly, not composed.

### Assessment
The 10-guard chain is **justified**. Each guard is either:
- High-frequency (finish, commit, read-dedup, session-read, path-hallucination)
- Low-frequency but zero-cost when not triggered (empty-args, tool-schema, scrape-dedup)

The `composeGuards()` architecture is clean — first blocker wins, fail-open on errors. The chain adds negligible latency (all guards are synchronous transcript scans, no I/O).

**No guards should be removed.**

---

## 4. Knowledge Routing Assessment

**Fires**: Only during heartbeat sessions (by design).  
**Match quality**: Tested with 5 agent heartbeat messages → every single one matches exactly 1 entry: `KE-011: "Knowledge files are passive — agents skip them"`. The same entry, for every agent, every heartbeat.  
**Cost**: ~300 chars per heartbeat × ~48 heartbeats/day = ~14,400 chars/day across all agents.  
**Problem**: The keyword matching is too coarse. The heartbeat message is `[heartbeat] Read agents/<name>/heartbeat.md and work through each section` — the word "agents" or "knowledge" triggers KE-011 every time. There's no task-specific signal in a heartbeat message.

**Verdict**: **Knowledge routing is not pulling its weight.** It injects the same generic pointer every time. The ~300 tokens per session aren't wasted (they're cheap), but the feature is inert — it provides zero task-relevant signal.

**Recommendation**: Either (a) feed the actual task text after heartbeat.md processing (but that happens inside the session, not before), or (b) disable knowledge routing for heartbeats and only enable it for delegated tasks where the task text has actual keywords. The current "only heartbeat" restriction is backwards — heartbeats have the least informative task text.

---

## 5. Few-Shot Routing Assessment

**Fires**: Only for coder + optimizer agents, and NOT for heartbeats.  
**Example count**: 5 examples (binary-file-escalation, escalation-judgment, evidence-over-narrative, know-when-blocked, reproduce-first-debugging).  
**Token budget**: ~450-520 tokens per example, max 2 per task, max 3,000 tokens.  
**Match behavior**: Tested 4 typical coder tasks → 3/4 matched at least one example.  

**Verdict**: **Reasonably well-designed but untestable from here.** The trigger patterns are broad (e.g., "bug|error|failing" matches most debug tasks). Whether the injected examples actually improve task outcomes requires gym experiment data, which I don't have access to. The code references EXP-084 through EXP-097 showing "0% to 100% pass rate improvement" — if that holds, it's justified.

**Concern**: The broad patterns mean most coder tasks will get a few-shot example injected. At ~500 tokens × 2 examples = ~1,000 tokens per session, this adds up. If the examples don't improve outcomes for generic tasks (only for the specific failure modes they address), they're wasted context.

---

## 6. Session Digest Assessment

**Current state**: `session_digests` table has **0 rows**. The digest system was designed (Phase 5) but appears to have no data being written in practice.

**Impact**: The `buildSessionContext()` code queries for recent digests (`getRecentDigests`), cross-agent digests (`getCrossAgentDigests`), and unresolved digests (`getUnresolvedDigests`) — all return empty arrays. This means:
- Recent Task History section: empty
- Cross-agent awareness: none
- Unresolved items: none

**Verdict**: ~15 lines of code in `buildSessionContext()` are executing 3 DB queries that always return nothing. Not harmful (queries are fast), but the feature is **inert**.

---

## 7. Redundancy & Overlap Analysis

### Identified redundancies:

1. **Context files flow**: Layer 2 (cron) sets `def.contextFiles`, Layer 6 (`buildSessionContext`) reads them. This is fine — it's pass-through, not duplication.

2. **Active Recall + context.md overlap**: Both inject failure warnings. Active Recall reads ERROR_LOG.jsonl for last 3 days, while context.md has permanent learned facts (including failure patterns). In practice, context.md entries like "FM-3.3 prevention" duplicate what Active Recall surfaces. **Minor overlap**, but acceptable — Active Recall is temporal (fades after 3 days), context.md is permanent.

3. **Knowledge routing + context.md overlap**: Knowledge routing injects KE-011 which says "knowledge files are passive." This is meta-knowledge about the system. The agent's context.md already has much more specific operational knowledge. **Knowledge routing adds nothing the agent doesn't already know.**

### No layers can be merged without loss:

Each of the 9 layers handles a distinct concern:
- Layers 1-2: Scheduling & overlap
- Layer 3: Session lifecycle
- Layer 4: Tool safety
- Layer 5: Agent identity
- Layer 6: Session memory
- Layer 7: Task-specific examples
- Layer 8: Rate limiting
- Layer 9: Fault tolerance

The layering is **architecturally sound**. The complexity comes from legitimate feature accumulation, not design confusion.

---

## 8. Concrete Recommendations

### 🔴 HIGH IMPACT — Investigate

| # | Recommendation | Effort | Impact |
|---|---------------|--------|--------|
| 1 | **Audit coder's 11 skill files** (45KB = ~11K tokens in system prompt). Some may be stale or redundant. Each removed file saves tokens on every single coder session. | 2h | HIGH — most frequent agent, most context |
| 2 | **Fix or disable knowledge routing**: Currently injects same KE-011 pointer on every heartbeat. Either (a) remove heartbeat-only restriction and feed actual task text, or (b) disable it until the index grows beyond keyword-matched heartbeat noise. | 30min | LOW cost savings, but removes dead weight |

### 🟡 MEDIUM — Monitor

| # | Recommendation | Effort | Impact |
|---|---------------|--------|--------|
| 3 | **Populate session digests** or remove the query code. The digest table has 0 rows — three DB queries per session returning nothing. Not harmful, but inert code = confusion for future readers. | 1h | CLARITY |
| 4 | **Add guard firing metrics**: We can't distinguish finish-guard vs verification-depth vs completeness blocks because they all fire on finish(). Adding a log line per guard block (`[guard] <name> blocked <agent>/<session>`) would enable data-driven guard tuning. | 1h | OBSERVABILITY |

### 🟢 LOW PRIORITY — No action needed

| # | Finding | Why no action |
|---|---------|--------------|
| 5 | 25-field ActiveSession object | Growing but each field serves a purpose. Normal for a mature session manager. |
| 6 | 10-guard chain | Every guard is justified by hit rate or low cost. Architecture (composeGuards) is clean. |
| 7 | Few-shot routing | Working as designed; needs gym data to evaluate effectiveness. |
| 8 | Receipt signing overhead | ~30 lines per tool call, but provides integrity guarantees. Non-negotiable. |

---

## 9. Summary

**The session startup flow is complex but not gratuitously so.** 9 layers × 7 sub-components in context injection × 10 guards sounds alarming, but each piece was added for a documented reason with evidence (experiment IDs, failure mode codes).

The main findings:
1. **Coder's 45KB skill footprint** is the biggest lever for context optimization
2. **Knowledge routing is inert** — same match every time, no signal
3. **Session digests are unimplemented** — design exists but no data flows through
4. **Guard chain is working** — 45% of sessions see finish-guard blocks, 31% see commit-guard blocks
5. **No architectural simplification needed** — the layers are well-separated

The system's complexity is proportional to its feature set. The risk isn't in the architecture — it's in **accumulating inert features** (knowledge routing, session digests) that add code paths without delivering value.
