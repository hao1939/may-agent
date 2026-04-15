# Coder Prompt Slimming Plan

**Date**: 2026-03-24
**Author**: Optimizer
**Status**: Analysis complete, ready for execution
**Context**: Agent Evolution System — Optimizer's first Prompt Slimming Cycle

## Current State

### System Prompt (loaded by `resolveSystemPrompt()` in manager.ts)

| File | Bytes | Status |
|------|-------|--------|
| SOUL.md | 2,423 | ✅ Loaded — clean, well-structured |
| common-sense.md | 2,719 | ✅ Loaded — shared across all agents |
| [generated] Runtime env | ~300 | ✅ Auto-generated |
| [generated] Available tools | ~150 | ✅ Auto-generated |
| **Total system prompt** | **~5,600** | **Already under 15KB target** |

### Files that EXIST but are NOT loaded

Manager.ts was updated to only load SOUL.md + common-sense.md. These files exist but are dead weight — they're never injected into the system prompt:

| File | Bytes | Content Assessment |
|------|-------|--------------------|
| DOMAIN.md | 3,987 | 80% duplicated: "read before edit" (SOUL), "verify after write" (SOUL+common-sense), "available tools" (generated), "project structure" (knowledge/INDEX). 20% unique: truncated-read-stop rule, file reading protocol sizes |
| TOOLS.md | 1,092 | 90% redundant with tool schema descriptions + SOUL constraints. Unique: "checkpoint is not a shell command" warning |
| LESSONS.md | 877 | 2 active lessons: P104 calibration, AgentMessage.isError unreliable. Both are agent-specific knowledge worth keeping |

### User Message Context (per session)

| Component | Est. Size | Notes |
|-----------|-----------|-------|
| heartbeat.md | 3,296 | Injected when heartbeat fires |
| Session context (memory, checkpoint) | ~2,000 | Variable |
| Task message | ~500-5,000 | From dispatcher |
| **Total first user message** | **~6-10KB** | Variable |

### knowledge/INDEX.md (not loaded, read on-demand)

| File | Bytes | Notes |
|------|-------|-------|
| INDEX.md | 8,105 | 13 skill entries with full descriptions. Coder reads this on-demand |

## Analysis

### What's Already Good
1. **System prompt is lean** (5.6KB) — well under the 15KB budget
2. **SOUL.md is clean** (2.4KB) — identity + role + methodology + 7 curated skills + constraints
3. **common-sense.md is reasonable** (2.7KB) — generic team rules, no agent-specific content

### Issues Found

#### Issue 1: Dead files (DOMAIN.md, TOOLS.md, LESSONS.md) — LOW priority
These files are NOT loaded into the system prompt but still exist on disk. They waste tokens when Coder reads them on-demand (which it does — 20 DOMAIN reads, 17 LESSONS reads, 11 TOOLS reads found in session history). Each unnecessary read costs tokens.

**Action**: Merge unique content into SOUL.md or knowledge/, then delete.

#### Issue 2: knowledge/INDEX.md is bloated (8.1KB) — MEDIUM priority
INDEX.md contains 13 skill entries with verbose multi-line descriptions. When Coder reads this on-demand, it's 8.1KB of context. Most of these skills are already listed in SOUL.md (7 skills). The INDEX duplicates them with much more detail.

**Action**: Slim INDEX.md to just list references (skill name + 1 line + path). Detail lives in the SKILL.md files themselves.

#### Issue 3: DOMAIN.md duplication causes wasted reads — MEDIUM priority  
Coder's heartbeat says "Read: Understand the codebase first" and references DOMAIN.md patterns. If an agent reads DOMAIN.md and gets 4KB of content mostly duplicated from SOUL.md + common-sense.md, that's wasted context.

**Action**: Graduate the 2 unique rules from DOMAIN.md into SOUL.md, delete DOMAIN.md.

#### Issue 4: heartbeat.md is large (3.3KB) — LOW priority for this cycle
The heartbeat has good content but could be slimmed. Leave for a future cycle.

## Slimming Plan — 3 Steps

### Step 1: Graduate unique DOMAIN.md content → SOUL.md

**What's unique in DOMAIN.md (not covered by SOUL or common-sense):**
1. "Truncated Read = STOP" rule — critical safety rule, not in SOUL.md
2. File reading protocol (size thresholds: ≤200 lines = safe, >200 = paginate) — useful reference

**Action**: Add a condensed version to SOUL.md under Constraints:
```
- ⛔ **Truncated read = STOP**: If `read()` is truncated, do NOT `write()` that file. Use `read(offset, limit)` to see all content first, or use `sed` for surgical changes.
- ⛔ **Size-check before read**: `wc -l` first. ≤200 lines → `read()` safe. >200 → use `read(offset, limit)`.
```

This adds ~250 bytes to SOUL.md (2,423 → ~2,670). Still well under budget.

### Step 2: Delete DOMAIN.md, TOOLS.md

**DOMAIN.md**: After graduating the 2 unique rules, all remaining content is duplicated:
- "Your project root" → already in Runtime Environment generated section
- Workflow → duplicated in heartbeat.md + SOUL methodology
- File editing rules → duplicated in SOUL (read-before-edit, verify-after-write)
- Available tools → auto-generated in system prompt
- Code rules → in SOUL constraints + common-sense
- Testing → in heartbeat + SOUL constraints
- Project structure → in knowledge/INDEX.md

**TOOLS.md**: "checkpoint is not a shell command" warning can go in heartbeat.md (already has tool guidance). Everything else is redundant with tool schema descriptions.

**LESSONS.md**: Keep for now — 877 bytes, not loaded, but contains 2 active lessons that Coach may want to reference. Can be deleted in a future cycle after graduating content.

### Step 3: Slim knowledge/INDEX.md (8.1KB → ~2.5KB est.)

Current: 13 skills with 3-8 line descriptions each.
Proposed: Skill name + 1-line trigger condition + path. Agent reads the full SKILL.md when needed.

Example transformation:
```
# Before (current, 450 bytes per entry):
- `agents/shared/skills/error-handling/SKILL.md` — error recovery patterns:
  retry loop, validation (read-back after edit), tool grounding, edit ambiguity
  recovery. Anti-patterns: silent abandon, planning without executing.

# After (proposed, 80 bytes per entry):
- **error-handling** → `shared/skills/error-handling/SKILL.md` — when: tool error or unexpected result
```

Estimated reduction: 8,105 → ~2,500 bytes (69% reduction per on-demand read).

## Baseline → Verify Protocol

Per the Agent Evolution System architecture:

### Before changes:
1. Run Coder's regression suite: `scripts/gym-baseline.sh --run-all --agent coder`
2. Record pass rates for all 8 coder scenarios

### After changes:
1. Re-run the same suite
2. Compare: pass rate must be within 5% of baseline
3. If pass → ship. If fail → revert.

## Expected Savings

| Change | Token Savings | Risk |
|--------|--------------|------|
| Graduate DOMAIN rules + delete DOMAIN.md | ~4KB saved per on-demand read (20 reads in history) | Low — unique content preserved |
| Delete TOOLS.md | ~1KB saved per read (11 reads) | Very low — content is redundant |
| Slim INDEX.md | ~5.6KB saved per read (79 knowledge reads) | Medium — verify agents can still find references |
| **Total** | **~10.6KB per read × freq** | **Run gym to verify** |

## Sequencing

1. ⚠️ **Check Coach lock**: Verify no active fork for Coder before proceeding
2. Run baseline gym suite
3. Apply Step 1 (graduate DOMAIN rules to SOUL.md)
4. Apply Step 2 (delete DOMAIN.md, TOOLS.md)  
5. Apply Step 3 (slim INDEX.md)
6. Run verification gym suite
7. Compare results
8. Ship or revert

## Cross-Agent Boundary Note

Steps 1-3 require editing files in `agents/coder/` — these are cross-agent edits. Per my operating rules (Rule B), I must:
- Draft changes in `agents/optimizer/workspace/patches/`
- Send to May requesting the edits
- OR: send to Coder directly if it's a self-edit task

**Recommendation**: Send the slimming task to tech-lead for execution after baseline measurement, since it involves file changes + gym verification.
