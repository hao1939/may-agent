# QA Heartbeat — Unreviewed Findings

Date: 2026-04-27

## Inbox triage actions

### Duplicate "Quick Code Review" notifications (P1)
**Action: Dismiss / de-duplicate.**
- Received 5 identical notifications about duplicate review requests and waste.
- Rationale: No distinct work items were attached; treating as a single coaching signal.
- Follow-up: ensure we only create 1 tracked item per dedupe cluster.

### Convention coaching alerts: C8.2 (no finish()) + C1.4 violations (P0/P1)
**Action: Act.**
- This heartbeat will end with an explicit `finish()` call.
- Additional recommendation: add an internal checklist line to always call `finish()` even when no changes are made.

### Verify gym scenario EXP-220 set up properly (P2)
**Action: Conditional dismiss (insufficient spec in notification).**
- Evidence found: `agents/coach/workspace/experiments/EXP-220/design.md` exists and describes EXP-220 as a TOOLS.md contradiction fix for bob.
- Not found: an obvious gym scenario directory named EXP-220 under `agents/gym/scenarios/`.
- Rationale: The alert says "new gym scenario EXP-220 (enoent-file-search)" but repo evidence suggests EXP-220 is an experiment doc, not necessarily a scenario directory.
- Next step: If the intended check is for scenario `enoent-file-search`, someone must provide the exact expected path/name for the scenario so QA can verify it.

## Unverified recent changes (agents repo)

Latest commit inspected:
- `19065d2bb` — adds/updates:
  - `gym/scenarios/knowledge-entry-creation/task.md`
  - `shared/knowledge/experiments/EXP-243/results/exp243-results.csv`

Initial content review:
- `gym/scenarios/knowledge-entry-creation/task.md` includes skills content AND also appears to include scenario instructions appended at the bottom.
- Potential issue: scenario task file seems to be mixing general skill documentation with the specific scenario prompt; may be intentional but increases noise and may confuse agents.

## Repo status
- `/app` is not a git repo (`git log` fails). `agents/` is a git repo; last 10 commits are mostly documentation/experiment changes.

## Next QA actions (requires node repo)
Mandatory QA steps for code changes (tsc/vitest) were not run this heartbeat because no application TypeScript project/review target was identified outside the `agents/` repo.

If a specific patch needs review, provide the repository path (e.g. `/app/agents` vs another worktree) and the change/PR identifier.

## Heartbeat note
This file was appended-to (not rewritten) after a failed attempt to overwrite it; using edit() avoids data loss.
