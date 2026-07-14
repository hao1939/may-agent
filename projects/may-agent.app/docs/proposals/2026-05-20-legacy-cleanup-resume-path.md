# 2026-05-20 — Legacy cleanup: dead ApiGate + unified resume path

**Status:** Historical implementation record. Completed removals and deferred
observations below describe that migration point; re-verify any remaining gap
against current Tier 2 design and source before acting.

## Context

Audit of `may-agent` design docs vs implementation (per
`projects/may-agent.app/docs/2a-design/` and `2b-manual/`) surfaced two classes
of legacy debt:

1. **Dead infrastructure** — `ApiGate` and its runtime wrapper were
   carried as deprecated fields on `SubagentManager` since v2, threaded
   through `app-runtime.ts` but never read. The `apiGate?:`,
   `infraRetryMax?:`, `apiGateStatus()`, and `cleanupZombieSessions()`
   API surface had no production effect.

2. **Three resume vocabularies** — `manager.resumeInterrupted`,
   `manager.resumeStaleSessions`, and `manager.resumeSession` each had a
   distinct call shape, error handling convention, and (worst) a
   different behavior. `resumeInterrupted` was a documented `@deprecated
   No-op in v2; return false;` — yet was wired into both the socket
   `resume` command and the runtime auto-resume detector
   (`createAutoResume`), both of which silently logged
   "[resume] Failed to resume…" on every interrupt.

## Why tests didn't catch the no-op resume

The pattern in `test/integration/daemon-events.test.ts`,
`test/integration/command-router.test.ts`, and
`test/e2e/control-routing-e2e.test.ts` was:

```ts
const manager = {
  resumeInterrupted: () => false,
  // ...
} as any;
```

Six call sites — every one mocked `resumeInterrupted` with the **same
broken behavior the production code shipped**, then asserted on
downstream side-effects (escalation creation) rather than on the resume
itself. The retry counter incremented, the third interrupt hit the
`MAX_RESUME_ATTEMPTS` escalate path, and the test went green: "auto-resume
detector escalates after exhausted retries" — true, but a tautology
because retries never had a chance to succeed.

E7 (escalation roundtrip) exercises a separate resume vocabulary
(`escalation-lifecycle.ts` → `manager.resumeSession`), so even at the
e2e tier, no test validated the auto-resume code path end-to-end.

## Cleanup

### A. ApiGate dead-code purge

Deleted files (380 LOC total):
- `src/lib/api-gate.ts`
- `src/lib/api-gate-abort.test.ts`
- `src/app/api-gate-runtime.ts`
- `src/app/api-gate-runtime.test.ts`

Removed:
- `apiGate?:`, `infraRetryMax?:` from `SubagentManagerOptions`
- `apiGateStatus()` method (0 callers)
- `cleanupZombieSessions()` method (returned 0; cron-startup log
  block was never reachable)
- `createRuntimeApiGate()` call from `src/app/app-runtime.ts`
- `ApiGate*` exports from `src/lib/index.ts`
- `infraRetryMax: 0` / `apiGate: ...` props from ~25 test files
  (sed pass)
- `case "resume":` from `src/app/command-router.ts` (unreachable from
  the socket protocol — `resume` is not in `SOCKET_CONTROL_TYPES`
  and has no dot, so it never deserialized as a recognized frame)

### B. Single resume path

New private primitive `SubagentManager.executeResume(sessionId, meta,
opts)`:

```
opts: {
  source: string;
  injectUserMessage?: string;  // replaces synthetic "Process
                               //   restarted..." tail if provided
  unarchive?: boolean;
  resetDbRow?: boolean;
}
```

Behavior:
1. Optionally unarchive `<persistDir>/sessions/<sid>/` from
   `<persistDir>/history/<sid>/`.
2. Build resume messages via `buildResumeMessages` (rebuilds JSONL,
   repairs pending tool-calls, appends synthetic restart turn if needed).
3. If `injectUserMessage`, replace the synthetic tail with an operator
   user turn, and persist the new turn to JSONL.
4. If `resetDbRow`, reset `sessions` row to `status='running',
   endedAt=NULL, error=NULL`.
5. Call `this.run(meta.agent, meta.task, { sessionId, ...,
   resumeMessages })`.
6. On error, emit `session.resume_failed` with category
   `resume_run_failed` and rethrow.

Callers:
- `resumeSession(sessionId, message, opts)` — pre-flight checks
  (already_active, not_found, agent_not_registered) → delegates with
  `injectUserMessage=message, unarchive=true, resetDbRow=true`.
- `resumeStaleSessions(opts?)` — disk scan, kind/abort filtering, lease
  cleanup → delegates with `injectUserMessage=undefined` (synthetic tail
  used as-is), `unarchive=false` (stale sessions are still live on
  disk), `resetDbRow=false` (manager.run reseats the row). Catch path
  additionally records the interrupted state in registry + DB and
  returns it via the `interrupted[]` result slot.

`createAutoResume` callback in `src/app/daemon-events.ts` now wires to
`manager.resumeSession(sid, "[auto-resume] ...", { source:
"runtime:auto-resume" })` instead of the (deleted) `resumeInterrupted`
stub.

Deleted: `manager.resumeInterrupted()` entirely. Removed
`{ resumeInterrupted: () => false }` from 6 test mocks; substituted
`resumeSession` where the test path actually reaches it.

### C. Auto-resume digest classifier — design observation, not fixed

`createAutoResume` does NOT call the resume primitive directly. It first
calls `upsertDigest(sessionId, ..., trigger: "auto_resume", manager)`,
which routes through `classifyDigest`. The classifier returns `"resume"`
only when `outcome === "in_progress" && still_open` are both set, which
requires `llmSynthesize` to populate them via a real
`manager.run("evaluator", ...)` call.

**Implication**: in any environment without an `evaluator` agent + LLM
credentials (including the sandbox), the auto-resume path **never
resumes**. It always lands in the `"nothing"` branch with reason
"No recoverable work worth resuming."

This is a separate concern from the primitive. Possible follow-up:
- Make the digest classifier evaluator-optional with a sensible
  default (`outcome=in_progress, still_open=info.error || info.task`),
- Or document that auto-resume is an LLM-gated feature,
- Or make it explicitly configurable per-agent.

Not in scope for this cleanup. Captured as a finding.

## Regression test: E9

`test/e2e/e9-session-auto-resume.test.ts`. Pre-seeds a cold interrupted
session on disk, emits a `steer` socket frame at it, asserts a fresh
`session.start` event fires with the same sessionId. Verified red
against a stubbed `executeResume` (early return) and green against the
fixed code in ~200 ms.

This test would have caught the v2 `resumeInterrupted` no-op the day it
was written — because the `steer` cold-session path in command-router
also routed through it before the consolidation. The test exercises
the unified `manager.resumeSession` primitive end-to-end without
requiring LLM access.

The unrelated **auto-resume + digest classifier** path (LLM-gated, see
section C) is not directly tested. Adding an E9b variant gated behind
`E2E_LIVE_LLM=1` is a possible follow-up.

## Results

- 1557 unit + integration + e2e tests pass (was 1556; +1 = E9)
- `bun run check` clean
- All resume paths now funnel through `executeResume`. Any future
  resume regression will be caught by E9 (or a unit-level test added
  against `executeResume` itself).
- ~440 LOC removed from `src/lib/` and `src/app/` (api-gate + stubs +
  duplicated resume logic).

## Findings ledger update

- **L1** legacy single-file project format in 14 `*-iteration.ts`
  workflow copies — **RESOLVED** (this session)
  - Removed `isLegacy: boolean;` field from `PersistentTaskConfig`
  - Collapsed the `if (projectInput.endsWith(".md")) { legacy } else { dir }`
    branch in `parseInput` to a single directory-format path
  - Removed `config.isLegacy ? ... : ...` ternaries (3 sites per file)
  - Removed `if (config.isLegacy) { ... } else { ... }` blocks (5–7
    sites per file, in `emitProjectEvent`, `appendJournalEntry`, the
    JS fast-path comment writer, the LLM-decision comment writer, the
    worker journal writer, the reviewer error fallback, the reviewer
    journal writer)
  - Removed `!config.isLegacy` guards on journal-ensure and
    `catalogOutputs`
  - All 14 files now ~75 LOC shorter; total ~1050 LOC dead branch
    removed; 0 leftover `isLegacy` or `projectInput.endsWith(".md")`
    references in `projects/*/workflows/`
  - Transformer at `scripts/legacy-cleanup/remove-isLegacy.py` is the
    audit trail; verified all 14 files transformed cleanly (no
    misses, no surprises). Script can stay for posterity or be
    deleted; behavior is now baked in.
  - `bun build` passes on all 14 transformed files; full test suite
    (1558 / 0 fail) still green.
- **L1b** — defensive HTTP/guard layer references to single-file
  projects — **RESOLVED** (this session)
  - `src/app/http/server.ts:handleProjectJournal` — removed dead
    `(Legacy project — journal is in the project file)` branch.
    Callers that pass `<dir>/project.md` now get the same graceful
    404 ("(No journal found)") as any other missing journal.
  - `src/app/http/server.ts:handleProjectDiscussion` — removed dead
    `(Legacy project — no discussion file)` branch (same rationale).
  - `shared/guards/finish-guard.ts:isPersistentTaskRequired` —
    removed `!projectPath.endsWith('.md') && ...` exclusion. The
    path-shape filter (`includes('/projects/') || !includes('/project.md')`)
    is kept; the `.md` exclusion was the only legacy-specific check.
  - Kept (NOT legacy): `resolveProjectFile:218` (graceful normalization
    for `<dir>/project.md` callers, still useful), `handleProjectArtifact:1661`
    (input validation, not legacy-specific), `:934/1397` (digest dir
    filter, file-explorer filter — unrelated to project format).
  - Net: 4 lines removed (2 `if (path.endsWith(".md")) return ...`,
    plus condition simplification in finish-guard).
  - Tests: 1558 + 360 + 39 (finish-guard) all green; tsc clean.
- **L2** deprecated `SubagentManager` methods (`apiGate`,
  `infraRetryMax`, `apiGateStatus`, `cleanupZombieSessions`,
  `resumeInterrupted`) — **RESOLVED** (deleted)
- **L3** dead ApiGate pipeline — **RESOLVED** (deleted)
- **L7** resume design-vs-impl gap (auto-resume LLM-gated by digest
  classifier) — **DOCUMENTED**, not fixed
- **L4** other `@deprecated` markers — **PARTIAL** (this session)
  - **Resolved**:
    - `SubagentDefinition.compaction` (`src/lib/types.ts`) — declared
      but never read. Removed from the type, from the agent registry
      loader, from `SubagentManagerOptions.run` options, from the
      `chat-session.ts` `manager.run({ compaction: true })` call, and
      from 7 agent.json files (`agents/{amy,amy-kimi,bob,coach,may,
      optimizer,tech-lead}/agent.json`).
    - `requests.ts` re-exports of `ErrorClass` / `classifyError`
      labeled "for backward compatibility" — no external callers found;
      removed.
  - **Deferred**:
    - `manager-agents-tool.ts:message` field (DEPRECATED in schema description but
      still consumed at `manager-agents-tool.ts:289-292` as fallback for
      `task` on fork). Removing would break agent prompts that still pass
      `message`. Sliding deprecation — leave until usage drops to zero.
    - `agents.message`/`agents.send` back-compat error message at line
      237 — still useful guidance for any agents still emitting old
      calls.
    - `SubagentDefinition.contextFiles` — wired (used by
      `appendContextFiles` in `manager-agents-tool.ts`); not dead.
    - `tool-preset-registry.ts:85` "`extends` / archetype inheritance
      is legacy" — **AUDITED, KEPT**: this is a lint-rule emitting an
      error for any agent.json that still declares `extends`. Zero
      agents currently use it, so the check is currently a no-op, but
      keeping it preserves a guard against re-introduction at near-zero
      cost. Deliberate keep.
- **L8** `manager.steer()` / `manager.input()` deprecated wrappers
  — **RESOLVED** (this session)
  - 3 production call sites migrated to `manager.send()` (+ `waitFor()`
    where the result was awaited):
    - `src/app/command-router.ts` — the steer event handler collapsed
      from 3 branches (`status==='idle' → input` / `target → steer` /
      `else → resumeSession`) to 2 (`target → send` / `else →
      resumeSession`). `send()` already handles both idle and running
      sessions.
    - `src/app/chat-session.ts` — `manager.input(sid, msg).then(...)`
      → `manager.send(sid, msg); manager.waitFor(sid).then(...)`.
  - 2 comments in `src/app/http/server.ts` updated to describe the new
    routing.
  - 2 deprecated methods (`steer`, `input`) deleted from
    `src/lib/manager.ts`.
  - 4 test mocks updated (removed `input: ...` / `steer: ...` props in
    favor of `send: ...`).
  - Net: ~30 lines removed.
  - Tests: 1558 / 0 fail, tsc clean.
- **L9** orphaned legacy scripts — **RESOLVED** (this session)
  - Deleted `scripts/resume-project.sh`: depended on the bold-prefixed
    `**Owner**:` metadata format (no project still uses it) and had
    zero external callers in repo. Persistent-task auto-resume + the
    `steer` socket frame now cover its use case.
  - Deleted `scripts/migrate-sessions-to-db.ts`: one-time backfill
    script. Only doc reference is a historical knowledge finding
    describing past migration; backfill is long since complete.
  - Tests: 1558 / 0 fail, tsc clean.
- **L10** audited but kept — (this session, no action)
  - `src/lib/tools/commit-guard.ts:30/37/155/183/188` "legacy-agents"
    repo layout: `resolveAgentRepo` falls back to `<projectRoot>/agents/.git`
    when no top-level `.git` exists. In the current monorepo deployment
    (`/app/.git` is the active repo), this branch is never taken — but
    the code still runs in gym sandboxes, federation hosts, and any
    deployment that pre-dates the monorepo merge. Touching it has
    high risk and low reward; not in scope.
  - `src/app/transport/socket.ts:4` "legacy filename `may.sock`" —
    comment only; renaming the socket file would break every CLI tool
    and downstream caller. Keep.
  - `packages/sdk/src/project-schema.ts:134` "`complete` is a legacy
    alias; use `done`" — active validator catching legacy values. Keep.
  - `src/app/http/server.ts:1829` doc-comment describing tiered
    project-session inference ("legacy runs whose task mentions the
    project path") — real production logic for inferring lineage when
    `sessions.projectId` is absent. Keep.
  - `packages/webui/static/index.html:32` `<details id="legacy-dashboard">`
    — intentional UX: collapses old health panels under a "Legacy
    panels" disclosure header. User-facing feature, not dead code.
