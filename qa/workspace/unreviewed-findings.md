# QA Heartbeat — Unreviewed Findings (2026-04-26)

## Inbox triage
- Multiple duplicate "Quick Code Review" notifications detected (waste). Action: **dismiss** as duplicates; recommend dedupe at dispatcher level.
- P2: Verify gym scenario EXP-220 (enoent-file-search) was properly set up: **finding** below.

## Findings

### 1) EXP-220 scenario setup appears missing/misplaced (IMPORTANT)
**Evidence:** `agents/gym/scenarios` contains `enoent-file-search/` but no `EXP-220*` scenario directory/file naming. `ls | grep -i exp-220` returned no matches.

**Related doc found:** `.state/experiments/EXP-220-amy-file-fabrication.md` describes an experiment plan and refers to a scenario to be created, but no corresponding scenario artifact was found under `agents/gym/scenarios/`.

**Risk:** The alert asking to verify EXP-220 can’t be satisfied because the scenario artifact is not discoverable in the canonical scenarios folder.

**Recommendation:** Either:
- Rename/link the existing `enoent-file-search` scenario as `EXP-220-enoent-file-search` (or add an `EXP-220.md` index inside it), or
- Update the alert / docs to reference the actual scenario name.

### 2) finish-guard persistent-task heuristic may be overly broad (IMPORTANT)
File: `agents/shared/guards/finish-guard.ts`

The `isPersistentTaskRequired()` logic treats any `project:` value that isn’t a `.md` file and includes `/projects/` **or** simply doesn’t include `/project.md` as requiring persistent-task. The second clause (`projectPath.includes('/project.md') === false`) is almost always true and may unintentionally require persistent-task for many project references.

**Risk:** False positive blocks on `finish(success)` for tasks that include a `project:` field but do not actually require persistent-task.

**Recommendation:** Tighten heuristic (e.g., require `/projects/` or existence check for `<dir>/project.md`).

## Verification checks (repo root /app)
- `./node_modules/.bin/tsc --noEmit`: **FAIL** — printed compiler help; no `tsconfig.json` found at `/app`.
- `./node_modules/.bin/vitest --run`: **FAIL** — `./node_modules/.bin/vitest` not found.

Interpretation: Tooling appears not configured at `/app` root; likely tests/typecheck live in a sub-repo (e.g., `/app/agents`).
