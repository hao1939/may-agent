# Harness Maturity Assessment
**Date:** 2026-03-12
**Assessor:** Bob
**Framework:** CuiLiang 2026 (L0-L5)

## 1. Executive Summary

**Current Level: Level 4 (Multi-Agent System)**
We are firmly operating at Level 4. We have explicit tool interfaces (zod schemas), strong execution boundaries (Process/Container isolation for detached agents), structured state management (JSONL + Persistence), and a rich multi-agent collaboration layer (synchronous `call`, asynchronous `send`).

**Next Step:** Solidify Level 4 (Observability) and peek at Level 5 (Self-Correction/Harness-Driven Healing).

## 2. Assessment by Layer

### L0: Prompt Engineering (Passed)
- **Status:** **Mature**
- **Evidence:** `agents/*/SOUL.md` provides structured identity. System prompt assembly in `manager.ts` (7-section layout) is robust. Context Engineering techniques (xml tags, few-shot) are standard.

### L1: Tool Interfaces (Passed)
- **Status:** **Mature**
- **Evidence:** `src/lib/tools/` uses Zod schemas for all inputs. `verify-tool` pattern ensures type safety before execution. No free-text tool invocation.

### L2: Execution Boundaries (Passed)
- **Status:** **Mature**
- **Evidence:**
  - **Filesystem:** `agents/bob/workspace` isolation. `poisoned-path` protection preventing overwrite of critical files.
  - **Process:** `spawnDetachedAgent` runs sub-agents in separate processes.
  - **Time:** `timeoutMs` enforcement in `manager.ts`.

### L3: State Management (Passed)
- **Status:** **Mature**
- **Evidence:**
  - **Persistence:** `persistence.ts` manages JSONL history.
  - **Recovery:** `[STARTED]` sentinel files allow crash recovery (resuming sessions after restart).
  - **Memory:** `knowledge/` markdown files + `memory-consolidation` cron loop.

### L4: Multi-Agent System (Current)
- **Status:** **Active / Hardening**
- **Evidence:**
  - **Protocol:** `agents.call` (sync) and `agents.send` (async).
  - **Discovery:** `agent-loader.ts` dynamic registration.
  - **Observability:** `session-trace` (Workflow) provides some visibility, but could be deeper.
  - **Gaps:** Cross-agent error propagation tracking (Safety Stack L3).

### L5: Harness-Driven Healing (Future)
- **Status:** **Exploratory**
- **Concept:** The harness detects "stuck" agents and intervenes *without* human help.
- **Current Capability:** `turnLimit` warning is a primitive form. `optimizer` meta-loop is an agent-level implementation, not harness-level.

## 3. Gap Analysis

| Component | Status | Gap | Severity |
|-----------|--------|-----|----------|
| **Audit Trails** | Partial | We log *what* happened (JSONL), but not *why* (decision trace / reasoning verification). | Low |
| **Harness Healing** | Minimal | The harness kills stuck sessions but doesn't try to *fix* them (e.g. auto-rollback, parameter injection). | Medium |
| **L3 Safety** | Missing | No systemic tracking of multi-agent failure cascades (as identified by Scout's HAE research). | Medium |
| **Skill Registry** | Mixed | We have `agents/shared/skills/` but `manager.ts` doesn't enforce their usage structurally — they are just text injected into prompts. | Low |

## 4. Recommendations

1. **Solidify L4**: Improve observability. The "Session Trace" is good, but we need a "Topic Flow" view to see how data moves between agents.
2. **Experiment with L5**: Implement "Auto-Retry with Hint" in `manager.ts`. If a tool fails with specific error, harness injects a hint before the agent sees the error.
3. **Formalize Skill Registry**: Move from "text injection" to "harness-managed skills" where the harness *knows* which skills an agent has and can gate access.

## 5. Verdict
**Level 4 (Strong).** We are not just a "Prompt Wrapper" (L0) or "Tool User" (L1). We are a managed system.
