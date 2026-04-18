# P147 KV-Cache Discipline — Implementation Report

**Date:** 2026-03-18
**Author:** Tech Lead
**Directive:** `agents/bob/workspace/directive-p147-kv-cache-consolidated.md`
**Status:** ✅ Code change complete, docs delegation needed

## Audit Summary

### What was already correct ✅

1. **`resolveSystemPrompt()`** (manager.ts ~L342-460) loads files in deterministic order:
   SOUL → DOMAIN → TOOLS → shared LESSONS → agent LESSONS → INDEX → shared INDEX → common-sense → Runtime Environment → Available Tools
2. **No timestamps, session IDs, or random data** in the system prompt
3. **`buildSessionContext()`** (manager.ts ~L468-530) correctly holds volatile data:
   - Session ID, current timestamp
   - Recent task history (memory.jsonl entries)
   - Active recall warnings
   - Checkpoint data
4. `agent-loader.ts` does NOT manipulate system prompts at all
5. `chat-session.ts` only manages conversation flow, no prompt injection
6. **common-sense.md** already has section 6.3 for P147
7. **philosophy.md** already has P147 marked as `[imported+validated+deployed]`

### Issue found & fixed ⚠️

**`context_files` were loaded in `resolveSystemPrompt()` (system prompt, cached)**

May's `agent.json` specifies `context_files: ["conversation-state.md"]`. This file is "auto-updated" and changes between sessions. Loading it in the system prompt meant every May session had a different system prompt prefix → KV-cache miss → full re-processing.

### Fix applied

**Moved `context_files` from `resolveSystemPrompt()` to `buildSessionContext()`:**

- **Removed** from `resolveSystemPrompt()` at step 5c (L390): replaced with a comment explaining the move
- **Added** to `buildSessionContext()` just before the return statement (L518-528): loads files identically but in the first user message

This ensures the system prompt is 100% static for a given agent configuration, and volatile context files are delivered alongside other per-session data.

### Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ EXIT_CODE:0 |
| `npx vitest run` | ✅ 1449 tests, 108 files, all pass |
| No volatile data in `resolveSystemPrompt` | ✅ Confirmed via grep |
| `context_files` now in `buildSessionContext` | ✅ Confirmed via code read |

## Remaining items (not my domain)

1. **philosophy.md**: Text references `agent-loader.ts` — should say `src/lib/manager.ts`. Can't edit (cross-edit-guard blocks tech-lead from shared/). May should update.
2. **common-sense.md 6.3**: Already present and correct. No changes needed.

## File changed

- `src/lib/manager.ts` — moved `context_files` loading from `resolveSystemPrompt()` to `buildSessionContext()`
