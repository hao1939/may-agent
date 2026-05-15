# Proposal: code-vs-data.md — replace deleted workflow names (`two-phase`, `evidence-gate`) with current registry-active equivalents

**Date:** 2026-05-03
**Author:** arc
**Connects:** KE-583 (this finding)
**Lane:** `agents/shared/may-agent-docs/code-vs-data.md` is **outside arc's edit lane.** Asking May or tech-lead to land the patch.

## Problem

`agents/shared/may-agent-docs/code-vs-data.md` recommends two workflows by name
(`two-phase`, `evidence-gate`) in both its decision tree and its worked-example
table. Both workflows were deleted; `agents/shared/workflows/REGISTRY.md` line
29 lists them in the "Deleted workflows" set, and `ls agents/shared/workflows/`
confirms neither file exists. See KE-583 for full evidence.

The doc's purpose is to redirect agents *away* from text rules and guards
toward workflows. When the named workflows don't exist, an agent following the
recommendation will silently downgrade to the very mechanisms the doc tells
them to avoid.

## Proposed Change — single file, three line edits

Patch target: `agents/shared/may-agent-docs/code-vs-data.md`

### Edit 1 — Decision tree (line 18)

Replace:
```markdown
Is this about JUDGMENT (agent makes wrong decision)?
  YES → Workflow enforcement (two-phase, evidence-gate, etc.)
        NOT text rules (0/18 proven), NOT guards (brittle)
```

With:
```markdown
Is this about JUDGMENT (agent makes wrong decision)?
  YES → Workflow enforcement (e.g. verify-wrap for verification gates,
        project for iterative judgment loops; see
        agents/shared/workflows/REGISTRY.md for the active set)
        NOT text rules (0/18 proven), NOT guards (brittle)
```

### Edit 2 — Examples table row "Verify before finishing" (line 35)

Replace:
```markdown
| "Verify before finishing" | Workflow (two-phase) | Judgment task, structure beats instructions |
```

With:
```markdown
| "Verify before finishing" | Workflow (verify-wrap) | Judgment task, structure beats instructions; verify-wrap (EXP-138) is the surviving 2-phase verification workflow |
```

### Edit 3 — Examples table row "Evidence before design brief" (line 36)

Replace:
```markdown
| "Evidence before design brief" | Workflow (evidence-gate) | Judgment task, gate enforces process |
```

With:
```markdown
| "Evidence before design brief" | **No current implementation** — `evidence-gate` was deleted (REGISTRY.md). File a workflow request, or use `project` with an explicit evidence-check first iteration. | Judgment task; the system used to have a dedicated gate and currently does not |
```

(The use-case is real — `evidence-first.md` codifies it as the system's
canonical pattern — so the row should stay, but the recommendation must be
honest that no enforcement workflow exists.)

## Why one file, not joint

Unlike the common-sense.md / projects.md vocabulary drift (proposal
2026-05-02-common-sense-and-projects-md-status-vocabulary.md, which required
atomic landing because piecemeal edits rotate the contradiction), this is a
local naming error in one doc. No other doc names these workflows by string —
verified:

```
$ grep -rln "two-phase\|evidence-gate" agents/shared/may-agent-docs/
agents/shared/may-agent-docs/code-vs-data.md
```

(REGISTRY.md mentions them only as deleted; that mention is correct and
should stay.) Single-file patch.

## Risks

- **Risk:** A workflow named `two-phase` or `evidence-gate` is reintroduced
  later. **Mitigation:** Re-add the row when the workflow ships. The proposal
  errs toward "describe what code does today."
- **Risk:** The `verify-wrap` recommendation in Edit 2 is itself stale.
  **Mitigation:** Verified 2026-05-03 against `REGISTRY.md` "Shared Workflows
  (active)" table — `verify-wrap.ts` 233 lines, EXP-138, listed as one of
  three active shared workflows.
- **Risk:** Edit 3 sounds like a downgrade ("no current implementation"). It
  is, but it's the truth. The alternative — silently dropping the row — hides
  a documented capability gap. The current text already lies; the patch makes
  the gap visible and actionable (file a workflow request).

## Out of scope

- Whether to rebuild `evidence-gate` as a workflow. That is a design proposal,
  not a docs proposal. KE-583 §"Suggested fix" notes the gap; this proposal
  just stops the doc from claiming the gap is filled.
- Whether REGISTRY.md should grow a "deprecated names" appendix mapping old
  names to current replacements. Possibly worth doing for the entire
  KE-570…KE-583 drift series (8+ docs naming dead artifacts). Track separately.

## Suggested commit shape

```
cd /app/agents && git commit -m \
"may-agent-docs: code-vs-data.md — replace deleted workflow names \
(two-phase, evidence-gate) with current registry equivalents (KE-583)" \
shared/may-agent-docs/code-vs-data.md
```
