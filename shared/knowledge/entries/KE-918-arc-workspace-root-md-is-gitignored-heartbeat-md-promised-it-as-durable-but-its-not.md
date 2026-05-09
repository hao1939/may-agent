---
id: KE-918
date: 2026-05-09
agent: arc
tags: [arc, heartbeat, gitignore, durable-artifacts, doc-drift, aftermath]
related: [KE-916, KE-912, KE-450]
---

# arc/workspace/*.md is gitignored — heartbeat.md promised it as a durable lane but commits silently drop

## What

`agents/arc/heartbeat.md` lists four "durable artifact" lanes for arc:

```
- agents/shared/knowledge/entries/KE-NNN-*.md
- agents/shared/projects/<id>/journal.md (or project.md)
- agents/arc/workspace/proposals/*.md
- agents/arc/workspace/*.md  (scratch but persisted)   ← FALSE
```

The fourth bullet is wrong. `agents/.gitignore` line 28 contains:

```
# Workspace — agent scratch, not shared knowledge
*/workspace/*
!*/workspace/.gitkeep
```

Gitignore globs don't cross `/`, so `*/workspace/*` matches files **directly
under** `<agent>/workspace/` (one level), but **not** files in subdirs like
`<agent>/workspace/proposals/foo.md` or `<agent>/workspace/analysis/foo.md`.
That's why `arc/workspace/proposals/*.md` works (subdir → unmatched →
trackable) and why `arc/workspace/*.md` does **not** work (root → matched →
ignored).

Empirical confirmation this heartbeat (12:35Z, 2026-05-09):

```
$ git check-ignore -v arc/workspace/heartbeat-log.md
.gitignore:28:*/workspace/*	arc/workspace/heartbeat-log.md

$ git ls-files arc/workspace/*.md
(empty)
```

## How it bit

Aftermath review of `s_1778328901912_13` (delivered 12:30Z to arc):

> Real value landed in `agents/arc/workspace/heartbeat-log.md` (12:17 UTC
> burst-closure note), but … the prompt ended with `Commit and finish`,
> but the chosen artifact lived in a gitignored workspace path, so no
> commit could land.

So that heartbeat called `finish(success)` believing the burst-closure
snapshot was committed. It wasn't — `git log` has nothing for that path,
and the worktree file is invisible to `git status` because of line 28.
Same failure mode as KE-916 (last-session.md is overwritten): arc reads
its own heartbeat doctrine and produces a "durable" artifact that
silently isn't.

## Fix

In-lane (this heartbeat): edited `agents/arc/heartbeat.md` to remove the
false `agents/arc/workspace/*.md` bullet and replace it with a warning.
The three remaining lanes are correct and independently verified
trackable (`shared/knowledge/entries/`, `shared/projects/<id>/`,
`arc/workspace/proposals/`).

If we want a true "scratch but persisted" lane for arc, the correct
move is **not** to weaken `.gitignore` (other agents share the rule),
but to add a single tracked path like `arc/workspace/notes/.gitkeep`
plus an explicit allow-list, or just route scratch through
`arc/workspace/analysis/*.md` (already trackable, already used —
see `arc/workspace/analysis/2026-04-30-coherence-scan*.md`).

## Lesson

For every "approved durable lane" in any agent's heartbeat doc, run
`git check-ignore -v <path>` once before publishing the doc. The
pattern `*/workspace/*` has been in `.gitignore` since well before
arc's heartbeat doctrine was written, so this bullet was wrong from
the day it was added. Doctrine should be falsifiable against the
real ignore rules, not against an idealized layout.
