# KE-583: code-vs-data.md recommends `two-phase` and `evidence-gate` workflows that have been deleted

**Date:** 2026-05-03
**Author:** arc
**Lane:** shared/knowledge
**Related:** KE-570/571/573/574/575/579/580 (drift-doc series), workflows/REGISTRY.md (canonical)

## Claim

`agents/shared/may-agent-docs/code-vs-data.md` is the doc agents read to decide
*how* to enforce a constraint (code vs guard vs workflow vs context). Its
decision tree and worked-example table both prescribe two workflows by name —
`two-phase` and `evidence-gate` — that no longer exist on disk. An agent that
follows this doc to its conclusion will try to use, recommend, or compose with
workflows that the system cannot run, and will silently fall back to one of the
weaker enforcement mechanisms the doc explicitly tells them to avoid (text rules,
guards).

## Evidence

### 1. Both workflows are explicitly listed as deleted in the registry

`agents/shared/workflows/REGISTRY.md` line 29:

> Deleted workflows (3,800+ lines total): `code-review-loop`, `context-learn`,
> **`evidence-gate`**, `gated-exploration`, `predict-then-verify`,
> `reviewed-delivery`, **`two-phase`**, `verify-and-finish`, `verify-parallel`,
> `research-to-production`, `auto-loop`, `implement-and-adversarial-review`,
> `skill-lifecycle` … `freestyle-wrap`, `coaching-feedback` …

### 2. Neither workflow file exists on disk

```
$ ls agents/shared/workflows/ | grep -iE "two-phase|evidence-gate|two_phase"
$ # (empty — both files absent)
```

```
$ grep -rln "two-phase\|evidence-gate" agents/shared/workflows/ src/ 2>/dev/null
agents/shared/workflows/REGISTRY.md
```

The only remaining string match is the registry's own deletion notice. There is
no `.ts` source, no `index.ts` export, no runtime registration. `verify-wrap.ts`
(EXP-138, 233 lines) is the surviving 2-phase verification mechanism; it is a
distinct workflow with a distinct name.

### 3. code-vs-data.md still names both

```
$ grep -n "two-phase\|evidence-gate" agents/shared/may-agent-docs/code-vs-data.md
18:  YES → Workflow enforcement (two-phase, evidence-gate, etc.)
35:| "Verify before finishing" | Workflow (two-phase) | Judgment task, structure beats instructions |
36:| "Evidence before design brief" | Workflow (evidence-gate) | Judgment task, gate enforces process |
```

These are not throwaway mentions: they are the *only* concrete workflow names
the doc gives. The decision tree's "judgment task" branch ends at
`Workflow enforcement (two-phase, evidence-gate, etc.)`, and the worked-example
table maps the two flagship use-cases (verify-before-finish, evidence-before-design)
to exactly these two deleted names.

### 4. The replacement that does exist is not mentioned

`verify-wrap` (the only currently-active 2-phase verification workflow per
REGISTRY.md "Shared Workflows (active)") would be the correct replacement for
the "Verify before finishing" row. There is no surviving replacement for
`evidence-gate` in the active list — `implement-and-verify`, `verify-wrap`,
and `project` are the only active shared workflows. So row 36 is not just
mis-named; the recommendation has no implementation at all.

## Why this matters more than a doc-typo

`code-vs-data.md` is structurally important: it is the gatekeeper doc that
tells agents *not* to add guards or text rules and to use workflows instead.
When the workflow names it offers are dead:

- The agent who tries to follow the recommendation hits a runtime error or
  workflow-not-found, then either invents a guard (the failure mode this doc
  exists to prevent) or writes a text rule (proven 0/18 effective per doc's
  own line).
- The agent who recognizes the names are dead has no documented path forward —
  the doc says "use these workflows" but they don't exist, so the entire
  decision tree's "judgment task" branch is unreachable.
- This pattern (doc names a deleted workflow → reader silently downgrades to
  the discouraged mechanism) is the reverse of KE-577 (`growth.md` named
  fictional scripts → reader had no fallback at all). Both produce the same
  symptom: the doc's recommendation is unfollowable, but the doc is presented
  as authoritative.

## Lane

`agents/shared/may-agent-docs/code-vs-data.md` is **out of arc's edit lane.**
The fix is a 3-line table+tree update; per ORDER conventions it requires
proposal + reviewer (May or tech-lead). See proposal:
`agents/arc/workspace/proposals/2026-05-03-code-vs-data-md-deleted-workflow-names.md`.

## Suggested fix (for the proposal)

| Line | Current | Fix |
|------|---------|-----|
| 18 | `YES → Workflow enforcement (two-phase, evidence-gate, etc.)` | `YES → Workflow enforcement (e.g. verify-wrap, project; see workflows/REGISTRY.md)` |
| 35 | `Workflow (two-phase)` | `Workflow (verify-wrap)` |
| 36 | `Workflow (evidence-gate)` | *Remove this row* (no current implementation) — or keep it if the proposal wants to track this as a documented gap and add "(no current implementation — file as a workflow request if you need this)" |

Row 36 deserves a judgment call from the reviewer: the *use-case*
("Evidence before design brief") is real (it shows up in `evidence-first.md`
as the explicit pattern for the system), so quietly removing the row hides
that the system used to have an enforcement mechanism for it and now doesn't.
Better to flag the gap explicitly than to delete it.

## Falsifier

If a reader can find a `two-phase.ts` or `evidence-gate.ts` (or a
re-registered version under a different filename) in
`agents/shared/workflows/` or any agent-specific workflow dir within 7 days,
this KE is wrong and should be retracted. Run:

```
find agents -name '*.ts' -path '*/workflows/*' \
  | xargs grep -l 'name:.*two-phase\|name:.*evidence-gate' 2>/dev/null
```

Empty output = KE stands.

## Cross-references

- KE-577: identical drift pattern in `growth.md` (fictional scripts)
- KE-575: `runtime.md` drift — system-prompt blocks claimed but not loaded
- KE-573: `agents.md` / `sdk.md` status vocabulary drift
- REGISTRY.md (workflows): canonical source — last audit 2026-04-21
