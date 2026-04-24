# Lens D: session-digest.ts Fragility Audit (893 LOC)

**Date**: 2026-04-16  
**Target**: `src/lib/session-digest.ts` (893 lines)  
**Scope**: Silent failure modes, unguarded crash paths, blast radius of common errors  
**Prior work**: `archive/2026-04/audit-digest-error-handling.md` covered error handling in detail. This audit focuses on fragility *within* the file itself — code-level paths where data silently degrades.

---

## Severity Table

| # | Finding | Severity | Line(s) | Blast Radius |
|---|---------|----------|---------|--------------|
| 1 | `formatDigestEntry` JSON.parse of `details` field unguarded | **P1** | 237 | All context history vanishes for agent |
| 2 | `readTranscriptDelta` heuristic delivers wrong slice | **P2** | 455-459 | LLM digests based on wrong transcript segment |
| 3 | `upsertDigest` step counter race (read-then-increment, no transaction) | **P2** | 714-715 | UNIQUE violation → second digest silently lost |
| 4 | `llmSynthesize` has no timeout — hangs if evaluator orphaned | **P2** | 539-542 | Pending Promise leaks memory; digest row never written |
| 5 | `formatDigestContext` overflow trim drops unresolved items silently | **P2** | 209-217 | Agent loses visibility into open work when context is large |

---

## Finding 1 (P1): Unguarded `JSON.parse(d.details)` in `formatDigestEntry` crashes context injection

**Location**: `src/lib/session-digest.ts:237`

```typescript
const details: Record<string, unknown> = d.details ? JSON.parse(d.details) : {};
```

This `JSON.parse` has NO try-catch. If any digest row has a malformed `details` field (truncated JSON, encoding error, manual DB edit), this throws. The caller `formatDigestContext` also has no try-catch around its loop at lines 182-185. The exception propagates up to `manager.ts:550-573` where the entire history block construction is wrapped in a bare `catch {}` — result: `historyBlock = null`.

**Blast radius**: A single corrupted `details` field in ANY of the last 10 digest rows kills ALL context history for the agent's next session. The agent starts with zero recent history — no task history, no unresolved items, no cross-agent activity.

**Contrast**: The `files_modified` JSON.parse at lines 131, 259, 292 IS wrapped in try-catch with `/* skip */` fallbacks. The `details` parse at line 237 was missed.

**Evidence**: Lines 131 (guarded) vs 237 (unguarded) — same pattern, inconsistent protection.

---

## Finding 2 (P2): `readTranscriptDelta` heuristic delivers unreliable transcript slices

**Location**: `src/lib/session-digest.ts:455-459`

```typescript
const estimatedStartIdx = Math.floor((messages.length * (lastDigestStep - 1)) / (lastDigestStep + 1));
const startIdx = Math.max(0, Math.min(estimatedStartIdx, messages.length - 1));
```

This heuristic estimates which messages to include by dividing total messages by step count. The assumption is messages are evenly distributed across steps — which is wrong for sessions with a short checkpoint followed by a long work phase. A session with 100 messages across 3 steps (step 1: 5 msgs, step 2: 5 msgs, step 3: 90 msgs) would compute `estimatedStartIdx = Math.floor(100 * 2 / 4) = 50`, skipping the first 50 messages of step 3's actual work.

**Blast radius**: The LLM synthesizer receives a truncated or wrong portion of the transcript. Since the transcript is sliced to 8000 chars in `llmSynthesize` (line 535), a bad starting point means the LLM sees the tail end of work without critical context. The `what_happened` and `outcome` fields may be inaccurate — feeding wrong data to the classifier.

**Mitigation**: The `full: boolean` flag is returned but never checked by the caller (`upsertDigest` at line 730). It could be used to add a warning or fall back to full transcript for short sessions.

---

## Finding 3 (P2): Step counter race condition — concurrent digests silently lost

**Location**: `src/lib/session-digest.ts:714-715`

```typescript
const last = getLastDigest(persistDir, input.sessionId);
const step = (last?.step ?? 0) + 1;
```

This is a read-then-increment without a transaction. When two concurrent `upsertDigest()` calls fire for the same session (e.g., `timeout` + `overflow` arriving within milliseconds in `manager.ts:679` and `manager.ts:759`), both read the same `last` step value and both try to insert with the same step number.

**Blast radius**: If `session_digests` has a UNIQUE constraint on `(sessionId, step)`, the second insert throws a UNIQUE violation caught by the outer try-catch — the second digest (with its classification/action) is silently lost and `null` is returned. Downstream recovery decisions that depend on `getLastDigest()` may see stale data. If there's no UNIQUE constraint, duplicate step numbers accumulate and `getLastDigest()` (ORDER BY step DESC LIMIT 1) returns whichever row was inserted last — potentially the wrong one.

**Real trigger path**: `manager.ts:679` fires `upsertDigest("timeout")` and immediately calls `this.cancel(session.sessionId)` on line 688. The cancel path in `handleCompletionInner` may fire `upsertDigest("overflow")` at line 759 if the session has an overflow error. Both are fire-and-forget Promises racing.

---

## Finding 4 (P2): `llmSynthesize` has no timeout — evaluator hang leaks memory

**Location**: `src/lib/session-digest.ts:539-542`

```typescript
const sessionId = manager.run("evaluator", prompt, { kind: "job" });
const result = await manager.waitFor(sessionId);
```

`manager.waitFor()` returns a Promise that resolves when the evaluator session completes. If the evaluator session gets stuck or orphaned (e.g., evaluator agent crashes without signaling completion), `waitFor` hangs indefinitely. The outer try-catch at line 536 catches sync errors, but a hanging Promise is never caught — it stays pending.

**Blast radius**: Since all callers of `upsertDigest` are fire-and-forget (`.then().catch()` pattern), the Promise just stays pending — no crash. But it holds references to the manager, session, and transcript data indefinitely, creating a slow memory leak. More importantly, the digest row for this trigger is never written, and any downstream `getLastDigest()` call sees stale data. The recovery subscriber in `may.ts` falls back to `classifyError()` string-matching, which is less intelligent.

**Note**: The LLM synthesis path is only invoked when `what_happened` is NOT pre-provided AND a `manager` is passed. Most digest writes (createStartDigest, createEndDigest, createCheckpointDigest) bypass this. Only `upsertDigest` calls from manager.ts (timeout, overflow, shallow_heartbeat) and session-subscribers.ts (stuck_detected, circuit_break) hit this path.

---

## Finding 5 (P2): `formatDigestContext` overflow trim silently drops unresolved items

**Location**: `src/lib/session-digest.ts:209-217`

```typescript
if (result.length > 10000) {
  const trimLines: string[] = [];
  const trimmed = ordered.slice(-5);
  for (const d of trimmed) {
    trimLines.push(...formatDigestEntry(d, 100));
  }
  result = trimLines.join("\n");
}
```

When the total context exceeds 10,000 chars, the function rebuilds with only the 5 most recent same-agent digests. The `unresolvedDigests` and `crossAgentDigests` are completely dropped — no mention of them in the trimmed output.

**Blast radius**: When an agent has verbose recent history (long `what_happened` fields, many files per session), overflow triggers and the agent loses all visibility into: (a) sessions with unfinished work, (b) cross-agent file modifications. This is exactly the scenario where context is most important (active, file-heavy sessions).

**Note**: The 10,000 char threshold is ~2,500 tokens. With 10 digests × ~300 chars each = ~3,000 chars, this trim rarely fires. But when an agent has long task descriptions or many files, it can trigger.

---

## Non-Findings

| Area | Status | Evidence |
|------|--------|----------|
| `classifyDigest()` (lines 416-441) | **Clean** | Pure switch-case, no IO, no JSON parsing, no DB access. All branches return well-typed `{ action, reason }`. Default case returns safe `"nothing"`. |
| `logShadowComparison()` (lines 455-465) | **Clean** | Wrapped in try-catch, best-effort logging only. Cannot crash. |
| `createStartDigest()` (lines 633-648) | **Clean** | Individual try-catch, logs warning, returns void. No downstream impact on failure. |
| `createEndDigest()` (lines 657-684) | **Clean** | Individual try-catch, logs warning, returns void. |
| `createCheckpointDigest()` (lines 692-722) | **Clean** | Individual try-catch, logs warning, returns void. |
| `extractFilesModified()` (lines 469-511) | **Clean** | Defensive `isLikelyFilePath` filtering, Set-based dedup, no throws. |
| `parseDigestResponse()` (lines 557-573) | **Clean** | Regex-based parsing with fallbacks — unrecognized outcome defaults to `"in_progress"`, missing fields use empty/null. |
| `files_modified` JSON.parse (lines 131, 259, 292) | **Clean** | All three sites wrapped in try-catch with silent fallback. |
| `insertDigest()` / `updateDigestAction()` | **Adequate** | Both are synchronous SQLite operations. Exceptions propagate to their callers' try-catch blocks. |

---

## Recommended Follow-Ups

1. **P1 fix**: Wrap `JSON.parse(d.details)` at line 237 in try-catch (matching lines 131/259/292 pattern). ~3 lines of code.
2. **P2 fix**: Add a timeout to `llmSynthesize` — e.g., `Promise.race([manager.waitFor(sessionId), sleep(30_000)])`.
3. **P2 improvement**: When overflow trim fires in `formatDigestContext`, keep at least the unresolved items section (it's typically compact and high-value).
4. **P2 consideration**: The step counter race could be fixed with `INSERT ... ON CONFLICT (sessionId, step) DO UPDATE` or by using `lastInsertRowid` directly instead of re-querying.
