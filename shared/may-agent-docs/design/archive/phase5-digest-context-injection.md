# Phase 5: Digest-Based Context Injection for Session Briefings

**Status:** ✅ Implementation complete (2026-04-07, tech-lead)  
**Date:** 2026-04-07  
**Author:** Bob (Architect)  
**Prerequisite:** Phase 1-3 (digest table populated with session lifecycle data)  
**Implementation:** `src/lib/session-digest.ts` (upgraded getRecentDigests, new getCrossAgentDigests, getUnresolvedDigests, cleanTaskText), `src/lib/manager.ts` (wired in buildSessionContext), 19 tests passing

---

## 1. The Problem

### What agents see today

When a session starts, `buildSessionContext()` injects a `## Recent Task History` section. Currently this is fed from `memory/<agent>.jsonl` — a file appended after each session with the task text, status, duration, and summary.

Example of what Bob sees today:

```
## Recent Task History
- 2026-04-06 20:33: "[heartbeat] You are Bob. Your files are in agents/bob/. Read agents/bob/heartbeat.md and work through each se…" — done (59s) — **This heartbeat I will:** 1. Draft Active Nudging Brief…
- 2026-04-06 20:34: "[WORK SESSION] Process EXP-041 ablation results — update knowledge base and hypotheses…" — in_progress — Read all source files: EXP-041…
```

### What's wrong with this

1. **Wasted tokens on task text.** The `task` field starts with the full heartbeat injection (3-4KB per entry). Even truncated to 200 chars, every heartbeat entry starts with the same "[heartbeat] You are Bob..." prefix. For 20 entries, this burns ~4,000 chars on text that conveys zero unique information.

2. **Summary is the agent's C40 promise list, not a result summary.** The `summary` field contains whatever the agent wrote in `finish(summary: ...)`. For Bob, this is often the C40 promise list ("**This heartbeat I will:** 1. Draft... 2. Update... 3. Consolidate..."), not what actually happened. The agent sees promises from prior sessions, not outcomes.

3. **No files-modified context.** The memory JSONL *has* a `files` field, but it's appended at the end of the line after `completed` and `newItems`. In practice it's either empty or truncated. The agent starts a new session without knowing what files were recently touched.

4. **No "what's still open" signal.** If the prior session ended `partial` or `in_progress`, the memory entry doesn't capture what remains to be done. The agent gets "in_progress (1m38s)" with no indication of what was in progress.

5. **No cross-agent visibility.** Bob has no idea what Coach just did. If Coach updated a hypothesis that Bob needs, Bob won't know until a future heartbeat happens to mention it.

### Measurement: current token budget

| Metric | Value |
|--------|-------|
| Default memoryLimit | 20 entries |
| Avg chars/entry (injected) | ~738 |
| Total for 20 entries | ~14,750 chars ≈ **~3,700 tokens** |
| Useful signal per entry | ~200 chars (status + a few words of summary) |
| Waste ratio | ~73% (repetitive task prefixes, C40 templates) |

---

## 2. What Digests Provide

The `session_digests` table (Phase 1-4) stores structured lifecycle data per session. The relevant fields for context injection:

| Field | What it contains | Why it matters for briefing |
|-------|------------------|---------------------------|
| `what_happened` | LLM-written 1-3 sentence summary of session results | The actual outcome, not the task or the promise |
| `outcome` | `success`, `partial`, `failure`, `in_progress`, `interrupted` | Quick triage — did it work? |
| `still_open` | What remains to be done | Critical for continuations and handoffs |
| `files_modified` | JSON array of file paths touched | "What just changed in the codebase?" |
| `task` | Original task text (stored once on session_start row) | Only needed if what_happened is null |
| `action` | Classifier output: resume/requeue/escalate/kill/nothing | Did infra intervene? |
| `action_reason` | Why the classifier chose this action | Context for recovery sessions |
| `trigger` | What lifecycle event produced this row | Filter out noise (session_start = no info) |
| `agent` | Which agent ran the session | Enables cross-agent context |

---

## 3. Design: What Gets Injected

### 3.1 Information hierarchy (what actually helps)

Based on KE-013 (task boundedness drives quality) and KE-034 (analysis activation), the information an agent needs at session start falls into three tiers:

**Tier 1 — Always inject (high signal, low tokens):**
- `still_open` from the agent's most recent sessions — "here's what you left unfinished"
- `outcome` + `what_happened` from the last 3-5 sessions — "here's what you just did"
- Any `action` = `escalate` or `requeue` from recent digests — "infra flagged a problem"

**Tier 2 — Inject when relevant (medium signal):**
- `files_modified` from recent sessions — "these files were recently touched"
- Cross-agent `what_happened` for sessions that modified files in shared paths — "someone else changed something you care about"

**Tier 3 — Available on demand, not auto-injected:**
- Full digest timelines (the `step`-by-step history of a session)
- Digests from agents the current agent has never interacted with
- Old digests (>24h) unless they have `still_open` items

### 3.2 Output format

```
## Recent Task History
- 2026-04-06 22:33: Process EXP-045 results — success (1m51s) — Updated H-085 with EXP-045 data, wrote KE-031, updated INDEX.md
  [files: knowledge/entries/KE-031.md, knowledge/hypotheses/H-085.md, knowledge/INDEX.md]
- 2026-04-06 23:03: Process EXP-046 results — success (2m25s) — Wrote KE-032 (dual pathway), updated INDEX with EXP-046
  [files: knowledge/entries/KE-032.md, knowledge/INDEX.md]
- 2026-04-06 23:33: Synthesize DD-560 + CR-300 — partial (2m56s) — Wrote KE-033, need to update cross-refs
  [files: knowledge/entries/KE-033.md] [open: Cross-reference KE-033 with H-085 and KE-031]
- 2026-04-07 00:04: Process EXP-047 results — success (2m32s) — Wrote KE-034 on analysis activation mechanism
  [files: knowledge/entries/KE-034.md, knowledge/INDEX.md]

### Cross-Agent Activity (last 2h)
- coach 23:30: Updated H-085 with EXP-047 data (P(H)=0.97, N=45/45)
  [files: knowledge/hypotheses/H-085.md]
- tech-lead 23:45: Deployed Phase 4c switchover (escalation → classifier)
  [files: src/lib/session-subscribers.ts, src/lib/manager.ts]
```

Key differences from current format:
- **No task text prefix** — instead, the `what_happened` field provides a meaningful description
- **Task description is derived**, not raw — for `end` triggers, use `what_happened`; for `session_start` only, fall back to a cleaned task summary
- **Structured sub-lines** for files and open items — scannable, not buried in a long line
- **Cross-agent section** when relevant — solves the "Bob doesn't know Coach just changed H-085" problem

### 3.3 Task description cleaning

The current memory entry stores the full task text (including the entire heartbeat.md injection). For heartbeats, this is 3-4KB of boilerplate. For work sessions, it's the actual task.

For digest-based injection, the `task` field is only used as a fallback (when `what_happened` is null, i.e., session_start-only entries). When used:
- Strip `[heartbeat]` prefix → replace with "Heartbeat"
- Strip everything after `---` (injected content)
- Truncate to 80 chars

For most digests (trigger = `end`), `what_happened` replaces the task entirely. This eliminates the repetitive task prefix problem.

---

## 4. Ranking and Filtering

### 4.1 Same-agent digests

**Query:** Latest N digests where `agent = current_agent` AND `trigger IN ('end', 'checkpoint')`, ordered by `created_at DESC`.

**Why `end` and `checkpoint` only:** `session_start` has no content (just metadata). Recovery triggers (`stuck_detected`, `timeout`, etc.) are interesting but noisy — they're covered by the `action` field on the next digest.

**Ranking:** Pure recency. No relevance scoring. Rationale:
- Agent sessions are already focused on a coherent domain (Bob = architecture, Coach = training)
- The most recent sessions are almost always the most relevant context
- Relevance scoring requires comparing task text embeddings, which adds latency and complexity for marginal benefit
- If the agent needs older context, it can query the DB directly

**Default limit:** 10 entries (down from 20 in memory mode). Rationale:
- Each digest entry is richer (what_happened + files + still_open)
- 10 rich entries ≈ same information as 20 shallow entries, at lower token cost
- Configurable per agent via `memoryLimit` (already in SubagentDefinition)

### 4.2 Cross-agent digests

**Query:** Latest M digests where `agent != current_agent` AND `trigger = 'end'` AND `files_modified` overlaps with files the current agent recently touched, within last 2 hours.

**Implementation:** 
1. Collect `files_modified` from the current agent's last 10 digests → `recentFiles` set
2. Query all other agents' digests from last 2h with trigger='end'
3. For each, parse `files_modified` JSON → check if any file is in `recentFiles`
4. Include up to 3 matching cross-agent digests

**Why file overlap, not task similarity:** File overlap is concrete and fast (string matching). Task similarity requires embeddings or keyword matching, which is both slow and unreliable ("updated H-085" doesn't match "process EXP-047 results" even though they're closely related). But if both sessions touch `H-085.md`, the overlap is trivially detectable.

**Why limited to 2h:** Cross-agent context is about "what just happened." Anything older than 2h is either already reflected in files the agent will read, or is stale context that wastes tokens.

**Why max 3 entries:** Cross-agent context is supplementary. The agent's own history is primary. 3 entries provide awareness without dominating the briefing.

### 4.3 Priority boosting for open items

Digests with `still_open IS NOT NULL` should be surfaced regardless of recency (within a 24h window). If session #3 (from 6 hours ago) left something open that was never resolved, it should appear even if 10 more sessions happened since.

**Implementation:** After the main recency query, run a secondary query:
```sql
SELECT * FROM session_digests 
WHERE agent = ? AND still_open IS NOT NULL 
  AND outcome IN ('partial', 'in_progress', 'interrupted')
  AND created_at > ? -- 24h ago
  AND sessionId NOT IN (SELECT sessionId FROM session_digests WHERE outcome = 'success' AND created_at > ?)
ORDER BY created_at DESC LIMIT 3
```

This finds "sessions that ended with open items and were never followed by a success in the same session." These get injected under a `### Unresolved Items` sub-header.

---

## 5. Token Budget

### Target: ≤2,000 tokens for the full briefing

| Section | Entries | Est. chars/entry | Total chars | Est. tokens |
|---------|---------|-----------------|-------------|-------------|
| Same-agent recent | 10 | 200 | 2,000 | 500 |
| Files sub-lines | 10 | 80 | 800 | 200 |
| Open items sub-lines | ~3 | 100 | 300 | 75 |
| Unresolved items | 0-3 | 200 | 0-600 | 0-150 |
| Cross-agent | 0-3 | 150 | 0-450 | 0-112 |
| Headers + formatting | — | — | 200 | 50 |
| **Total** | — | — | **3,300-4,350** | **825-1,087** |

**Comparison:** Current memory-based injection = ~3,700 tokens. Digest-based = ~1,000 tokens. **~70% reduction with richer information.**

The savings come from:
1. Eliminating the repetitive task prefix (biggest win — ~200 chars/entry → 0)
2. Using `what_happened` instead of raw task + summary (more concise, more informative)
3. Reducing default entry count from 20 to 10 (compensated by richer content)

### Overflow protection

If the formatted output exceeds 2,500 tokens (measured by char count / 4):
1. Drop cross-agent section entirely
2. Reduce same-agent entries to 5
3. Truncate `what_happened` to 100 chars

This guarantees the briefing never exceeds ~2,500 tokens regardless of data volume.

---

## 6. Edge Cases

### Zero digests (cold start / pre-Phase-1 agent)

**Behavior:** Fall through to memory JSONL (already implemented in `buildSessionContext`).

The current code already handles this:
```typescript
if (historyBlock) {
  ctxLines.push(``, `## Recent Task History`);
  ctxLines.push(historyBlock);
} else {
  // Fallback: memory JSONL (pre-digest data)
  const entries = readMemoryEntries(persistDir, agentName, memoryLimit);
  ...
}
```

No change needed. The fallback path stays until all agents have digest history.

### Agent has no recent sessions (new agent / rarely scheduled)

**Behavior:** The `getRecentDigests` query returns empty. The cross-agent query may still return results (showing what other agents did recently). If both are empty, `formatDigestContext` returns `null`, and the fallback fires.

**Design choice:** A new agent with zero history should see cross-agent activity if available. This provides situational awareness even without personal history.

### Session ended with `in_progress` (no `end` digest)

If the previous session crashed or was interrupted, the latest digest may be a `checkpoint` with `outcome = 'in_progress'`. This is explicitly surfaced:

```
- 2026-04-06 23:33: Synthesize DD-560 — in_progress (2m56s) — Wrote KE-033, was working on cross-refs when session ended
  [open: Cross-reference KE-033 with H-085 and KE-031]
```

The `still_open` field from checkpoint digests is the most valuable context for recovery sessions.

### Digest LLM call failed (what_happened is null)

If the LLM synthesis failed for a digest row, `what_happened` will be null. Fallback to a cleaned version of the `task` field from the session_start row:
```typescript
const description = d.what_happened ?? cleanTaskText(d.task) ?? 'unknown task';
```

### Multiple digests per session (checkpoint + end)

A session may have several digest rows (start, checkpoint, end). For context injection, we want the **latest row per session**, not all rows. The existing query already handles this by ordering by `created_at DESC` — but we should add `GROUP BY sessionId` or use a subquery to deduplicate:

```sql
SELECT * FROM session_digests d1
WHERE agent = ? AND trigger IN ('end', 'checkpoint')
  AND step = (SELECT MAX(step) FROM session_digests d2 WHERE d2.sessionId = d1.sessionId)
ORDER BY created_at DESC LIMIT ?
```

This ensures we show the final state of each session, not intermediate checkpoints.

---

## 7. Connection to KE-011: The Passive Knowledge Problem

KE-011 established: "Knowledge files are passive — agents skip them in oneshot mode." Agents go straight to the task without reading reference materials. Knowledge that isn't in the agent's direct task path is invisible.

### Does digest injection solve this?

**Partially, but not directly.** Digest injection solves a *different* problem: "what happened recently?" It doesn't inject knowledge entries. But it creates a pathway to solve KE-011:

1. **Files-modified awareness.** If Coach wrote `KE-034.md`, and Bob's cross-agent section shows `[files: knowledge/entries/KE-034.md]`, Bob now knows KE-034 exists. This is strictly better than the status quo (Bob had no idea).

2. **Still-open items as knowledge pointers.** If a session's `still_open` says "Need to read KE-034 for analysis activation implications," the next session sees this and may actually read it.

3. **Analysis activation connection (KE-034).** The most important insight: context injection works like the "read channel" of forced externalization. The agent reads the briefing, and this *triggers analytical mode* about the recent state of the system. The content doesn't need to be a complete knowledge dump — it just needs to trigger awareness that there's relevant state to consider.

### What digest injection does NOT solve

- Agents won't read knowledge entries just because they're mentioned in `files_modified`
- The briefing provides situational awareness, not knowledge delivery
- For actual knowledge delivery, the knowledge routing system (already in `buildSessionContext` for heartbeats) remains the right mechanism

### Synergy: digest injection + knowledge routing

The best outcome is when both systems work together:
- Digest injection tells the agent "Coach just updated H-085"
- Knowledge routing says "H-085 is relevant to your current task — read it"
- Together: the agent knows H-085 was recently changed AND is pointed to read it

---

## 8. Connection to KE-013: Task Boundedness

KE-013 found that bounded-artifact tasks get 90% quality vs 40.6% for open-judgment tasks. How does digest injection relate?

**Better briefing → better task scoping.** When an agent starts a continuation session (e.g., "finish processing EXP-046"), the quality depends on knowing exactly what was done and what remains. The current memory-based briefing gives "in_progress (1m38s)" with no detail. The digest-based briefing gives:

```
- 23:03: Process EXP-046 — in_progress — Wrote KE-032 draft, still needs INDEX.md update and cross-refs
  [files: knowledge/entries/KE-032.md] [open: Update INDEX.md with EXP-046, add cross-refs to KE-031]
```

This transforms an open-judgment task ("figure out where you left off") into a bounded task ("update INDEX.md and add cross-refs"). The briefing itself improves task boundedness.

---

## 9. Implementation Plan

### What already exists (Phase 5 scaffolding)

The codebase already has the full wiring:
- `getRecentDigests(persistDir, agent, limit)` — queries the DB
- `formatDigestContext(digests)` — formats into text
- `buildSessionContext()` — tries digests first, falls back to memory

### What needs to change

**9.1 `getRecentDigests` — add deduplication and cross-agent support**

Current:
```typescript
export function getRecentDigests(persistDir: string, agent: string, limit = 5): DigestRow[] {
  const db = getDb(persistDir);
  return db.prepare(
    `SELECT * FROM session_digests WHERE agent = ? AND trigger IN ('end', 'checkpoint')
     ORDER BY created_at DESC LIMIT ?`
  ).all(agent, limit);
}
```

New: Split into two functions:
```typescript
export function getRecentDigests(persistDir: string, agent: string, limit = 10): DigestRow[] {
  const db = getDb(persistDir);
  // Latest row per session, ordered by recency
  return db.prepare(`
    SELECT d.* FROM session_digests d
    INNER JOIN (
      SELECT sessionId, MAX(step) as maxStep
      FROM session_digests 
      WHERE agent = ? AND trigger IN ('end', 'checkpoint')
      GROUP BY sessionId
    ) latest ON d.sessionId = latest.sessionId AND d.step = latest.maxStep
    ORDER BY d.created_at DESC LIMIT ?
  `).all(agent, limit);
}

export function getCrossAgentDigests(
  persistDir: string, 
  excludeAgent: string, 
  recentFiles: Set<string>,
  windowMs = 2 * 60 * 60 * 1000, // 2 hours
  limit = 3,
): DigestRow[] {
  const db = getDb(persistDir);
  const cutoff = Date.now() - windowMs;
  const candidates = db.prepare(`
    SELECT * FROM session_digests 
    WHERE agent != ? AND trigger = 'end' AND files_modified IS NOT NULL
      AND created_at > ?
    ORDER BY created_at DESC LIMIT 20
  `).all(excludeAgent, cutoff) as DigestRow[];
  
  // Filter to entries with file overlap
  return candidates
    .filter(d => {
      try {
        const files = JSON.parse(d.files_modified!) as string[];
        return files.some(f => recentFiles.has(f));
      } catch { return false; }
    })
    .slice(0, limit);
}

export function getUnresolvedDigests(
  persistDir: string,
  agent: string,
  windowMs = 24 * 60 * 60 * 1000,
  limit = 3,
): DigestRow[] {
  const db = getDb(persistDir);
  const cutoff = Date.now() - windowMs;
  return db.prepare(`
    SELECT * FROM session_digests 
    WHERE agent = ? AND still_open IS NOT NULL 
      AND outcome IN ('partial', 'in_progress', 'interrupted')
      AND created_at > ?
      AND sessionId NOT IN (
        SELECT sessionId FROM session_digests 
        WHERE outcome = 'success' AND created_at > ?
      )
    ORDER BY created_at DESC LIMIT ?
  `).all(agent, cutoff, cutoff, limit) as DigestRow[];
}
```

**9.2 `formatDigestContext` — richer format with cross-agent section**

Replace the current implementation with the format described in §3.2. Key changes:
- Use `what_happened` as primary description (not truncated task)
- Add `[files: ...]` and `[open: ...]` sub-lines
- Add `### Cross-Agent Activity` section
- Add `### Unresolved Items` section
- Add overflow protection (§5)

**9.3 `buildSessionContext` — pass file context for cross-agent queries**

The current call is `getRecentDigests(persistDir, agentName, memoryLimit)`. Update to:
1. Get same-agent digests
2. Extract `recentFiles` set from their `files_modified` fields
3. Get cross-agent digests using `recentFiles`
4. Get unresolved digests
5. Pass all three to `formatDigestContext`

**9.4 Task text cleaning for fallback**

Add `cleanTaskText(task: string): string` utility:
```typescript
function cleanTaskText(task: string | null): string | null {
  if (!task) return null;
  let cleaned = task;
  // Strip heartbeat prefix
  if (cleaned.startsWith('[heartbeat]')) {
    cleaned = 'Heartbeat';
  } else if (cleaned.startsWith('[WORK SESSION]')) {
    cleaned = cleaned.replace('[WORK SESSION] ', '');
  }
  // Strip injected content after ---
  const dashIdx = cleaned.indexOf('\n---');
  if (dashIdx > 0) cleaned = cleaned.slice(0, dashIdx);
  return cleaned.slice(0, 80) || null;
}
```

### What does NOT change

- Memory JSONL continues to be written (backward compatibility)
- `writeMemoryEntry` stays as-is (no migration needed)
- Checkpoint injection stays as-is (separate section in context)
- Knowledge routing stays as-is (separate section in context)
- Active Recall stays as-is (separate section in context)

---

## 10. Testing Strategy

### Unit tests (session-digest.test.ts additions)

1. `getRecentDigests` returns latest row per session (no duplicate sessions)
2. `getCrossAgentDigests` filters by file overlap correctly
3. `getCrossAgentDigests` respects time window (no old results)
4. `getUnresolvedDigests` excludes sessions that later succeeded
5. `formatDigestContext` produces expected output format
6. `formatDigestContext` applies overflow protection at threshold
7. `cleanTaskText` strips heartbeat boilerplate
8. `formatDigestContext` returns null for empty input

### Integration test

Seed digest table with 20 entries (mixed agents, triggers, outcomes), verify `buildSessionContext` produces a well-formatted briefing with all three sections.

### Observability

Add a `[digest-context]` log line on every session start showing:
- How many same-agent digests injected
- How many cross-agent digests injected  
- How many unresolved items surfaced
- Whether fallback to memory was used
- Total chars of the injected block

---

## 11. Migration Path

### Phase 5a: Populate digests (prerequisite)

Before digest context injection provides value, the `session_digests` table needs data. This requires Phase 1-3 to be actively writing digest rows. Currently the table has 0 rows.

**Check:** `SELECT COUNT(*) FROM session_digests WHERE trigger = 'end'` should be > 0 before enabling Phase 5.

### Phase 5b: Shadow mode

Run both memory and digest injection in parallel. Log both outputs. Compare token counts and information richness. Duration: 24-48h.

### Phase 5c: Switchover

Set digest as primary (already the code path in `buildSessionContext`). Memory becomes the fallback only. No config change needed — the code already prefers digests.

### Phase 5d: Deprecate memory fallback ✅

After all agents have 20+ digest entries, the memory fallback path is dead code. Remove `readMemoryEntries` from `buildSessionContext`. Keep `writeMemoryEntry` for backward compatibility with any consumers.

**Completed:** 2026-04-07. Removed fallback `else` branch, cleaned up unused imports (`readMemoryEntries`, `formatMemoryTimestamp`, `MEMORY_TASK_MAX`, `MEMORY_SUMMARY_MAX`). Branch: `review/phase5d-deprecate-memory`.

---

## 12. Answers to Design Questions

### Q1: What information from digests actually helps an agent starting a new session?

**`still_open` is the single most valuable field.** It tells the agent exactly what was left unfinished. `what_happened` is second — it provides situational awareness. `files_modified` is third — it grounds the agent in what changed on disk. `outcome` is a quick triage signal. Everything else is nice-to-have.

### Q2: How to rank/filter digests?

**Recency for same-agent, file-overlap for cross-agent.** No relevance scoring (adds complexity for marginal benefit). Priority boost for unresolved items regardless of recency (within 24h).

### Q3: Token budget?

**~1,000 tokens typical, ≤2,500 worst case.** Down from ~3,700 in the current system. The savings come from eliminating repetitive task prefixes and using richer, more concise digest summaries.

### Q4: Cross-agent context?

**Yes, limited to 3 entries within 2h, filtered by file overlap.** This solves the "Bob doesn't know Coach updated H-085" problem without flooding the briefing with irrelevant cross-agent noise.

### Q5: Edge cases?

**Graceful degradation at every level.** Zero digests → memory fallback (already implemented). No recent sessions → cross-agent only. Digest LLM failed → cleaned task text. Multiple digests per session → latest only.

### Q6: Connection to KE-011?

**Digest injection doesn't directly solve the passive knowledge problem, but creates a pathway.** Cross-agent `files_modified` awareness + synergy with knowledge routing = agents are more likely to know about and read relevant knowledge entries. The briefing acts as "analysis activation" (KE-034) — it triggers situational awareness that prompts the agent to investigate, even if it doesn't provide the knowledge itself.

---

## 13. What We Explicitly Rejected

| Idea | Why rejected |
|---|---|
| **Relevance scoring (embeddings)** | Adds latency + complexity. Recency is 90% as good for same-agent context. Cross-agent uses file overlap (simpler, faster, more precise). |
| **Injecting full digest timelines** | Too many tokens. Multi-step session histories are for debugging, not briefing. The latest row per session is sufficient. |
| **Separate "briefing" LLM call** | An LLM call to synthesize the briefing from digests. Rejected: adds ~$0.003/session, the raw digest data is already concise enough. Maybe revisit if token budget becomes a problem. |
| **Knowledge entry injection in digests** | Mixing knowledge delivery with session history. These are separate concerns with separate mechanisms (knowledge routing already exists). |
| **Agent-type filtering** | "Bob should see tech-lead but not evaluator." Over-engineered. File overlap naturally filters to relevant agents. |
| **Removing memory JSONL** | Premature. Memory is the fallback until digests are fully populated. Can be removed in Phase 5d. |

---

*Phase 5 Design | Bob (Architect) | 2026-04-07*
