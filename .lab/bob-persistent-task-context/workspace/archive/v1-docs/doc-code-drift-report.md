# Doc-Code Drift Report: 2026-03-10

## 1. agents/shared/may-agent-docs/cron-graduation-process.md

**Verdict**: ✅ Verified (Mostly Aligned)

**Claims vs Code**:
- **Claim**: "Task becomes a named cron entry with `agent: X` and a specific message"
- **Code**: `src/app/cron.ts` confirms execution modes: `manager.run` (heartbeat) and `spawnDetachedAgent` (job).
- **Claim**: "Graduate to JS handler... No LLM involved — pure logic"
- **Code**: `src/app/cron.ts` supports `private handlers = new Map<string, CronHandler>()`.

**Drift Note**: The doc simplifies the execution modes. Code has three distinct paths:
1. `heartbeat` (in-process `manager.run`)
2. `job` (JS handler)
3. `job` (detached agent via `spawnDetachedAgent`)

The doc calls Stage 2 "Agent Cron Job" which maps to either mode 1 or 3 depending on implementation. This is close enough for a conceptual doc.

**Action**: None required.
