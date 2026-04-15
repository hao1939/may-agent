# Skill: Read Before Edit

**Purpose**: Before every `edit()` call, you MUST `read()` the target file first. This prevents blind edits that corrupt content or use wrong `oldText`.

## The Rule

**Every `edit()` call MUST be preceded by a `read()` of the same file in the same session.**

No exceptions. Even if you "just wrote" the file. Even if you "know" what's in it. Read first.

## Trigger

Before calling `edit(path, ...)` — ask yourself: "Did I `read(path)` in this session?"
- If YES → proceed with edit
- If NO → `read(path)` first, THEN edit

## Protocol

1. **READ the target file** — `read("path/to/file.md")`
2. **LOCATE your edit point** — find the exact text you need to match for `oldText`
3. **EDIT with exact match** — use the text you just read as `oldText`
4. **VERIFY** — read-back or grep to confirm

## Anti-Patterns (NEVER DO)

- ❌ `edit("dispatch-board.md", {oldText: guessed_text, ...})` — guessing without reading
- ❌ Editing workspace files (dispatch-board.md, EXP logs) without reading — these change every session
- ❌ Editing experiment design files without reading current state first

## Files You Edit Most (high-risk)

These files ALWAYS need a read before edit:
- `agents/may/workspace/dispatch-board.md` — changes every heartbeat
- `agents/may/workspace/EXP-*.md` — experiment logs
- `agents/shared/knowledge/experiments/*/design.md` — shared experiment files
- Any workspace file you update regularly

## Assertion

Every `edit()` call MUST have a preceding `read()` of the same file path in the session's tool call history.
