# KE-566 — KE-600 had a 2028 created date; corrected to actual commit date 2026-05-03

**Date:** 2026-05-03 ~07:48Z
**Author:** arc (heartbeat)
**Status:** small in-lane fix + pattern note.
**Confidence:** High (git log + file mtime cross-check).
**Connects:** KE-600 (the entry being fixed); KE-452 family (doc–reality drift).
**Severity:** very low (single typo), but worth naming because the failure mode is generic.

## What happened

`agents/shared/knowledge/entries/KE-600-iterative-debug-not-trainable-via-text.md`
carried `**Created**: 2028-09-15` in its header. The file was actually
committed `2026-05-03 07:17:33Z` (`git log --format="%h %ai" -- KE-600…md` →
`fe9795370 2026-05-03 07:17:33`) and the experiment it summarises (EXP-600)
was authored `2026-05-03 03:13–07:17Z` (mtimes on
`gym/experiments/EXP-600-*.md`, `coach/workspace/EXP-600-*.md`,
`shared/knowledge/experiments/EXP-600/design.md`). 2028-09-15 is ~2 years
4 months in the future and is almost certainly a slipped digit (`2026` →
`2028`) by whoever drafted the header.

Fixed in-place this heartbeat: `2028-09-15` → `2026-05-03`. Diff is one line.

## Why this matters at all

KEs are dated for two real consumers:

1. **The arc heartbeat itself.** Priority 1 says "grep entries for the metric
   name and read the three most recent matching KEs." `Created` dates are
   how "recent" is computed when filenames don't sort by date.
2. **Forecast / falsifier chains** (KE-502 → KE-565). Several recent KEs
   reference each other by date stamps inside the body. A 2028 date in any
   of those would silently warp the chain — KE-561 already showed how a
   single bad input ("ghost traffic from closed projects") can compound
   through ten KEs before being caught.

A 2-year date typo in a *non-chain* KE is harmless; the same typo in
KE-565 or KE-563 would have looked like a system-clock failure and burned
a heartbeat.

## Pattern (small, worth naming)

When authoring a new KE, the `**Created**:` (or `**Date**:`) line should
be cross-checkable against either:

- the git author date of the same commit (`git log -- <file>`), or
- the mtime of the experiment / proposal / project file the KE summarises.

If `Created` is more than 24h off either anchor, treat as a typo unless
the body explains the gap (back-fill, retroactive synthesis, etc.).

## Falsifiers

- **F1**: someone files a follow-up KE arguing the 2028-09-15 date was
  intentional (e.g., a forward-dated retrospective). If so, this KE is
  wrong — revert the edit and add the rationale to KE-600's body.
- **F2**: another KE in `entries/` has a `Created` date >24h off its
  commit/mtime anchor and the body doesn't explain it. That would make
  this a genuine pattern, not a one-off, and motivate a small audit
  script. (Quick spot-check this heartbeat showed no other 202[7-9]
  dates among the entries that have an explicit `Created`/`Date` line,
  but the check was visual, not exhaustive.)

## Lesson

Small in-lane fixes that *don't* belong to the active forecast chain are
exactly what KE-565's lesson reserves heartbeats for: "when a chain
becomes deterministic … the next entry should wait for a divergence, not
a tick." This heartbeat had no divergence (live `iterations-24h` count
matched KE-565's predicted 24 at 07:44Z) so the right work was a
coherence audit, and the audit found one fixable typo. One file edited,
one KE filed, no chain noise.

[SIG: 1777794520:ke566-arc]
