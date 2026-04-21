# Context Injection Review — Bob's Audit

**Date**: 2026-04-22  
**Requested by**: Hao (P0, via May's project brief)  
**Source**: agents/may/workspace/projects/context-injection-review/project.md

## Executive Summary

May already did excellent work on this (project status: done, M1-M5 complete). The core finding is correct and well-evidenced: **agents receive 6-17K chars of context before the task appears, and 60-80% of it is redundant or ineffective.** The `contextLayers` toggle system is implemented and ready to deploy. My review validates the findings and adds specific recommendations on context.md hygiene.

## Current State: What Gets Injected

### First User Message (10 layers, ~6-17K chars)

| Layer | Content | Size | Verdict |
|-------|---------|------|---------|
| 1. Session ID + time | Orientation | ~93 chars | **KEEP** — tiny, essential |
| 2. Task digests | Recent history | 500-2500 chars | **REMOVE** — overlaps with project files and checkpoints |
| 3. Active recall | FM warnings | 0-500 chars | **REMOVE** — KE-002 proved 0% effectiveness for text rules |
| 4. Last-session summary | Continuity | 200-700 chars | **REMOVE** — redundant with digests (which are also being removed) |
| 5. Session diff | What changed | 0-2000 chars | **REMOVE** — redundant with digests |
| 6. Last checkpoint | Resume WIP | 0-2500 chars | **KEEP for persistent tasks only** — high value when present |
| 7. context_files (agent.yaml) | Heartbeat etc. | 0-12000 chars | **KEEP** — but review per-agent |
| 8. context.md | Accumulated facts | 1.2-7.6K chars | **CAP at 2K chars** — grows unbounded, much is stale |
| 9. Knowledge routing | KE breadcrumbs | 0-800 chars | **KEEP** — high value per token |
| 10. The actual task | The point | varies | **KEEP** — should be FIRST, not last |

### System Prompt (separate, cached)

SOUL.md + common-sense.md + standing-orders.md + knowledge-essentials.md + skills. Sizes:

| Agent | SOUL.md | Heartbeat.md | context.md | Total injected |
|-------|---------|-------------|-----------|---------------|
| bob | 6,079 | 2,489 | 5,584 | 14,152 |
| may | 4,146 | 2,006 | 7,628 | 13,780 |
| tech-lead | 5,417 | 3,179 | 5,294 | 13,890 |
| optimizer | 7,270 | 2,824 | 4,822 | 14,916 |
| coach | 4,557 | 2,737 | 3,709 | 11,003 |
| scout | 2,540 | 2,833 | 3,026 | 8,399 |
| evaluator | 5,823 | 6,433 | 1,315 | 13,571 |
| qa | 5,865 | 2,679 | 2,024 | 10,568 |
| amy | 6,042 | 1,537 | 1,204 | 8,783 |

## Key Findings

### 1. May's M4 design is correct — implement it
The minimal injection (layers 1 + 9 + 10, plus 6 for persistent tasks) would reduce first-message from ~13-17K to ~300-500 chars + task. The `contextLayers` toggle is already implemented. **Just flip the defaults.**

### 2. context.md is the biggest hygiene problem

| Agent | context.md size | Assessment |
|-------|----------------|------------|
| may | 7,628 chars (84 lines) | **Bloated** — largest by far |
| bob | 5,584 chars (39 lines) | **Bloated** — has good content but too much |
| tech-lead | 5,294 chars (40 lines) | **Bloated** |
| optimizer | 4,822 chars (38 lines) | **Needs trim** |
| coach | 3,709 chars (24 lines) | OK-ish |
| scout | 3,026 chars (25 lines) | OK |
| Others | <2.3K | Fine |

Bob's context.md (my own!) has 39 facts. Many are valuable (bun path, project root, gym guidance) but several are domain-specific operational knowledge that should be in skills or project files, not injected every session. The "Tools available" and "Operational Knowledge" sections at the bottom are good candidates for moving to a skill file.

### 3. Layers 2-5 are redundant with each other
Task digests, last-session summary, and session-diff all solve "what happened recently" in overlapping ways. For persistent tasks, the project file already contains this. For one-off tasks, none of it matters. Remove all three.

### 4. Active recall (layer 3) is proven useless
KE-002 showed text-based warnings have 0% effectiveness at changing agent behavior. This layer is pure noise.

### 5. Task should appear FIRST, not last
Currently the task is buried under 10-16K of context. Moving it to position 1 (after just session ID) would improve task compliance. This is May's core insight and it's correct.

## Recommendations

### Immediate (flip switches)
1. **Disable layers 2-5 globally** via `contextLayers` defaults → saves 3-6K chars per session
2. **Move task to position 1** in first user message (after session ID)
3. **Cap context.md at 2000 chars** — add a trim warning when approaching limit

### Short-term (1-2 sessions of work)
4. **Audit and trim context.md** for bob (5.6K→2K), may (7.6K→2K), tech-lead (5.3K→2K)
   - Move operational/tool knowledge to skill files
   - Remove stale/obvious facts
   - Keep only environment facts and hard-won lessons
5. **Disable layer 8 (context.md) for non-heartbeat sessions** — most task sessions don't need accumulated knowledge

### Medium-term
6. **Make context.md tool-accessible** instead of always-injected — agent reads it when needed
7. **Add size monitoring** — alert when any agent's total injection exceeds 5K chars

## What NOT to Do
- Don't move context.md to system prompt — it changes between sessions and would break KV cache
- Don't add more layers — every new injection layer compounds the burial problem
- Don't remove knowledge routing (layer 9) — it's tiny and high-value

## Validation
May's M2 tests showed 83.3% reduction in fixture size with layers disabled. The `contextLayers` implementation passes all 13 tests. The design is sound — it just needs to be turned on.
