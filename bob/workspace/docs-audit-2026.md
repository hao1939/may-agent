# Design Docs Audit — `agents/shared/may-agent-docs/`

**Date**: 2026-03-10  
**Auditor**: May (Bob failed 3x due to context token limits on batch-reading 20 docs)  
**Method**: Read all 20 doc headers + key sections, verified against `src/` codebase, cross-referenced `agents/shared/philosophy.md`

## Summary

The collection is **overgrown and disorganized**. 20 docs + 4 workflow proposals accumulated organically — some are implemented and current, some are obsolete stubs, and several overlap heavily. The biggest issues: (1) three session-simplification docs that should be one, (2) event-driven docs split across design + tasks with the tasks doc now stale, (3) reference material mixed in with design docs, and (4) no clear naming convention (some say "design-X", some say "X-design", some are just nouns).

**3,567 total lines** across 20 docs. Could likely be reduced to ~12 docs and ~2,000 lines with merges and archiving.

---

## Per-Doc Assessment

### 1. `agent-convention.md` (5 lines)
- **Status**: ❌ Obsolete — just a redirect stub
- **Code alignment**: N/A
- **Philosophy alignment**: N/A
- **Notes**: Says "Moved to `agents/coach/skills/agent-conventions/SKILL.md`." Delete this stub — it's noise.

### 2. `best-practices.md` (338 lines)
- **Status**: ✅ Current
- **Code alignment**: N/A (behavioral guidance, not code design)
- **Philosophy alignment**: ✅ Excellent — explicitly maps each practice to philosophy principles (Part 10 alignment table)
- **Notes**: High-value document. Well-maintained, evidence-backed. Keep as-is. Owner: Bob.

### 3. `chat-flag-design.md` (207 lines)
- **Status**: ⚠️ Partially outdated — says "Status: Proposed" but it's **fully implemented**
- **Code alignment**: ✅ Implemented — `CHAT_MODE`, `createChatSession()`, `resumeChatSession()`, `chatSessionId` all in code. `setInterfaceAgent()` removed as designed.
- **Philosophy alignment**: ✅ Aligned (P1 simplest thing, P14 deterministic guardrails)
- **Notes**: Update status to "Implemented". Could merge with `design-explicit-feature-flags.md` since they cover overlapping flag design.

### 4. `cron-graduation-process.md` (78 lines)
- **Status**: ✅ Current
- **Code alignment**: ✅ Implemented — `cron.ts` has `registerHandler()` for JS handlers, agent cron entries for Stage 2
- **Philosophy alignment**: ✅ Aligned (P9 explore-then-harden, P33 heartbeat vs cron)
- **Notes**: Living document with useful stage tracking. Keep.

### 5. `design-explicit-feature-flags.md` (145 lines)
- **Status**: ⚠️ Partially outdated — references `--keep-session` (now `--chat`), `--heartbeat` (not in current `may.ts`), `--openclaw` (not in current `may.ts`)
- **Code alignment**: Partially — core flag pattern implemented (`--chat`, `--cron`, `--telegram`, `--console`, `--socket`, `--task`). But `--heartbeat` and `--openclaw` flags don't appear in current code.
- **Philosophy alignment**: ✅ Aligned (explicit > implicit)
- **Notes**: 🔀 Merge with `chat-flag-design.md` into a single "Launcher & Flags Design" doc. Update to reflect current flags.

### 6. `design-heartbeat-mission-loop.md` (97 lines)
- **Status**: ✅ Current
- **Code alignment**: Partially — heartbeat concept exists but implementation is in `heartbeat.md` files + cron triggers, not as a code-level construct
- **Philosophy alignment**: ✅ Aligned (P30 heartbeat is just a wake-up, P31 adhoc vs periodic, P33 explore then offload)
- **Notes**: Conceptual design doc. Still relevant as reference.

### 7. `design-ideas.md` (329 lines)
- **Status**: ⚠️ Mixed — research reference material, not a design doc
- **Code alignment**: N/A (reference material)
- **Philosophy alignment**: Many ideas here were absorbed into `philosophy.md` (P40 platform risk, P41 memory quality, etc.)
- **Notes**: This is a **knowledge file**, not a design doc. Move to `agents/shared/knowledge/` or `agents/bob/knowledge/`. It doesn't belong in a design docs folder.

### 8. `detached-subagent-design.md` (205 lines)
- **Status**: ✅ Current — says "v3 (2025-03-07) — Simplified after notification system"
- **Code alignment**: ✅ Implemented — `src/lib/detached.ts` (87 lines)
- **Philosophy alignment**: ✅ Aligned (P48 async by default)
- **Notes**: Keep. Well-structured, matches implementation.

### 9. `discoveries-2026-03-06-ai-agents.md` (72 lines)
- **Status**: ❌ Stale reference — one-time research dump from a specific date
- **Code alignment**: N/A
- **Philosophy alignment**: N/A
- **Notes**: This is a **dated research snapshot**, not a design doc. Move to `agents/shared/knowledge/` or archive. Doesn't belong in design docs.

### 10. `event-driven-system-design.md` (230 lines)
- **Status**: ✅ Current
- **Code alignment**: ✅ Implemented — `triggerNow()`, `pendingTriggers`, `lastTriggerTime`, `triggerCooldownMs` all in `cron.ts`
- **Philosophy alignment**: ✅ Aligned (P17 offload routing to infra)
- **Notes**: Keep. Core architecture doc.

### 11. `event-driven-tasks.md` (417 lines)
- **Status**: ❌ Obsolete — implementation task breakdown, work is done
- **Code alignment**: Tasks are completed (triggerNow, pendingTriggers, etc. all in code)
- **Philosophy alignment**: N/A (task list, not design)
- **Notes**: **Largest doc in the collection (417 lines) and it's done.** Archive it. The design doc (#10) is sufficient.

### 12. `focus-tasks.md` (151 lines)
- **Status**: ⚠️ Partially outdated — tracks long-running improvement programs
- **Code alignment**: No code-level construct for focus tasks
- **Philosophy alignment**: ✅ Aligned (P25 everything gets reviewed)
- **Notes**: Operational tracking doc, not a design doc. Could move to `agents/may/workspace/` since May owns operational tracking.

### 13. `jobs-workflows-review.md` (188 lines)
- **Status**: ⚠️ Partially outdated — says "Last updated: 2026-03-22" but references old job names
- **Code alignment**: Workflows exist (`src/lib/workflow.ts`, `workflow-tool.ts`, `workflow-defs.d.ts`)
- **Philosophy alignment**: ✅ Aligned (P25 periodic review)
- **Notes**: Review/inventory doc. Useful but should be refreshed. Keep.

### 14. `meta-loop.md` (58 lines)
- **Status**: ✅ Current
- **Code alignment**: Conceptual — no direct code implementation (it's a process design, not software)
- **Philosophy alignment**: ✅ Aligned (P25 everything gets reviewed, P47 evaluate before apply)
- **Notes**: Short, clear, valuable. Keep.

### 15. `ralph-loop-design.md` (111 lines)
- **Status**: ❌ Never implemented — "Status: Draft"
- **Code alignment**: Zero — no RALPH references in code anywhere
- **Philosophy alignment**: Tension with P1 (over-engineering risk — formalizing exploration into a named framework)
- **Notes**: This was Bob's design proposal that never got traction. **Archive or delete.** If the ideas are good, absorb them into `meta-loop.md`.

### 16. `session-model-simplification.md` (111 lines)
- **Status**: 🔀 Needs merge — "Status: Implemented (2026-03-07)"
- **Code alignment**: ✅ Implemented (chat + task session model is live)
- **Philosophy alignment**: ✅ Aligned
- **Notes**: One of THREE session simplification docs. Merge with #17 and archive #18.

### 17. `session-simplification-proposal.md` (123 lines)
- **Status**: 🔀 Needs merge — "Status: IMPLEMENTED (2026-03-07)"
- **Code alignment**: ✅ Implemented
- **Philosophy alignment**: ✅ Aligned
- **Notes**: Overlaps heavily with #16. Merge into one "Session Model Design" doc.

### 18. `session-simplification-tasks.md` (286 lines)
- **Status**: ❌ Obsolete — implementation task breakdown, all done
- **Code alignment**: All tasks completed
- **Philosophy alignment**: N/A
- **Notes**: Second-largest doc (286 lines) and it's a completed task list. **Archive.**

### 19. `system-design-review.md` (263 lines)
- **Status**: ⚠️ Needs refresh — comprehensive review but may have drifted
- **Code alignment**: Was accurate at time of writing
- **Philosophy alignment**: ✅ Aligned (P25 periodic review)
- **Notes**: Valuable but should be re-run periodically. Keep, mark for refresh.

### 20. `task-completion-notifications.md` (153 lines)
- **Status**: ✅ Current
- **Code alignment**: ✅ Implemented — `handleCompletion()`, `followUp()`, `[task-complete]` messages all in `manager.ts` (32 references)
- **Philosophy alignment**: ✅ Aligned (P6 no silent failures, P17 offload to infra)
- **Notes**: Keep. Matches implementation well.

### Workflow Proposals (`workflow-proposals/`)

| Doc | Lines | Status | Notes |
|-----|-------|--------|-------|
| `enhance-cron.md` | 32 | ⚠️ Vague | Short proposal, no implementation. Review if still relevant. |
| `heartbeat-guard.md` | 38 | ⚠️ Open | Turn guard for heartbeats — reasonable idea, not implemented. |
| `runtime-env-standardization.md` | 25 | ❌ Obsolete | `/app` is now standard, this problem is solved via `best-practices.md` §2.1 |
| `safe-edit.md` | ~40 | ⚠️ Open | Anti-truncation workflow — good idea, partially addressed by TruncationTracker in code |

---

## Recommended Reorganization

### Delete (stubs/redirects)
- `agent-convention.md` — 5-line redirect, zero value

### Archive (completed task lists)
- `event-driven-tasks.md` — 417 lines of done tasks
- `session-simplification-tasks.md` — 286 lines of done tasks
- `workflow-proposals/runtime-env-standardization.md` — solved problem

### Move out of design docs (wrong category)
- `design-ideas.md` → `agents/shared/knowledge/design-ideas.md` (research reference)
- `discoveries-2026-03-06-ai-agents.md` → `agents/shared/knowledge/` (dated research)
- `focus-tasks.md` → `agents/may/workspace/focus-tasks.md` (operational tracking)

### Merge
- `chat-flag-design.md` + `design-explicit-feature-flags.md` → **`launcher-flags-design.md`** (update status to Implemented, reflect current flags)
- `session-model-simplification.md` + `session-simplification-proposal.md` → **`session-model-design.md`** (single implemented design doc)

### Archive or absorb
- `ralph-loop-design.md` — never implemented draft. Good ideas → absorb into `meta-loop.md`, then archive.

### Update status
- `chat-flag-design.md` — change "Proposed" → "Implemented"
- `system-design-review.md` — mark for periodic refresh

### Keep as-is ✅
- `best-practices.md` — excellent, well-maintained
- `cron-graduation-process.md` — living tracking doc
- `design-heartbeat-mission-loop.md` — core conceptual design
- `detached-subagent-design.md` — matches implementation
- `event-driven-system-design.md` — core architecture
- `jobs-workflows-review.md` — periodic review doc
- `meta-loop.md` — clear, concise process doc
- `task-completion-notifications.md` — matches implementation

---

## Proposed New Structure

```
agents/shared/may-agent-docs/
├── best-practices.md                    (338 lines — keep)
├── cron-graduation-process.md           (78 lines — keep)
├── design-heartbeat-mission-loop.md     (97 lines — keep)
├── detached-subagent-design.md          (205 lines — keep)
├── event-driven-system-design.md        (230 lines — keep)
├── jobs-workflows-review.md             (188 lines — keep, refresh)
├── launcher-flags-design.md             (NEW — merged from chat-flag + feature-flags)
├── meta-loop.md                         (58 lines — keep, absorb ralph ideas)
├── session-model-design.md              (NEW — merged from 2 session docs)
├── system-design-review.md              (263 lines — keep, refresh)
├── task-completion-notifications.md     (153 lines — keep)
├── workflow-proposals/
│   ├── enhance-cron.md                  (review relevance)
│   ├── heartbeat-guard.md               (keep — open proposal)
│   └── safe-edit.md                     (keep — open proposal)
└── daily-briefs/                        (keep as-is)

agents/shared/knowledge/
├── design-ideas.md                      (moved from design docs)
└── discoveries-2026-03-06-ai-agents.md  (moved from design docs)

archive/ (or agents/shared/may-agent-docs/archive/)
├── agent-convention.md                  (deleted/archived stub)
├── event-driven-tasks.md               (completed tasks)
├── session-simplification-tasks.md     (completed tasks)
├── ralph-loop-design.md                (unimplemented draft)
└── runtime-env-standardization.md      (solved)
```

**Result**: 20 docs → 11 active docs + 2 moved + 4 archived + 3 merged away

---

## Top 5 Priority Actions

1. **Delete `agent-convention.md`** — 5-line stub, zero value, instant win
2. **Archive `event-driven-tasks.md` + `session-simplification-tasks.md`** — 703 lines of completed task lists cluttering the directory. Biggest noise reduction.
3. **Merge session docs** — combine `session-model-simplification.md` + `session-simplification-proposal.md` into one `session-model-design.md`. Eliminate redundancy.
4. **Merge flag docs** — combine `chat-flag-design.md` + `design-explicit-feature-flags.md` into `launcher-flags-design.md`. Update status to Implemented.
5. **Move non-design docs** — `design-ideas.md`, `discoveries-*.md`, `focus-tasks.md` to their proper locations (knowledge/ or workspace/).
