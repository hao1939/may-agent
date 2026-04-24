# Lens C — Dead Weight: tech-lead/workspace/projects/

**Date:** 2026-04-17
**Scope:** `agents/tech-lead/workspace/projects/*.md` (6 files)
**Verdict:** All 6 project files are terminal (complete / done / cancelled). Zero are Active. They are minor dead weight — not breaking anything, but they clutter the Step-3 "active persistent task" check in the heartbeat and add noise to directory listings.

## Evidence

### File inventory (`ls` + `wc -l`)
Directory listing confirmed 6 `.md` files plus `.gitkeep`, 492 total lines:
- `projects/auto-resume.md` — 18 lines
- `projects/cold-start-fix.md` — 123 lines
- `projects/context-management.md` — 65 lines
- `projects/fix-verify-wrap.md` — 48 lines
- `projects/metric-system-phase1.md` — 137 lines
- `projects/verification-streamline.md` — 101 lines

### Status field per file (grepped `^\*\*Status`)
- `projects/auto-resume.md:3` → `**Status**: cancelled (Hao directive 2026-04-16: no auto-resume of any kind)`
- `projects/cold-start-fix.md:6` → `**Status:** Complete`
- `projects/context-management.md:5` → `**Status:** complete` (also `context-management.md:65` restates "resolved")
- `projects/fix-verify-wrap.md:3` → `**Status**: done`
- `projects/metric-system-phase1.md:3` → `**Status:** ✅ complete (2026-04-15)`
- `projects/verification-streamline.md:6` → `**Status:** Complete`

**None** match `Status: active` or `Status: paused`.

### Heartbeat coupling
Two heartbeat steps scan this directory:
- `agents/tech-lead/heartbeat.md:38` — Step 3 "Active persistent task?" → "Check `agents/tech-lead/workspace/projects/` for Status: active."
- `agents/tech-lead/heartbeat.md:97` — "Check `agents/tech-lead/workspace/projects/` for files with Status: active or paused."
- `agents/tech-lead/heartbeat.md:105` — documents the convention `project: agents/tech-lead/workspace/projects/<feature>.md`

Step 3 today must open/scan 6 files just to confirm "no active project." Archiving terminal files reduces that to an `ls` returning empty (or near-empty), saving startup ops.

### External references (would archiving break anything?)
`grep -rn -E "projects/(auto-resume|cold-start-fix|context-management|fix-verify-wrap|metric-system-phase1|verification-streamline)" agents/` — **no matches outside `workspace/projects/` itself**. Only incidental hits elsewhere are unrelated paths (`agents/shared/research-projects/…`, `agents/shared/projects/memory-architecture-tiered.md`) in `audit-shared-dead-weight.md:98,159` and `archive/2026-04/memory-architecture-review.md:5` — different directories.

Conclusion: no cross-file links would break.

## Severity
**Low.** Not a correctness or safety issue. Purely ergonomic / cold-start overhead:
- Step-3 check opens 6 files every heartbeat to confirm "none active" — ~0 real ops saved in a hot session but meaningful for cold start where every read counts (cf. `projects/cold-start-fix.md`).
- Risk of a future heartbeat misreading a "complete" header as active work (low, but nonzero).

## Recommended action (for a SEPARATE session)
1. `mkdir -p agents/tech-lead/workspace/projects/archive/2026-04/`
2. `git mv` all 6 files into that archive dir (preserves history).
3. Keep `.gitkeep` in `projects/` so the directory survives as an empty drop zone.
4. Optionally add a note to `heartbeat.md:38` clarifying "empty dir == no active work, skip to next step."
5. No code changes. No context.md changes required.

## Follow-ups / out of scope for this lens
- `agents/tech-lead/workspace/` itself has siblings (`audit-shared-dead-weight.md`, `archive/`, lens outputs) that deserve their own dead-weight pass — flagged only, not investigated here.
- Consider a repo-wide convention: `projects/archive/<YYYY-MM>/` so every agent treats its projects dir the same way. Not blocking.

## Evidence trail (tool outputs this session)
- `ls -la agents/tech-lead/workspace/projects/` → 6 md files + .gitkeep
- `wc -l …/*.md` → 492 total lines
- `grep -n -i "^\*\*status" …/*.md` → 7 matches, all terminal states
- `grep -n "projects" agents/tech-lead/heartbeat.md` → lines 38, 97, 105
- `grep -rn -E "projects/(<6 names>)" agents/` excluding `workspace/projects/` → no matches
