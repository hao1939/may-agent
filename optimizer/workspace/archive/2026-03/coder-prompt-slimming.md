# Coder Prompt Slimming — Patches

**Date**: 2026-03-24
**Author**: Optimizer
**Purpose**: Execute the 3-step prompt slimming plan from `plan-coder-prompt-slimming.md`

## Patch 1: Add 2 unique DOMAIN.md rules to SOUL.md

In `agents/coder/SOUL.md`, after the existing 4 constraints, add these 2 new lines to the `## Constraints` section:

```
- ⛔ **Truncated read = STOP**. If `read()` is truncated, do NOT `write()` that file. Use `read(offset, limit)` to see all content first, or use `sed` for surgical changes. Writing back truncated content destroys everything you missed.
- ⛔ **Size-check before read**. Run `wc -l` first. ≤200 lines → `read()` safe. >200 → use `read(offset, limit)` for relevant sections.
```

This adds ~350 bytes. These are the only 2 unique rules from DOMAIN.md not already covered by SOUL.md, common-sense.md, or generated sections.

## Patch 2: Delete dead files

After Patch 1 is applied:

```bash
rm agents/coder/DOMAIN.md   # 4KB — all content now in SOUL.md, common-sense.md, or generated
rm agents/coder/TOOLS.md     # 1KB — redundant with tool schema descriptions
```

Keep LESSONS.md (877 bytes) — it has 2 active lessons that Coach may reference.

## Patch 3: Slim knowledge/INDEX.md

Replace `agents/coder/knowledge/INDEX.md` with a slimmed version. Current: 8,105 bytes with verbose multi-line descriptions. Proposed: ~2,500 bytes with 1-line summaries + paths.

The skill descriptions should be condensed to: `- **name** → path — when: trigger condition`

## Why safe to execute without gym gate

- Patches 1-2: The system prompt (`resolveSystemPrompt()`) already only loads SOUL.md + common-sense.md. DOMAIN.md and TOOLS.md are NOT in the system prompt. Deleting them just removes dead files. The SOUL.md addition is 2 new constraint lines (~350B), which is additive (not removing any existing content).
- Patch 3: INDEX.md is not loaded into the system prompt either — it's read on-demand. Slimming it preserves all skill names and paths, just removes verbose descriptions.

## Verification after execution

1. `wc -c agents/coder/SOUL.md` should be ~2,770 bytes (was 2,423 + ~350)
2. `ls agents/coder/DOMAIN.md agents/coder/TOOLS.md` should fail (files deleted)
3. `wc -c agents/coder/knowledge/INDEX.md` should be ~2,500 bytes (was 8,105)
4. All skill names from old INDEX.md should still be present in new INDEX.md
