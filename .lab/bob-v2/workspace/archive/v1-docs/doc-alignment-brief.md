# Doc Alignment Brief — V2 Migration

## Summary
Significant drift detected. V2 architectural changes (ephemeral sessions, sync `callAgent`, removed `subagents` tool) are implemented in code but contradicted by key design docs. The `docs/` folder still largely describes V1 patterns (persistent sessions, async delegation, notification queues), creating a high risk of agent hallucination if they read these docs to understand the system.

## 🚩 Red Flags (Wrong & Misleading)
*These docs actively contradict the codebase and must be nuked or rewritten immediately.*

| Doc | Issue |
|---|---|
| `docs/design.md` | Describes V1 persistent sessions, `subagents` tool, and async notification queues. **Code uses ephemeral sessions and sync `callAgent`.** |
| `agents/shared/system-design.md` | (The Team Bible) references `subagents` tool, `delegate` method, and persistent sessions. **Agents reading this will hallucinate tools that don't exist.** |
| `docs/workflow-design.md` | Describes async workflow patterns with `notify` and `drain`. **Code uses sync `workflow.ts` with direct return values.** |
| `docs/agent-convention.md` | References `heartbeat.md` and `heartbeatMs` in `agent.json`. **Code removed `heartbeatMs` (moved to `cron.json`) and treats heartbeats as standard cron tasks.** |

## ⚠️ Stale Docs (Outdated Concepts)
*Concepts are partly right, but implementation details are wrong.*

| Doc | Issue |
|---|---|
| `docs/operations.md` | References `may/workspace/progress.md` (doesn't exist) and old cron job names. |
| `docs/cron-session-design.md` | Describes the "Instance Model" and `may.pid` logic which was simplified/removed in V2. |
| `docs/infra-issues.md` | Lists V1 issues (e.g., "Notification queue race conditions") that are structurally impossible in V2. |

## 🧩 Missing Docs (New Features)
*Code exists, but no doc explains how to use it.*

| Feature | Code Location | Missing Documentation |
|---|---|---|
| **Sync `callAgent`** | `src/lib/v2/workflow.ts` | No doc explaining the new sync primitives and error handling. |
| **Agents Tool** | `src/lib/tools/agents.ts` | The new 5-action tool (`call`, `list`, `peek`, `steer`, `cancel`) is undocumented in `system-design.md`. |
| **Chat Loop** | `src/app/chat-loop.ts` | The new ephemeral session architecture for the UI is undocumented. |
| **Job History** | `src/lib/cron-tool.ts` | The `.state/job-history.jsonl` format and usage are undocumented. |

## 📂 Path Drift
*Docs reference files that moved during `src/` restructure.*

* `src/manager.ts` → `src/lib/manager.ts`
* `src/agent.ts` → `src/lib/agent.ts` (or `index.ts`)
* `src/utils/` → `src/lib/` (various utils)

## Recommendations

1.  **Immediate Purge**: Delete `docs/design.md` and `docs/workflow-design.md`. They are dangerously obsolete. Replace with a link to `docs/v2-design.md`.
2.  **Critical Update**: Rewrite `agents/shared/system-design.md` to match V2. This is the highest priority because agents read it to understand their own tools.
    *   Replace `subagents` tool with `agents` tool.
    *   Replace async delegation with sync `callAgent`.
    *   Remove references to persistent sessions and notification queues.
3.  **Rename & Promote**: `docs/v2-design.md` is the new source of truth. Rename it to `docs/architecture.md` and treat it as the canonical design doc.
4.  **Cron Alignment**: Update `docs/agent-convention.md` to remove `heartbeatMs` and explain the new `cron.json` structure.
