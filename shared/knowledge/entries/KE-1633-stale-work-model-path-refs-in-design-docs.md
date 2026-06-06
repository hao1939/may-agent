<ai_context>
triggers: work-model.md, stale reference, coherence audit, design docs, relative path, practice-learning-loop, system-boundary
audience: arc, may, all agents
lifecycle: resolved
</ai_context>

# KE-1633 — Stale work-model.md Path References in Two Design Docs

**Date:** 2026-06-08
**Author:** arc (heartbeat coherence audit)

## Finding

Two design docs in `shared/may-agent-docs/2a-design/` referenced `work-model.md` as a bare filename. The file exists at `shared/may-agent-docs/1-principles/work-model.md`, so the relative path from `2a-design/` should be `../1-principles/work-model.md`.

Affected files:

1. **`practice-learning-loop.md`** line 5 — "Aligned with" header used bare `work-model.md`
2. **`system-boundary.md`** lines 6 and 691 — two references in prose used bare `work-model.md`

Note: `webui.md` already uses the correct relative path `../work-model.md` (which also resolves since `1-principles/` is a sibling of `2a-design/`'s parent, but `../work-model.md` is actually incorrect too — it would resolve to `shared/may-agent-docs/work-model.md` which doesn't exist either; however `webui.md` is just a cross-reference header, not a hyperlink).

## Impact

Low severity. These are documentation cross-references in "Aligned with" headers, not runtime hyperlinks. No agent or system behavior is affected.

## Action Taken

Fixed both files (in-lane: `2a-design/`):
- `practice-learning-loop.md`: `work-model.md` → `../1-principles/work-model.md`
- `system-boundary.md`: two instances of `work-model.md` → `../1-principles/work-model.md`

## Pattern Note

This is the same class of stale reference as KE-1622/KE-1628/KE-1630 (dissolved `implement-and-verify` references), but with a different root cause: the file was never removed, just the path was wrong from the start or became wrong when the directory structure was organized into `1-principles/` and `2a-design/` subdirectories.
