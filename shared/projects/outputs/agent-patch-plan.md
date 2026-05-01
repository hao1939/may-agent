# Agent Patch Plan (P2.2)

## Overview

Insert the convention patch block (from `convention-patch-proposal.md`) into each agent's SOUL.md. The block covers C1.1 (read before edit), C2.3 (verify after edit), C1.3 (no batch edits), C40.1 (finish with evidence), C12.1 (deliverables in finish).

## Per-Agent Analysis

### 1. amy (`agents/amy/SOUL.md`, 62 lines)
- **Current coverage**: Line 46 has `⛔ Verify After Every Edit` — already covers C2.3 partially
- **Gap**: No "read before edit" (C1.1), no "finish with evidence" (C40.1)
- **Action**: Insert full block after `## Identity` section (~line 6). Remove/merge line 46 to avoid duplication.
- **Priority**: HIGH — still fails gym despite existing verify mention

### 2. bob (`agents/bob/SOUL.md`, 98 lines)
- **Current coverage**: Line 39 mentions "verify they work" but in research context, not edit context. No C1.1/C2.3/C40.1 coverage.
- **Gap**: All conventions missing for file editing context
- **Action**: Insert full block after the opening critical section (~line 12, after the workflow.run block)
- **Priority**: HIGH

### 3. arc (`agents/arc/SOUL.md`, 28 lines)
- **Current coverage**: Zero verify/read-before-edit mentions. Only has "never edit" restrictions.
- **Gap**: All conventions missing
- **Action**: Insert full block after `## Identity` section (~line 6)
- **Priority**: HIGH

### 4. dev (`agents/dev/SOUL.md`, 34 lines)
- **Current coverage**: Line 20 mentions "Verify: syntax-check code" but in a task-step context, not as a universal rule
- **Gap**: No C1.1, no explicit C2.3 rule, no C40.1
- **Action**: Insert full block after `## Identity` section (~line 6)
- **Priority**: HIGH

### 5. scout (`agents/scout/SOUL.md`, 24 lines)
- **Current coverage**: Zero. Only has "Never edit other agents' files"
- **Gap**: All conventions missing
- **Action**: Insert full block after `## Identity` section (~line 6)
- **Priority**: HIGH (scout does file writes for reports)

### 6. coach (`agents/coach/SOUL.md`, 75 lines)
- **Current coverage**: Line 68 has `⛔ Verify your own claims` — covers C40.1 partially but not C1.1/C2.3
- **Gap**: No read-before-edit, no verify-after-edit for file operations
- **Action**: Insert full block after `## Identity` section (~line 6). Keep line 68 as complementary.
- **Priority**: MEDIUM

### 7. optimizer (`agents/optimizer/SOUL.md`, 163 lines)
- **Current coverage**: Line 150 "Anchored Edits Only: read the file first" (C1.1 ✓), Line 156 "Verify Before Retry" (partial C2.3), Line 159 "Task Contract...verify each one exists" (C40.1 partial)
- **Gap**: Has spirit but not the exact structured format. Missing explicit "verify after every edit" and "no batch edits" rules.
- **Action**: Insert full block after `## Identity` section. Keep existing lines as reinforcement.
- **Priority**: MEDIUM — already has partial coverage

## Insertion Strategy

For all agents, insert after the `## Identity` paragraph (after role/mission/model lines, before the next `##` section). This ensures it's read early in the system prompt.

## Summary Table

| Agent | C1.1 | C2.3 | C1.3 | C40.1 | C12.1 | Action |
|-------|------|------|------|-------|-------|--------|
| amy | ❌ | ⚠️ partial | ❌ | ❌ | ❌ | Insert + merge |
| bob | ❌ | ❌ | ❌ | ❌ | ❌ | Insert |
| arc | ❌ | ❌ | ❌ | ❌ | ❌ | Insert |
| dev | ❌ | ⚠️ weak | ❌ | ❌ | ❌ | Insert |
| scout | ❌ | ❌ | ❌ | ❌ | ❌ | Insert |
| coach | ❌ | ❌ | ❌ | ⚠️ partial | ❌ | Insert |
| optimizer | ✅ | ⚠️ partial | ❌ | ⚠️ partial | ❌ | Insert |
