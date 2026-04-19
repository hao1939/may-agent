# Brief: Lesson Pipeline Cleanup

**Priority:** P2 (Close the Learning Loop)
**Owner:** Tech-Lead
**Created:** 2026-03-14

## Context
Audit found three disconnected lesson mechanisms. Two are dead code. One works (LESSONS.md) but has stale content and duplication.

## Tasks

### 1. Remove dead evaluator lesson writing
**File:** `src/lib/evaluator.ts` (around line 1432)
**What:** The evaluator parses lessons from LLM output and writes to `agents/{agent}/knowledge/lessons.md`. This file is NEVER loaded into agent system prompts (manager.ts only loads `knowledge/INDEX.md`). The evaluator is writing data nobody reads.
**Action:** Remove the lesson-writing code from evaluator.ts. Delete `agents/coder/knowledge/lessons.md` (the only one that exists). Remove the `pruneAgentLessons` function (~line 1480) too.
**Why not wire it in:** We already have LESSONS.md (loaded in system prompt) managed by Coach's Growth Cycle. A second lesson source would create confusion about which file is authoritative.

### 2. Remove dead learn/finish tools
**Files:** `src/lib/tools/learn.ts`, `src/lib/tools/finish.ts` (or wherever createFinishTool lives)
**What:** `createLearnTool` and `createFinishTool` are exported but no agent has "learn" or "finish" in their tool presets. Dead code.
**Action:** 
- If other code imports them, trace and remove those imports
- Remove the tool files
- Remove the "finish" case from agent-loader.ts (line ~376)
- Clean up any references

### 3. Deduplicate shared LESSONS.md boilerplate
**What:** Three entries appear in 10-12 agents' LESSONS.md files:
- "No Blind Writes: Never write to a file if your read() was truncated"
- "Verify Paths: Project root is /app"  
- "Context Efficiency: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read."

**Action:** Create `agents/shared/LESSONS.md` with these common entries. Add it to the system prompt assembly in manager.ts (load after agent's own LESSONS.md, or before). Then remove the duplicated lines from each agent's individual LESSONS.md.

**Implementation note for manager.ts:** Around line 259 where LESSONS.md is loaded, also load `agents/shared/LESSONS.md` if it exists. Something like:
```
const sharedLessons = loadFile(join(projectRoot, "agents", "shared", "LESSONS.md"));
if (sharedLessons) sections.push(`## Shared Lessons\n${sharedLessons}`);
```

### 4. Clean stale P53 references from LESSONS.md
After removing P53 bash guard, these lessons reference behavior that no longer exists:

**Coach LESSONS.md (2 refs):**
- "P53 hits → switch to read()" 
- "P53 block = design signal"

**Optimizer LESSONS.md (1 ref):**
- Something about "P53 Means Stop" or "Protected Files — Plan Delegation First"

**Action:** Remove these specific entries. The P53 bash guard no longer exists; these lessons will confuse agents.

## Verification
- `tsc --noEmit` passes
- `vitest --run` passes  
- No agent loads `knowledge/lessons.md` (confirm with grep)
- No agent has "learn" or "finish" in tool presets (confirm with node script)
- Shared LESSONS.md loaded once in system prompt (check test or manual verification)
- Stale P53 refs removed from Coach and Optimizer LESSONS.md

## Notes
- The learn/finish tools might have been from an earlier design iteration. They're orphaned.
- The evaluator lesson writing was probably intended to close the loop (eval → lesson → agent improvement) but the "load" step was never wired. Rather than wiring it (creating two lesson sources), removing it is cleaner since Coach's Growth Cycle already handles lesson creation with verification.
