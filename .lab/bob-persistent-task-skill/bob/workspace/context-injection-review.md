# Context Injection Review — System-Wide Analysis

**Date**: 2026-05-03 (updated 2026-05-21)  
**Reviewer**: Bob  
**Request**: Hao P0 (0b5890f5) — review what context injections to keep, remove, or redesign

## Executive Summary

May's project (`agents/may/workspace/projects/context-injection-review/`) already completed a thorough analysis and implementation. The 10-layer injection system in `buildSessionContext()` (manager.ts:540-680) has been analyzed, measured, and a `contextLayers` toggle mechanism has been built. This document synthesizes May's findings with a system-wide review of all injection points.

---

## 1. Current Injection Architecture

### System Prompt (cached, separate from user message)
| Component | Source | Size | All Agents? |
|-----------|--------|------|-------------|
| SOUL.md | `agents/<name>/SOUL.md` | 2-7K chars | Yes |
| common-sense.md | `agents/shared/common-sense.md` | Shared | Yes |
| standing-orders.md | Per-agent | Varies | Yes |
| knowledge-essentials.md | `agents/shared/knowledge-essentials.md` | Shared | Yes |
| Skills | `agents/<name>/skills/*.md` | Varies | Yes |

### First User Message (10 layers, NOT cached)
| # | Layer | Size Range | Decision |
|---|-------|-----------|----------|
| 1 | Session ID + time | ~93 chars | **KEEP** — essential |
| 2 | Recent task history (digests) | 500-2500 chars | **REMOVE** — redundant with project files for persistent tasks |
| 3 | Active recall (FM warnings) | 0-500 chars | **REMOVE** — KE-002 proves text rules = 0% effectiveness |
| 4 | Previous session summary | 200-700 chars | **REMOVE** — overlaps with digests |
| 5 | Session diff | 0-2000 chars | **REMOVE** — overlaps with digests |
| 6 | Last checkpoint | 0-2500 chars | **KEEP (conditional)** — only for persistent tasks |
| 7 | context_files (agent.yaml) | 0-12K chars | **KEEP** — but review sizes |
| 8 | context.md | 0-8.5K chars | **REDESIGN** — cap at 2K, currently unbounded |
| 9 | Knowledge routing | 0-800 chars | **KEEP** — high value per token |
| 10 | The actual task | varies | **KEEP** — this is the point |

### Lessons injection (via lessons-hooks.ts)
| Component | Source | Injected Where |
|-----------|--------|---------------|
| Lessons block | `getLessonsContext()` in lessons.ts:171 | System prompt append |

---

## 2. The Problem (measured by May)

First user message sizes before task appears:

| Agent | Pre-task Context (chars) | ~Tokens |
|-------|-------------------------|---------|
| scout | 16,837 | 4,209 |
| bob | 16,173 | 4,043 |
| may | 15,640 | 3,910 |
| coder | 13,522 | 3,381 |
| coach | 12,257 | 3,064 |

**The task appears LAST** — after all context layers. Agents follow session history instead of the task instruction.

---

## 3. Per-Agent context.md Review

### context.md sizes (production agents only)
| Agent | Size | Assessment |
|-------|------|-----------|
| may | 8,451 bytes | **Largest — needs pruning** |
| bob | 5,678 bytes | Moderate — see detailed review below |
| tech-lead | 6,427 bytes | Moderate |
| optimizer | 6,288 bytes | Moderate |
| coach | 5,295 bytes | Moderate |
| scout | 3,866 bytes | OK |
| qa | 2,290 bytes | OK |
| amy-kimi | 2,289 bytes | OK |
| coder | 1,505 bytes | Good — lean |
| evaluator | 1,315 bytes | Good |
| amy | 1,204 bytes | Good |

### Bob's context.md — Detailed

**KEEP:**
- Environment facts (bun path, npx unavailability, sqlite CLI, project root)
- C1.1 read-before-edit guard
- Turn discipline limits
- Lean heartbeat pattern, KE-008
- opBudget removal directive (prevents re-proposals)
- Knowledge scaffolding scripts (new-hypothesis.sh, new-ke.sh, new-experiment.sh)

**REMOVE:**
- "SOUL.md text changes don't fix judgment failures" — stale, coach-specific
- "Before proposing guards: read code-vs-data-decisions.md" — one-time reference
- "When sending design briefs: use reviewed-delivery workflow" — self-evident
- "Operational Knowledge" section — duplicates KE-133+147 already listed above it
- "Reflexion-Extracted Lessons" section — federation fact belongs in shared knowledge, not bob's context
- "Learned from experience" file-existence check — too specific for permanent context

**REDESIGN:**
- Move script references and tool paths to TOOLS.md
- Group environment facts into a compact block
- Target: 5,678 → ~3,500 bytes (38% reduction)

---

## 4. Recommendations

### Immediate (implemented, needs rollout)

May built `contextLayers` toggles in `SubagentDefinition`. The minimal injection design:

**Default ON:** Layers 1 (session ID), 9 (knowledge routing), 10 (task)  
**Conditional:** Layer 6 (checkpoint) — only for persistent tasks  
**Default OFF:** Layers 2-5 (digests, recall, last-session, session-diff), 8 (context.md — move to on-demand)

**Expected reduction:** 13-17K → 2-5K chars in first user message.

### context.md Cleanup (all agents)

1. **Cap context.md at 2,000 chars** — enforce in `finish()` context_updates handler
2. **Audit all agents >4K** — may (8.4K), bob (6.9K), tech-lead (6.4K), optimizer (6.3K), coach (5.3K)
3. **Move environment facts** to agent.yaml or a shared env file (these never change)
4. **Move script/tool references** to per-agent TOOLS.md

### Structural Redesign

1. **Task-first message ordering** — if any context remains in user message, task should come FIRST
2. **On-demand discovery** — agents already know where to find things via common-sense.md conventions table. Trust the discovery pattern instead of pre-loading.
3. **context.md → system prompt** — May analyzed this (M3) and concluded it's NOT worth it: breaks KV cache since context.md changes via finish(). The win is in REMOVING layers, not moving them.

### Lessons Injection

- Currently appended to system prompt via `getLessonsContext()`
- Low risk — lessons are small and targeted
- **KEEP** as-is

---

## 5. Implementation Status

| Milestone | Status | Notes |
|-----------|--------|-------|
| M1: Baseline measurement | ✅ Done | See sizes above |
| M2: contextLayers toggles | ✅ Done | In code, tests pass |
| M3: Move to system prompt | ⏭ Skipped | Marginal benefit per May's analysis |
| M4: Minimal injection design | ✅ Done | Design finalized |
| M5: Implementation | ✅ Done | Code in manager.ts, 13 tests pass |
| Rollout: Enable minimal mode | ❌ Not done | Needs per-agent contextLayers config |
| context.md pruning | ❌ Not done | 5 agents need cleanup |

---

## 6. Next Steps

1. **Enable minimal contextLayers** for all agents (set layers 2-5 to false in agent configs)
2. **Prune context.md** for top 5 agents (may, bob, tech-lead, optimizer, coach)
3. **Add context.md size cap** (2K chars) to the finish() handler
4. **Measure post-rollout** — track first-message sizes and task compliance rates
5. **Consider task-first ordering** — flip the message structure so task appears before any context

---

## References

- May's project: `agents/may/workspace/projects/context-injection-review/project.md`
- Design doc: `agents/shared/may-agent-docs/design/context-injection-design.md`
- Code: `src/lib/manager.ts` (pre-compiled runtime, not in agents/ repo) — `buildSessionContext` function
- contextLayers toggle: referenced in `src/lib/types.ts` (`SubagentDefinition`) — May's M2/M5 work
- Lessons hooks: `agents/src/lib/lessons-hooks.ts` — `getLessonsContext()` called during `buildSessionContext()`
