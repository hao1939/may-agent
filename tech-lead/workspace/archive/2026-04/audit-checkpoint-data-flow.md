# Lens B: Checkpoint/Progress Data Flow Complexity

**Date**: 2026-04-13
**Scope**: `src/lib/tools/checkpoint.ts`, `src/lib/session-digest.ts`, `src/lib/manager.ts` (buildSessionContext)
**Question**: Is the checkpoint → storage → session-context-injection path clean, or is there unnecessary indirection, duplication, or fragility?

---

## End-to-End Data Flow

### 1. WRITE PATH (agent calls `checkpoint()`)

```
Agent calls checkpoint(summary, data)
  ↓
checkpoint.ts → createCheckpointTool.execute()
  ├─ (a) Append JSONL line → .state/checkpoints/<sessionId>.jsonl
  ├─ (b) Overwrite latest pointer → .state/checkpoints/latest/<agentName>.json
  └─ (c) Call createCheckpointDigest() → INSERT row into session_digests SQLite table
```

**Three separate writes** for a single checkpoint:
- **(a)** Append-only per-session log (JSONL file) — provides full history for a session
- **(b)** Per-agent "latest" pointer (JSON file) — provides O(1) lookup for session injection
- **(c)** Digest row (SQLite) — provides cross-session history, cross-agent awareness, unresolved tracking

### 2. READ PATH (next session starts)

```
manager.ts → buildSessionContext()
  ├─ getRecentDigests(agent, 10) → SQL: last 10 sessions' final digest/checkpoint entries
  │   ├─ Extract recentFiles from those digests
  │   └─ getCrossAgentDigests(agent, recentFiles) → SQL: other agents touching same files
  │   └─ getUnresolvedDigests(agent) → SQL: sessions with still_open, no success follow-up
  │   └─ formatDigestContext() → text block → "## Recent Task History"
  │
  └─ readLatestCheckpointForAgent(agent) → read .state/checkpoints/latest/<agent>.json
      └─ Format into "## Last Checkpoint" section with age, summary, data, step#
```

---

## Findings

### F1: Dual-path injection is clean (no action needed)

The two injection paths serve distinct purposes:
- **Digest history** (SQL-backed): Shows the agent what it's been doing across sessions. Digest entries from checkpoints AND end-of-session are mixed into a unified timeline.
- **Latest checkpoint** (file-backed): Shows the agent its most recent mid-session state for resumption. Includes structured `data` (files_modified, decisions, next_steps).

This is **not redundant**. The digest is a summary timeline; the checkpoint is a state snapshot. An agent that crashed mid-session gets both:
1. "Here's your history" (digest context)
2. "Here's exactly where you left off" (checkpoint context)

### F2: Three-write atomicity gap (low severity, acknowledged)

The three writes (JSONL, latest pointer, digest SQL) are not atomic. If the process crashes between writes:
- (a) succeeds, (b)(c) fail → JSONL has entry but it's invisible to injection
- (a)(b) succeed, (c) fails → Checkpoint injected but absent from digest history

**Mitigation already present**: `createCheckpointDigest` is wrapped in try/catch with `/* best-effort */` comment. The system tolerates partial writes because:
- The JSONL log is never read at injection time (only by `readCheckpoints()` which nobody calls in prod)
- The latest pointer is the primary injection mechanism
- The digest is supplementary context

**Recommendation**: Consider whether the JSONL log (path a) is pulling its weight. See F3.

### F3: JSONL per-session log is dead weight (medium, actionable)

The append-only JSONL files in `.state/checkpoints/<sessionId>.jsonl` are **never read in production**:

| Read function | Where called | Status |
|---|---|---|
| `readCheckpoints(persistDir, sessionId)` | Exported, never imported | Dead code |
| `readLatestCheckpoint(persistDir, sessionId)` | Exported, never imported | Dead code |
| `readLatestCheckpointForAgent(persistDir, agentName)` | manager.ts:589 | ✅ Active — reads from `latest/` dir, NOT from JSONL |

There are **1,104 JSONL files** consuming **4.5MB**. They accumulate indefinitely. The `readCheckpoints()` and `readLatestCheckpoint()` functions that would read them are exported but unused.

**Recommendation**: 
- Remove JSONL append (path a) — save I/O per checkpoint call
- Remove `readCheckpoints()` and `readLatestCheckpoint()` — dead code
- The `latest/<agent>.json` pointer file handles session-injection
- The SQLite digest handles history tracking
- If per-session history is ever needed, reconstruct from digest table

### F4: Latest pointer is per-agent, not per-session (by design, but surprising)

The `latest/<agentName>.json` pointer is overwritten by ANY session for that agent. If two sessions for the same agent overlap (rare but possible), the last writer wins. This means:

- Session A (long-running) checkpoints at T=1
- Session B (quick heartbeat) checkpoints at T=2
- Latest pointer now shows B's checkpoint, A's is lost from injection

This is acceptable because overlapping sessions for the same agent are rare, and the digest system independently tracks all sessions. But worth documenting.

### F5: stepCounters in-memory map leaks across sessions (minor)

`checkpoint.ts` has `const stepCounters = new Map<string, number>()` at module level. The `cleanupStepCounter()` function exists but is only called when the session ends normally. If a session crashes, the counter persists until process restart.

The impact is just wrong step numbers (cosmetic), but the cleanup pattern is fragile — the cleanup is called from manager.ts, coupling the tool to its orchestrator's lifecycle.

### F6: Data duplication between checkpoint entry and digest row

When a checkpoint is saved, the same data exists in three places:
1. JSONL file: full CheckpointEntry (sessionId, agentName, step, summary, data, timestamp)
2. latest pointer: full CheckpointEntry (same)
3. SQLite digest: partial (summary → what_happened, data.next_steps → still_open, data.files_modified → files_modified, full data → details)

The JSONL and latest pointer store identical schemas. The digest extracts selected fields. This is appropriate layering (raw vs. indexed) — but the JSONL layer adds nothing since the latest pointer also stores the full entry and the digest stores indexed fields.

### F7: scout checkpoint bloat in latest pointer

The scout agent's latest checkpoint is **1,904 bytes** — it includes a full array of paper references with titles, IDs, and relevance descriptions. This gets injected into EVERY scout session start. While not a performance issue, it shows that agents can accidentally stuff large data into checkpoints that then persist in context injection indefinitely.

**No immediate action needed**, but consider adding a size cap or warning if checkpoint data exceeds a threshold (e.g., 1KB).

---

## Summary

| Finding | Severity | Action |
|---|---|---|
| F1: Dual-path injection is clean | — | None |
| F2: Three-write atomicity gap | Low | Documented, acceptable |
| F3: JSONL per-session log is dead weight | **Medium** | Remove JSONL writes + dead read functions |
| F4: Latest pointer per-agent not per-session | Low | Document only |
| F5: stepCounters in-memory leak | Minor | Accept (cosmetic impact) |
| F6: Triple storage duplication | Low | Addressed by F3 |
| F7: Scout checkpoint bloat | Low | Consider size cap later |

**Primary recommendation**: Remove the JSONL write path and its unused read functions. This eliminates 1 of 3 writes per checkpoint, removes dead code, and stops accumulating files that nothing reads. Net savings: ~50 lines of code, 1 I/O per checkpoint, stops 4.5MB+ of useless file accumulation.

**Overall assessment**: The checkpoint data flow is **reasonably clean**. The dual injection (digest + checkpoint) serves distinct purposes and isn't redundant. The main dead weight is the JSONL per-session log — a vestige from before the latest-pointer and digest systems were added.
