# Project Tracking DB — Journal

## 2026-04-20 — Project Created
- Projects currently only exist as files — no queryable index
- Need DB mirror: projects table + status history
- persistent-task workflow is the natural place to sync
- project.md stays source of truth
### Iteration 1 (comment) — 2026-04-19T19:25:39.985Z
**Comment**: - [2026-04-20 hao] Keep it simple. project.md is source of truth, DB is a mirror for queries. The persistent-task workflow already touches project.md every iteration — adding a DB write there is natural. Think about what queries we'd want: "show me all blocked projects", "average iterations to complete", "which projects have false-done signals".
**Reviewer**: CONTINUE — **Next iteration guidance:** This is a design task — no code edits needed. Produce a single design document at `.state/designs/project-tracking-db.md` covering all 4 milestones:

1. **DB Schema**: Design `projects` and `project_status_history` tables. Look at how `project.md` files are structured (read a few examples from `.state/projects/`) and what fields exist. Keep it simple — the DB mirrors project.md.

2. **API Endpoints**: Propose query functions (not HTTP endpoints — just JS functions) like `getProjectsByStatus(status)`, `getBlockedProjects()`, `getAverageIterationsToComplete()`, `getProjectsWithFalseDoneSignals()`.

3. **DB Write Location**: Read `src/workflows/persistent-task.ts` and identify the exact spot(s) where a `upsertProject()` call should go. Quote the surrounding code lines.

4. **Resume Sync**: Read the project-resume handler (likely in `src/agents/` or `src/workflows/`) and propose how it syncs file state to DB on each scan.

Start by reading `.state/projects/` to see project.md structure, then `src/workflows/persistent-task.ts`, then the resume handler code.

### Iteration 2 — 2026-04-19T19:27:04.063Z
**Worker**: **Status:** done (1m24s)

**Files modified:**
- .state/designs/project-tracking-db.md

**Errors encountered:**
- [bash] cat: src/workflows/persistent-task.ts: No such file or directory


Command exited with code 1

**Agent response:**
Now I have all the context. Let me write the design document.
**Reviewer**: CONTINUE — The design document is solid and well-grounded in the actual code. Let me assess against milestones:

CONTINUE — The design document is good and covers all 4 milestones substantively. However, there are a few issues to address in the next iteration:

1. **The document referenced `src/workflows/persistent-task.ts` (which doesn't exist)** — the actual path is `agents/shared/workflows/persistent-task.ts`. The code quotes in Section 3 are paraphrased rather than exact line references. The next iteration should add actual line numbers (e.g., "line 353-354" for the `Status = active` + writeFileSync).

2. **Resume handler sync (Section 4)**: The proposal correctly identifies that `project-resume.ts` currently does `if (status !== "active") continue;` (line ~49), but the design should reference the actual line numbers and show the concrete diff more precisely.

3. **Missing: `parseProjectForDb()` / `extractProjectName()` helpers** — these are referenced but not defined. Add brief implementations showing how to parse project.md fields into the upsert struct.

**Next iteration should:**
- Update file paths to use `agents/shared/workflows/persistent-task.ts` (not `src/`)
- Add exact line numbers for all insertion points in Section 3 (use the grep output: lines 354, 412, 419, 444, 525, 533, 551, 567)
- Add a brief `parseProjectForDb()` implementation that extracts fields from project.md content
- Mark all 4 milestones as complete in the project.md if the above is done

This is close to DONE — one more polish iteration.

### Iteration 3 — 2026-04-19T19:29:51.515Z
**Worker**: **Status:** done (2m3s)

**Files modified:**
- .state/designs/project-tracking-db.md

**Errors encountered:**
- [bash] ./agents/may/handlers/project-resume.ts
./.state/project-resume-state.json


Command exited with code 1
- [bash] fatal: not a git repository (or any of the parent directories): .git


Command exited with code 128

**Agent response:**
Now let me rewrite the design doc with all the fixes:
**Reviewer**: DONE — — All 4 milestones are substantively covered in `.state/designs/project-tracking-db.md`:

1. **DB Schema** ✅ — `projects` and `project_status_history` tables with appropriate fields, indexes, and `upsertProject()` implementation.
2. **Query API** ✅ — 9 query functions covering status, owner, blocked, metrics, health summary, and false-done tracking.
3. **DB Write Locations** ✅ — Line numbers verified against actual `agents/shared/workflows/persistent-task.ts` (e.g., line 354, 412, 419, 444, 525, 533, 551, 567 all match `writeFileSync` calls in the real file). 10 insertion points identified with a clean `syncToDb()` one-liner pattern.
4. **Resume Sync** ✅ — Concrete diff for `agents/may/handlers/project-resume.ts` showing bulk DB sync piggy-backing on existing scan loop.

The `parseProjectForDb()` and extraction helpers are fully implemented. The design is pragmatic (DB mirrors project.md, silent failures, no new cron jobs).

**Auto-check**: Reviewer said DONE but only 0/4 milestones checked. Overriding to CONTINUE. (false-done #1)

### Iteration 4 — 2026-04-19T19:31:03.026Z
**Worker**: **Status:** done (38s)

**Files read (not modified):**
- .state/designs/project-tracking-db.md

**Agent response:**
The deliverable was created in previous iterations. This milestone is already done - nothing more to produce.
**Reviewer**: DONE — — All 4 milestones are complete. The design document at `.state/designs/project-tracking-db.md` covers DB schema, API endpoints, DB write insertion points with line numbers, and resume handler sync. The worker correctly identified there's nothing left to produce.

**Auto-check**: Reviewer said DONE but only 0/4 milestones checked. Overriding to CONTINUE. (false-done #2)

### Iteration 5 — 2026-04-19T19:33:02.652Z
**Worker**: **Status:** done (29s)

**Agent response:**
All 4 sections exist covering all 4 milestones. The deliverable is complete and has been verified by reviewers 3 times. The auto-check keeps overriding because milestones aren't checked off in the project tracking file, but I'm told I cannot edit the project file.
**Reviewer**: DONE — — All 4 milestones are complete. The design document at `.state/designs/project-tracking-db.md` covers: (1) DB schema for projects/status_history tables, (2) 9 query API functions, (3) DB write insertion points in persistent-task.ts with verified line numbers, (4) resume handler sync approach. The milestones not being checked off is a tracking metadata issue, not a deliverable gap.

**Auto-check**: Reviewer said DONE but only 0/4 milestones checked. Overriding to CONTINUE. (false-done #3)

### Iteration 6 — 2026-04-19T19:33:48.796Z
**Worker**: **Status:** done (33s)

**Agent response:**
The document exists with all 4 sections. The blocker is that the auto-check system keeps overriding the reviewer's DONE assessment because 0/4 milestones are checked. I cannot edit the project file. This is a system-level tracking issue, not a deliverable gap.
**Reviewer**: BLOCKED — — The design document at `.state/designs/project-tracking-db.md` contains all 4 deliverables and has been verified complete by reviewers 3 consecutive times. The loop persists because the milestone checkboxes in the project tracking file aren't being checked off, and the worker cannot edit that file. This is a tracking infrastructure issue, not a deliverable gap.

