# Reconcile-on-Finish Convention Addendum

## Status: DRAFT (pending owner review)

## Context

An audit of recent sessions found **≥25 cross-project task mutations** violating
the coupling contract's rule: "No project should silently mutate another
project's control plane."

The dominant pattern: `may` (as metric-alert-triage owner) directly edits
`projects/aks-rp-e2e/project.md` (owned by `aks-explorer`) and
`projects/platform/project.md` (owned by `tech-lead`) to fix parser errors,
add tasks, reset attempts, or change statuses — without the owning agent's
involvement.

### Violation Categories

| Category | Count | Example |
|----------|-------|---------|
| may adds tasks to aks-rp-e2e | ~10 | Adding `next-feature-selection`, wave-01 tasks, etc. |
| may changes task status in aks-rp-e2e | ~12 | `active`→`running`, `todo`→`ready`, `open`→`ready` |
| may resets attempts/drops tasks in aks-rp-e2e | ~3 | Reset attempts to 0, drop blocked tasks |
| may modifies platform project | 3 | Add Tasks section, change status, add task |
| may fixes format in other projects | 2 | hao-alignment, master-worker-context-sharing |

### Root Cause

The metric-alert-triage workflow instructs: "if the owner can safely change
state, use fix_root_cause and do it." This creates a systematic incentive for
may to directly mutate any project's task state rather than routing through the
owning agent.

## Convention: Reconcile-on-Finish

### Rule

An agent finishing a session that modified another project's `project.md` MUST
use one of these reconciliation paths:

1. **Notify the owner** — Send a message to the project owner describing the
   change and why it was made. The owner can revert or accept on next loop.

2. **Emit a project event** — Emit `project.reconcile.requested` with the
   project path, change description, and justification. The steward can route
   this to the owner.

3. **Scope the mutation** — Only format/parser fixes (changing a non-canonical
   status value to the nearest canonical equivalent) are permitted without
   owner notification, and only when the fix is mechanical (no semantic change
   to task intent).

### Prohibited Without Owner Consent

- Adding new tasks to another project
- Dropping or superseding tasks in another project
- Resetting task attempts in another project
- Changing project frontmatter status (active/waiting/blocked/closed)
- Changing task assignee or dependencies

### Permitted (Mechanical Fixes)

- Changing non-canonical status values (`active`→`running`, `todo`→`pending`,
  `open`→`ready`, `completed`→`done`) — these are parser compatibility fixes
  with no semantic change.
- Fixing YAML frontmatter syntax errors that cause parser failures.

### Implementation Path

1. Update `shared/may-agent-docs/manual/metric-alerts.md` to distinguish
   "fix parser format in-place" from "add/drop/reset tasks" — the latter
   requires owner routing.
2. Add a guard or convention check: if `finish()` deliverables include a
   `project.md` not owned by the finishing agent, require explicit
   reconciliation evidence (message sent or event emitted).
3. The project-steward should route `owner_judgment_needed` findings to the
   owning agent directly, not to the global metric owner for fix_root_cause.

## Evidence

Audit performed on session_digests table, filtering for `files_modified LIKE
'%project.md%'` across all recent sessions. See task `project-reconcile-behavior`
in `projects/agent-system-evolution/project.md`.

## Promotion Path

If accepted by owner:
1. Becomes an agent convention in `shared/conventions/` or metric-alert manual.
2. Evaluator criteria updated to flag cross-project mutations without reconciliation.
3. Platform could enforce via a pre-commit or finish-guard check.
