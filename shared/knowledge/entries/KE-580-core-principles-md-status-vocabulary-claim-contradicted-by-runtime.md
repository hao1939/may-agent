# KE-580: core-principles.md Principle 9 cites a status vocabulary ("active/blocked/done/paused") that exists in zero domain

**Date:** 2026-05-03
**Author:** arc
**Lane:** shared/knowledge
**Related:** KE-570 (sessions.md drift), KE-571 (metrics.md drift), KE-573 (agents.md/sdk.md status-vocab drift), KE-579 (projects.md drift), ORDER-014 (closed = terminal)

## Claim
`agents/shared/may-agent-docs/core-principles.md` is the doc INDEX.md tells every new agent to "Read first." Its Principle 9 (Convention over Configuration) makes a sweeping factual claim about runtime conventions that the runtime contradicts:

> **Corollary:** … Status fields use the same vocabulary everywhere: active/blocked/done/paused. Check if a convention already covers your need before creating anything.

There is no domain in the runtime where this vocabulary is used. The claim is wrong in every direction at once: the four statuses listed don't share a domain, and the domains that do exist use different vocabularies that don't share statuses with each other.

## Evidence

### Projects table (last 24h, 23 rows)
```
$ bun -e "...SELECT status, COUNT(*) FROM projects GROUP BY status..."
[
  { status: "closed",   c: 16 },   ← terminal, 70% of projects
  { status: "archived", c: 3 },
  { status: "complete", c: 2 },
  { status: "active",   c: 1 },
  { status: "waiting",  c: 1 }
]
```
- 0 rows in `done`
- 0 rows in `blocked`
- 0 rows in `paused`
- ORDER-014 (2026-05-02): *"`**Status**: closed` is the only terminal state the entry-guard reads."*

So 3 of the 4 documented statuses (`done`, `blocked`, `paused`) have zero producers in the project domain, and the actually-terminal status (`closed`) is undocumented in P9.

### Sessions table (last 7d, 10,503 rows)
```
[
  { status: "done",        c: 10372 },
  { status: "error",       c: 94 },
  { status: "interrupted", c: 33 },
  { status: "running",     c: 4 }
]
```
- 0 rows in `active`
- 0 rows in `blocked`
- 0 rows in `paused`
- Has `error`, `interrupted`, `running` — none documented in P9.

So 3 of the 4 documented statuses don't exist in the session domain either, and 3 actual session statuses are missing from the doc.

### The two domains share exactly one word
`done` is the only token common to projects-doc-vocabulary and sessions-runtime-vocabulary — and `done` has zero producers in projects. So the "same vocabulary everywhere" claim has zero overlap with reality: not in projects, not in sessions, and not between the two.

### Cross-doc contradiction
- `common-sense.md` lists `active / paused / blocked / pending-review / done` as project statuses (also wrong per KE-579 but at least different from P9 — `pending-review` is in common-sense, not in P9).
- `projects.md` documents `active → done → waiting` (per KE-579, fictional).
- `sessions.md` (per KE-570) documents its own different vocabulary.
- `core-principles.md` claims they all use the same four words.

The "same vocabulary everywhere" claim is itself the contradiction: the docs disagree with each other, and all of them disagree with the runtime.

## Why it matters

P9 is the architectural justification for "don't invent new statuses." An agent reading P9 would:

1. **Trust the convention exists** and write `**Status**: done` in a new `project.md`. The orchestrator entry-guard only reads `closed`, so the project loops to safety cap (the exact failure ORDER-014 was written to prevent).
2. **Query `WHERE status='blocked' OR status='paused'`** to find stuck projects/sessions and get zero rows in either table.
3. **Inherit a false mental model** of the architecture: "the system has unified status everywhere" is the *opposite* of the truth. Each domain has its own vocabulary, and the runtime is loosely coupled — recognizing this is necessary to debug status-related bugs (KE-573, KE-579).
4. **Cite P9 to gatekeep proposals** that introduce a new status, when the system is already non-uniform and the rule was never enforced.

This is the highest-leverage drift in the drift family (KE-570/571/573/575/576/577/579) because P9 is the doc INDEX.md tells everyone to "Read first," and the false claim is structural — it's not a parameter that's stale, it's a foundational architectural assertion.

## What good looks like
After fix, P9's corollary should either:

**(a) Drop the vocabulary claim entirely** — keep "Don't invent new conventions when existing ones work" but stop asserting cross-domain status uniformity that doesn't exist. Replace with: "Status fields are domain-specific (see projects.md, sessions.md, etc.) — check the relevant doc before introducing a new status in a domain."

**(b) Document the actual vocabularies per domain** — projects: `active/paused/waiting/closed/archived/complete`; sessions: `running/done/error/interrupted`; with a note that `done` is overloaded across domains and means different things.

(a) is simpler and matches reality better; (b) requires sessions.md and projects.md to be fixed first (KE-570, KE-579 both file proposals for this).

## Lane
`agents/shared/may-agent-docs/core-principles.md` is in `may-agent-docs/` but **not** under `design/` — out of arc's direct-edit lane. Filing proposal at `agents/arc/workspace/proposals/2026-05-03-core-principles-p9-status-vocab-fix.md` for May/Hao to apply.

## Cross-check
- KE-579 already established that projects use `closed` not `done` (terminal).
- KE-570 already established sessions use `done/error/interrupted/running`.
- This KE is the meta-level finding: an architectural source-of-truth doc (P9) makes a uniformity claim that is falsified by the very domain docs it points to. The drift family has reached the root.

## Pattern
The recurring shape across KE-570/571/573/575/576/577/579/580: a doc claims a unified or canonical model; the runtime has multiple domain-specific models; nobody updated the doc when domains diverged. The fix is structural — design docs should describe runtime, not aspire to it. This points back to Principle 5 (evidence before systems) and Principle 11 (debug the message): every drift KE this cycle is an instance of the doc misleading the LLM.
