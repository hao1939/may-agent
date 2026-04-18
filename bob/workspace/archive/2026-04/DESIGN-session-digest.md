# ⚠️ SUPERSEDED — See DESIGN-session-journal-final.md

This design was over-engineered. The replacement is `DESIGN-session-journal-final.md` — 
one LLM call at session end, one DB column, done.

---

# DESIGN: Session Digest Architecture (ARCHIVED)

**Author:** Bob  
**Date:** 2026-04-05  
**Status:** SUPERSEDED by DESIGN-session-journal-final.md  
**Scope:** Cross-session memory, context injection, knowledge persistence

---

## 1. Problem Statement

Agents lose context between sessions. The current memory system records a single JSONL line per session with a few fields (task, status, duration, summary). This gets injected as `## Recent Task History` in the session context. But:

1. **Shallow memory**: A 200-char summary can't capture what the agent learned, which approaches failed, or what state the codebase was left in.
2. **No knowledge transfer across compactions**: Within a session, compaction preserves key facts (files read/written, exec commands). But across sessions, all of that is lost — the next session starts from scratch.
3. **Lessons don't persist**: The `finish()` tool collects `lessons` (fix/pattern/insight), but these are written to a flat memory JSONL and never systematically resurfaced. An agent can make the same mistake in session N+1 that it corrected in session N.
4. **No structural continuity**: Checkpoints save state mid-session for crash recovery, but they're point-in-time snapshots. There's no mechanism for synthesizing *what happened over the last K sessions* into a coherent briefing.
5. **Memory is per-agent only**: Agent A can't learn from agent B's experience on the same codebase area, even when they work on related problems.

### What we want

An agent waking up should get a briefing that feels like "here's what you need to know" — not just a log of what happened. The briefing should include:
- What you were working on and where you left off
- What approaches worked and which failed (and why)
- What the codebase looks like right now (files recently modified, active branches)
- Lessons learned that are still relevant
- Cross-agent context: what others did that affects your domain

---

## 2. Architecture Overview

```
                    ┌─────────────┐
                    │ Session Ends │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Completion  │  (existing: completion.ts)
                    │   Pipeline   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼────┐ ┌────▼─────┐ ┌───▼────────┐
        │  Memory   │ │  Digest  │ │  Lessons   │
        │  Writer   │ │  Writer  │ │  Writer    │
        │(existing) │ │  (NEW)   │ │  (NEW)     │
        └──────────┘ └────┬─────┘ └───┬────────┘
                          │           │
                   ┌──────▼──────┐  ┌─▼──────────┐
                   │ digest.jsonl│  │ lessons.jsonl│
                   │ (per-agent) │  │ (per-agent)  │
                   └──────┬──────┘  └──────────────┘
                          │
                    ┌─────▼──────────┐
                    │  Session Start  │
                    │ buildSessionCtx │  (existing: manager.ts)
                    └─────┬──────────┘
                          │
                   ┌──────▼──────────┐
                   │ Digest Compiler │  (NEW)
                   │ → briefing text │
                   └─────────────────┘
```

Three new components:
1. **Digest Writer** — enriched session-end subscriber that writes structured digest entries
2. **Lessons Writer** — extracts and persists agent-generated lessons
3. **Digest Compiler** — reads recent digests + lessons at session start, produces a briefing

---

## 3. Digest Entry (what gets written)

### 3.1 DigestEntry interface

```typescript
export interface DigestEntry {
  /** ISO timestamp of session end */
  timestamp: number;
  /** Session ID for traceability */
  sessionId: string;
  /** Agent that ran this session */
  agent: string;

  // ── Task & Outcome ──
  /** Original task (truncated to 500 chars) */
  task: string;
  /** Finish status: success/failure/blocked/partial, or error/interrupted */
  status: string;
  /** Agent-written summary (up to 500 chars) */
  summary: string | null;
  /** Duration string */
  duration: string;

  // ── Key Facts (survive compaction) ──
  /** Files the agent read during the session */
  filesRead: string[];
  /** Files the agent wrote/modified during the session */
  filesWritten: string[];
  /** Significant exec commands and their outcomes */
  execCommands: Array<{ command: string; failed: boolean }>;

  // ── Structured Finish Data ──
  /** Deliverables produced */
  deliverables: Array<{ path: string; description: string }>;
  /** Items marked as completed */
  completedItems: string[];
  /** New tasks identified */
  newItems: string[];
  /** Next steps (critical for continuity) */
  nextSteps: string | null;
  /** Blockers encountered */
  blockers: Array<{ reason: string; context: string }>;

  // ── Quality Signal ──
  /** Evaluator verdict if available */
  evalVerdict?: string;
  /** Instability metrics */
  instability?: { retries: number; toolErrors: number; turns: number; verdict: string };
}
```

### 3.2 Why richer than MemoryEntry?

The existing `MemoryEntry` has 6 fields. The `DigestEntry` has ~15. The extra cost is:
- **Storage**: ~2-4KB per session in JSONL (vs ~200B for MemoryEntry). With 20 sessions/day, that's ~80KB/day — negligible.
- **Injection budget**: The compiler selects and summarizes, so the injected text is bounded regardless of how many entries exist.

The benefit is that the compiler has *rich raw material* to work with. A 500-char summary alone can never tell you "the agent tried approach X, it failed because of Y, then pivoted to Z which worked." But with filesWritten + execCommands + nextSteps + blockers, the compiler can reconstruct that narrative.

---

## 4. Lesson Persistence

### 4.1 LessonEntry interface

```typescript
export interface LessonEntry {
  timestamp: number;
  sessionId: string;
  agent: string;
  category: "fix" | "pattern" | "insight";
  content: string;
  /** How many sessions ago this was learned. Updated by the compiler. */
  age: number;
  /** How many times this lesson was injected. Tracks relevance decay. */
  injections: number;
  /** Whether this lesson has been verified by a subsequent session. */
  verified: boolean;
}
```

### 4.2 Deduplication

Lessons accumulate fast. The writer should deduplicate before appending:
- Exact match: skip
- Semantic near-match (>60% word overlap with existing lesson): update the existing entry's timestamp instead of adding a new one

### 4.3 Pruning

On each session start (or periodically), prune lessons:
- Remove lessons older than 7 days that haven't been verified
- Cap total lessons at 50 per agent (oldest unverified drop first)
- "Verified" lessons survive indefinitely until manually removed

---

## 5. Digest Compiler (Session-Start Briefing)

### 5.1 When it runs

During `buildSessionContext()` in `manager.ts`, after the existing memory injection. The compiler reads recent digest entries and lessons, then produces a `## Session Briefing` section.

### 5.2 Budget

The briefing gets a **fixed token budget** of ~1500 tokens (~6000 chars). This is separate from the `## Recent Task History` budget (which remains unchanged for backward compatibility).

The budget is allocated as:
- **Continuity block** (~40%): where you left off, what to pick up
- **Lessons block** (~30%): relevant lessons from recent sessions
- **Cross-agent block** (~20%): what other agents did that's relevant
- **Codebase state** (~10%): recently modified files and their status

### 5.3 Compilation Algorithm

```
function compileDigest(agentName, persistDir, projectRoot):
  // 1. Read recent digest entries for this agent
  entries = readDigestEntries(persistDir, agentName, limit=10)

  // 2. Read lessons for this agent
  lessons = readLessons(persistDir, agentName, limit=30)

  // 3. Read recent digest entries from OTHER agents (cross-agent awareness)
  crossEntries = readCrossAgentDigests(persistDir, agentName, limit=5)

  // 4. Build Continuity Block
  //    Focus on the LAST session's nextSteps + blockers
  //    Include last 3 sessions' outcomes for trajectory awareness
  continuity = buildContinuityBlock(entries)

  // 5. Build Lessons Block
  //    Select lessons that are relevant to the current task context
  //    Prioritize: verified > recent > frequently injected
  lessonsBlock = buildLessonsBlock(lessons, entries)

  // 6. Build Cross-Agent Block
  //    Filter to entries that touch files this agent also works on
  //    Or entries with explicit cross-references
  crossBlock = buildCrossAgentBlock(crossEntries, agentName)

  // 7. Build Codebase State
  //    Aggregate recently modified files from last N sessions
  //    Highlight conflicting modifications (same file by different agents)
  stateBlock = buildStateBlock(entries, crossEntries)

  // 8. Assemble within budget
  return assembleBriefing(continuity, lessonsBlock, crossBlock, stateBlock)
```

### 5.4 Example Output

```markdown
## Session Briefing

### Where You Left Off
Your last session (s_12345, 2h ago) was working on refactoring the compaction 
pipeline. Status: partial. You completed the `trimAccumulatedSummary` function 
but still need to handle the edge case where summary sections contain markdown 
headers. Next steps: "Add header-escaping to trimAccumulatedSummary, then write 
tests for the 3-pass compaction loop."

Recent trajectory: success → success → partial (current)

### Lessons
- [fix] manager.ts uses lazy DB init — must call getDb() not import db directly
- [pattern] When modifying persistence.ts, always run the JSONL round-trip test 
  (test/persistence.test.ts) — it catches serialization regressions
- [insight] The compaction token estimator underestimates by ~15% for JSON-heavy 
  content; use 2.5 chars/token instead of 3

### Team Activity
- tech-lead modified src/lib/evaluator.ts 1h ago (added retry logic to eval calls)
- optimizer identified a turn-limit waste pattern in workflow sessions

### Recently Modified Files
src/lib/compaction.ts (you, 2h ago), src/lib/evaluator.ts (tech-lead, 1h ago)
```

---

## 6. Implementation Plan

### Phase 1: Digest Writer (low risk, high value)

**Files to modify:**
- `src/lib/persistence.ts` — add `DigestEntry` interface, `appendDigestEntry()`, `readDigestEntries()`
- `src/lib/session-subscribers.ts` — add `createDigestWriter()` subscriber
- `src/lib/types.ts` — add `DigestEntry` to exports if needed
- `src/lib/manager.ts` — register the new subscriber in `registerSubscribers()`

**Data source mapping:**
| DigestEntry field | Source |
|---|---|
| timestamp, sessionId, agent | Event metadata |
| task, status, duration, summary | `session_end` event (same as MemoryWriter) |
| filesRead, filesWritten, execCommands | `session_end.filesModified` + parse from messages |
| deliverables, completedItems, newItems, nextSteps, blockers | `event.finishParams` |
| evalVerdict | Evaluator result (if piped through event) |
| instability | `event.instability` (from TaskResult) |

**Key challenge:** The session-end event currently doesn't carry `filesRead` or `execCommands` — only `filesModified`. We need to either:
- (a) Enrich the event with key facts extracted from the message log, or
- (b) Have the digest writer read the session JSONL directly

Option (a) is cleaner. We'd extract key facts in `handleCompletion()` before emitting the event, and pass them through. This means reading the full message array once at completion time (which is already available in `ActiveSession.agent.messages`).

### Phase 2: Lessons Writer (low risk, moderate value)

**Files to modify:**
- `src/lib/persistence.ts` — add `LessonEntry` interface, `appendLesson()`, `readLessons()`
- `src/lib/session-subscribers.ts` — add `createLessonsWriter()` subscriber

**Data source:** `finishParams.lessons` from the `session_end` event. The `finish()` tool already collects lessons — we just need to persist them to a dedicated store instead of only including them in the flat memory entry.

### Phase 3: Digest Compiler (moderate complexity, high value)

**Files to modify:**
- New file: `src/lib/digest-compiler.ts` — pure function, no side effects
- `src/lib/manager.ts` — call compiler in `buildSessionContext()`, inject result

**The compiler is a pure function:** `(digestEntries, lessons, crossEntries) → string`. No LLM calls, no I/O beyond reading JSONL files. This makes it easy to test and fast to execute.

### Phase 4: Cross-Agent Awareness (moderate complexity, moderate value)

**Files to modify:**
- `src/lib/digest-compiler.ts` — add cross-agent reading logic
- `src/lib/persistence.ts` — add `readAllAgentDigests()` that scans `memory/*/digest.jsonl`

**Design decision:** Digest files live at `<persistDir>/memory/<agentName>-digest.jsonl` (alongside the existing `<agentName>.jsonl` memory files). Cross-agent reads just scan all `*-digest.jsonl` files.

### Phase 5: Lesson Verification Loop (future)

When an agent encounters a situation that a stored lesson warned about, and the outcome is good, mark the lesson as verified. This requires the compiler to track which lessons were injected, and the finish handler to report which lessons proved useful. Deferred — the manual `verified` flag from the agent's own `finish()` is sufficient for now.

---

## 7. File Layout

```
.state/
  memory/
    bob.jsonl                  # existing: flat memory entries
    bob-digest.jsonl           # NEW: rich digest entries
    bob-lessons.jsonl          # NEW: lesson entries
    tech-lead.jsonl            # existing
    tech-lead-digest.jsonl     # NEW
    tech-lead-lessons.jsonl    # NEW
    ...
```

---

## 8. Backward Compatibility

- **MemoryEntry and `## Recent Task History` are unchanged.** The digest is additive — it doesn't replace the existing memory system.
- **Existing sessions** that predate the digest writer will simply have no digest entries. The compiler gracefully handles empty/missing files.
- **`finish()` schema is unchanged.** The `lessons` field already exists in the tool definition. We're just persisting it to a dedicated store.

---

## 9. Token Budget Analysis

Current session context injection:
- Session ID + time: ~30 tokens
- Recent Task History (20 entries): ~600-1000 tokens
- Active Recall warnings: ~100-300 tokens (when triggered)
- Last Checkpoint: ~100-200 tokens (when present)

Adding Session Briefing: ~1500 tokens

**Total increase:** ~1500 tokens, or about 0.75% of a 200K context window. Well within budget. For a 100K window, it's 1.5% — still fine.

If needed, the briefing budget can be dynamically adjusted based on the context window size of the model being used.

---

## 10. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Digest entries grow unbounded | Prune entries older than 7 days; cap at 100 per agent |
| Cross-agent reads are slow with many agents | Read only the last 5 entries per agent; cache reads within a session start |
| Lessons injection causes hallucination anchoring | Keep lessons terse; verify flag tracks empirical confirmation |
| Briefing contradicts actual file state | Always mark files as "last known state" with timestamps; include caveat that re-reading is needed |
| Extra subscriber slows session completion | Digest writer is append-only JSONL — sub-millisecond |

---

## 11. Alternatives Considered

### A. LLM-generated digest
Use the LLM to synthesize a narrative summary at session end. **Rejected:** Adds latency (5-15s), cost (~$0.01/session), and unpredictability. The structural compiler is deterministic, instant, and free.

### B. Extend MemoryEntry instead of adding DigestEntry
Just add more fields to the existing MemoryEntry. **Rejected:** MemoryEntry is already used in `## Recent Task History` with a compact one-line-per-entry format. Making it richer would break the formatting or require a format migration. A separate store keeps concerns clean.

### C. Store digests in the session archive directory
Put digest data in `.state/sessions/history/<sid>/digest.json`. **Rejected:** Reading recent digests would require scanning all session directories (slow, unindexed). JSONL with tail-read is O(1) for "last N entries."

### D. Use the LLM for lesson relevance scoring
Score each lesson against the current task to select the most relevant ones. **Rejected for now:** Adds latency to session start. Simple heuristics (recency, verification status, category) are sufficient. Can revisit if lessons become noisy.

---

## 12. Success Metrics

1. **Reduced re-reading**: Agents with digest briefings should read fewer files that were already read in recent sessions (measurable from key facts).
2. **Fewer repeated mistakes**: Lessons that recur in the same agent's sessions indicate the lesson system isn't working. Track lesson collision rate.
3. **Faster task pickup**: Time from session start to first meaningful tool call should decrease (agent doesn't spend turns orienting).
4. **No regression in compaction behavior**: The additional ~1500 tokens of briefing should not cause premature compaction. Monitor compaction trigger frequency.

---

## 13. Recovery Unification

### 13.1 The Insight

Today the system has **6 separate recovery mechanisms**, each with its own state tracking, thresholds, and action logic. They evolved independently to handle different failure modes, but they all fundamentally do the same thing: **observe session state → classify the situation → take a corrective action**. With structured journal/digest entries, all six can be unified into a single system: read the digest, classify, act.

### 13.2 Current Mechanisms — Code Locations & Logic

| # | Mechanism | Location | What It Reads | What It Does |
|---|-----------|----------|---------------|--------------|
| 1 | **AutoResume** | `session-subscribers.ts:314-360` | `session_end` event: status=interrupted, opCount>0, error!="Closed" | Retries with backoff (10s, 20s). After 2 failures → escalates. Tracks attempts in a local `Map<sessionId, count>`. |
| 2 | **Circuit Breaker** | `cron.ts:461-502` | Consecutive agent errors counted via `recordAgentError()`/`recordAgentSuccess()` | After `CB_TRIP_THRESHOLD` consecutive errors → skips cron fires for that agent. Probes after `CB_PROBE_INTERVAL_MS`. State is a local `Map<agentName, {count, lastErrorAt}>`. |
| 3 | **Escalation** | `manager.ts:738-775` | `finishParams.status === "blocked" \|\| "failure"`, `finishParams.blockers`, `finishParams.summary` | Sends tracked request to parent agent or May. Persists via `trackRequest()`. |
| 4 | **P62 Recovery** | `may.ts:283-395` | `session_end` event: status=error, `classifyError(error)==="infra"` | Re-runs the same task as a new session. After `MAX_RECOVERY_ATTEMPTS=2` → escalates to human (Telegram + escalations.jsonl). State is a local `Map<"agent:taskHash", count>`. |
| 5 | **Watchdog/Timeout** | `manager.ts:623-637` (per-session), `manager.ts:940-1060` (stale recovery) | Per-session: `timeoutMs` config on SubagentDefinition. Stale: registry status=running + process not alive. | Per-session: `setTimeout()` → `cancel()`. Stale: resumes or interrupts orphaned sessions on restart. |
| 6 | **Stuck Detector** | `session-subscribers.ts:247-310`, `stuck-detector.ts`, `manager-receipts.ts:340-344` | Turn-level: consecutive error-only turns. Tool-level: same tool+args failing N times. | Warning at 4 consecutive error turns (injected into session). Termination at 6. Also inline pivot critique per tool call. |

### 13.3 What Each Mechanism Needs from the Journal

Every mechanism's decision can be derived from a small set of structured digest fields:

| Mechanism | Required Digest Fields |
|-----------|----------------------|
| AutoResume | `status`, `error`, `root_cause`, `ops_completed`, `resume_point`, `resume_attempted` |
| Circuit Breaker | `agent`, `status`, `root_cause`, `created_at` (query: last N sessions for agent) |
| Escalation | `status`, `summary`, `blockers`, `parent_session_id` |
| P62 Recovery | `status`, `error`, `root_cause` (infra vs logic vs abort), `task_summary`, `resume_attempted` |
| Watchdog | `created_at`, `updated_at`, `status`, `turns_completed` (detect stale = no `updated_at` change for >X minutes) |
| Stuck Detector | `turns_completed`, `progress` (consecutive error turn count), `status` |

### 13.4 Schema Additions for DigestEntry

My original `DigestEntry` interface (§3.1) is missing fields needed for recovery unification. Add:

```typescript
// ── Recovery Fields (additions to DigestEntry) ──
export interface DigestEntry {
  // ... existing fields ...

  /** Classified root cause: 'turn_limit' | 'provider_error' | 'stuck' | 'crash' | 'interrupted' | 'blocked_by_agent' | null */
  rootCause: string | null;
  /** For interrupted/failed sessions: what to resume (from checkpoint.summary or nextSteps) */
  resumePoint: string | null;
  /** How many times auto-resume has been attempted for this session */
  resumeAttempted: number;
  /** Parent session ID (denormalized for join-free recovery queries) */
  parentSessionId: string | null;
  /** Last progress update timestamp (for watchdog: detect sessions that stopped updating) */
  lastProgressAt: number | null;
  /** Consecutive error turns at session end (for stuck detection history) */
  consecutiveErrorTurns: number;
}
```

These align with optimizer's SQL schema which already has `root_cause`, `resume_point`, `resume_attempted`, and `parent_session_id` columns (see `design-session-digest-storage.md` §2a). The `lastProgressAt` and `consecutiveErrorTurns` are additions the SQL schema should mirror.

### 13.5 The Unified Flow

All 6 mechanisms collapse into a single event-driven pipeline:

```
session_end event
       │
       ▼
┌──────────────────┐
│  Write Digest    │  (DigestWriter subscriber — already designed in §6 Phase 1)
│  to DB/JSONL     │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Recovery        │  ← NEW: single subscriber replaces 4 separate ones
│  Classifier      │
└──────┬───────────┘
       │
       ├── root_cause = "infra" + resume_attempted < 2
       │   → ACTION: requeue task (replaces P62 Recovery)
       │
       ├── status = "interrupted" + ops > 0 + error ≠ "Closed" + resume_attempted < 2
       │   → ACTION: resume with backoff (replaces AutoResume)
       │
       ├── status = "blocked" or "failure" + has blockers
       │   → ACTION: escalate to parent/May (replaces Escalation)
       │
       ├── root_cause = "stuck"
       │   → ACTION: log diagnosis, increment agent error count (replaces Stuck Detector termination)
       │
       ├── consecutive failures for agent >= CB_THRESHOLD (query: last N digests)
       │   → ACTION: suppress cron fires (replaces Circuit Breaker)
       │
       └── default
           → ACTION: log and continue (no recovery needed)
```

For mid-session detection (watchdog + stuck warning), the `turn_end` event path stays:

```
turn_end event
       │
       ▼
┌──────────────────┐
│  Update Digest   │  (progress, turns_completed, lastProgressAt, consecutiveErrorTurns)
│  Progress        │
└──────┬───────────┘
       │
       ├── consecutiveErrorTurns >= WARN_THRESHOLD + not warned
       │   → ACTION: inject stuck warning (replaces stuck detector warning)
       │
       ├── consecutiveErrorTurns >= KILL_THRESHOLD
       │   → ACTION: cancel session (replaces stuck detector termination)
       │
       └── (no mid-session watchdog needed if timeout is configured per-agent)
```

### 13.6 Code That Can Be Removed

Once the unified recovery subscriber is in place, these can be deleted or simplified:

| Current Code | Lines | Replacement |
|-------------|-------|-------------|
| `createAutoResume()` in `session-subscribers.ts:314-360` | ~50 lines | Recovery Classifier (one branch) |
| `createStuckDetector()` in `session-subscribers.ts:247-310` | ~65 lines | Digest progress updater + Recovery Classifier |
| P62 recovery subscriber in `may.ts:283-395` | ~110 lines | Recovery Classifier (one branch) |
| `recoveryAttempts` Map + `recoveryKey()` in `may.ts:286-292` | ~10 lines | `resume_attempted` column in digest table |
| `agentErrors` Map + circuit breaker helpers in `cron.ts:461-502` | ~40 lines | SQL query: `SELECT count(*) FROM session_digests WHERE agent=? AND status IN ('error','failure') AND created_at > ? ORDER BY created_at DESC` |
| `isCircuitBroken()` / `recordAgentError()` / `recordAgentSuccess()` | ~45 lines | `isCircuitBroken()` becomes a DB query against digests |
| `escalateBlockedSession()` in `manager.ts:738-775` | ~40 lines | Recovery Classifier (one branch) |

**Total removable: ~360 lines** across 4 files, replaced by ~150 lines of unified classifier + digest writes.

### 13.7 What Survives (Cannot Be Removed)

| Code | Why It Stays |
|------|-------------|
| `setupTimeout()` in `manager.ts:623-637` | Per-session timeout is a safety net that must fire even if the digest system fails. Keep as defense-in-depth. |
| Stuck warning injection in `manager-receipts.ts:340-344` | Mid-session warning injection into the agent's context. The digest captures the *count*, but the injection must happen inline during tool execution — it can't be deferred. |
| `classify-error.ts` | Pure function used by the Recovery Classifier. Stays, but moves from P62-specific to shared utility (it already is). |
| `resumeStaleSessions()` in `manager.ts:940-1060` | Process-restart recovery. This runs before the bus is active, so it can't rely on event-driven digests. But it can *read* digest DB entries to decide resume vs abandon. |
| `stuck-detector.ts` pure functions | Used for offline analysis and testing. The subscriber is removed, but the pure functions stay for ad-hoc diagnostics. |

### 13.8 Key Benefit: Persistent State

The biggest improvement is that recovery state becomes **persistent and queryable** instead of in-memory Maps that die on restart:

| State | Today | With Digests |
|-------|-------|-------------|
| Auto-resume attempts | `Map<sessionId, count>` — lost on restart | `resume_attempted` column — survives restart |
| Circuit breaker counts | `Map<agentName, {count, lastErrorAt}>` — lost on restart | Query: `SELECT count(*) FROM session_digests WHERE agent=? AND status IN ('error','failure') AND created_at > ?` — survives restart |
| P62 recovery attempts | `Map<"agent:taskHash", count>` — lost on restart | `resume_attempted` column — survives restart |
| Stuck detector state | `Map<sessionId, StuckState>` — lost on restart, lost across compactions | `consecutiveErrorTurns` in digest — persists, queryable |

This means:
1. **No infinite retry loops after restart** — today, restarting the process resets all recovery counters, so a fundamentally broken task gets retried indefinitely. With digests, the attempt count persists.
2. **Historical pattern detection** — "this agent has been stuck 5 times this week on file permission errors" becomes a SQL query, not a manual transcript review.
3. **Cross-mechanism awareness** — the circuit breaker can consider *why* sessions failed (stuck vs infra vs logic), not just that they failed.

### 13.9 Alignment with Optimizer's Storage Schema

The optimizer's `session_digests` table (§2a of their doc) already includes:
- `root_cause TEXT` — matches our `rootCause` field
- `resume_point TEXT` — matches our `resumePoint` field  
- `resume_attempted INTEGER DEFAULT 0` — matches our `resumeAttempted` field
- `parent_session_id TEXT` — matches our `parentSessionId` field

**Additions needed in their schema:**
- `last_progress_at INTEGER` — for watchdog staleness detection
- `consecutive_error_turns INTEGER DEFAULT 0` — for stuck detection history

These are small additive changes. The optimizer's `classifyRootCause()` function already handles the same error patterns as `classify-error.ts`, so the two can be merged (use `classify-error.ts` as the source of truth, add the root_cause mapping on top).

---

## 14. Open Questions

1. **Should cross-agent lessons merge?** If tech-lead learns "always run `bun test` after modifying persistence.ts," should that lesson surface for Bob too? Tentatively yes, but only for `fix` and `pattern` categories — `insight` is too agent-specific.

2. **Digest retention policy**: 7 days seems right for most agents, but long-running research projects might benefit from longer retention. Make it configurable per-agent via `agent.json`.

3. **Interaction with compaction**: If the briefing is in the session context (first user message), it will be preserved through the first compaction round but may be summarized in later rounds. Should we pin it? The compaction system already preserves `[Original task]` — we could add `[Session briefing]` as another pinned section. But this increases the non-compactable floor. Recommend: **don't pin**. If the briefing is truly useful, the agent will have acted on it by the time compaction triggers. If not, it's safe to summarize.

4. **Digest writer dependency on message log**: The richest data source is the full message array (`agent.messages`). Currently, `session_end` events don't carry this. We either need to enrich the event or have the writer access the session archive. Recommend enriching the event — it's cleaner and avoids race conditions with archive writing.
