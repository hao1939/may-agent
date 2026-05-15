# Proposal: Fix core-principles.md Principle 9 status-vocabulary corollary

**Date:** 2026-05-03
**Author:** arc
**Status:** awaiting review
**Lane fit:** out-of-lane (file is in `may-agent-docs/`, not `design/`)
**KE:** KE-580
**Related KEs:** KE-570, KE-571, KE-573, KE-579 (drift family)

## Problem

`agents/shared/may-agent-docs/core-principles.md` line 118 (Principle 9, Corollary) currently says:

> Status fields use the same vocabulary everywhere: active/blocked/done/paused.

This is the doc that INDEX.md instructs every new agent to "Read first." The claim is falsified by the runtime in every direction (full evidence in KE-580):

- Projects table has 0 rows in `done`, 0 in `blocked`, 0 in `paused`. Terminal status is `closed` (per ORDER-014).
- Sessions table has 0 rows in `active`, 0 in `blocked`, 0 in `paused`. Vocabulary is `done/error/interrupted/running`.
- Projects and sessions share zero status tokens with each other after `done` is excluded from projects (where it has 0 producers).

So the asserted "everywhere" vocabulary exists in *nowhere*.

## Recommended fix (option A — minimal, no doc dependency)

Replace line 118 of `core-principles.md`:

**Current:**
```
**Corollary:** Don't invent new conventions when existing ones work. File locations are fixed (see common-sense.md conventions table). Naming follows `<domain>.<action>` for events and metrics. Status fields use the same vocabulary everywhere: active/blocked/done/paused. Check if a convention already covers your need before creating anything.
```

**Proposed:**
```
**Corollary:** Don't invent new conventions when existing ones work. File locations are fixed (see common-sense.md conventions table). Naming follows `<domain>.<action>` for events and metrics. Status fields are **domain-specific** — projects use one vocabulary, sessions use another (`done` means different things in each). Before introducing a new status in any domain, read that domain's doc (projects.md, sessions.md) and check the actual table contents. Don't assume a unified status model — there isn't one.
```

Rationale:
- Removes the false uniformity claim.
- Keeps the "don't invent new conventions" intent.
- Directs agents to verify against the runtime, not the doc.
- Does not depend on projects.md / sessions.md being fixed first (those are tracked in KE-579 / KE-570 proposals).

## Alternative fix (option B — document actual vocabularies)

If you prefer to be specific, add a small status-vocabulary table:

| Domain | Statuses (runtime) | Terminal |
|--------|---------------------|----------|
| `projects` | `active`, `paused`, `waiting`, `closed`, `archived`, `complete` | `closed` (per ORDER-014) |
| `sessions` | `running`, `done`, `error`, `interrupted` | `done` / `error` / `interrupted` |
| (other domains) | see domain doc | — |

This requires KE-579 and KE-570 fixes to land first (otherwise the table contradicts those docs). Option A is independent.

## Why this matters

P9 is currently used by agents as the architectural justification for "follow the convention." When the convention named in P9 doesn't exist:

1. New orchestrators write `**Status**: done` and loop to safety cap (the failure ORDER-014 was added to prevent — but ORDER-014 didn't update P9).
2. Investigations querying `WHERE status='blocked'` return zero rows and lead to "no problems found" conclusions when problems exist under different status names.
3. Agents cite P9 to reject status-vocab proposals, when the actual system is already non-uniform.

This is the same drift pattern as KE-570/571/573/575/576/577/579, but at the root: the "Read first" doc is itself wrong. Fixing P9 stops the drift from re-propagating into new docs that cite P9 as authority.

## Verification after applying

```
$ grep -n "active/blocked/done/paused" agents/shared/may-agent-docs/core-principles.md
(no output expected)
```

And no agent reading core-principles.md should come away believing project status `done` exists in the runtime.

## Lane note

`core-principles.md` is in `may-agent-docs/` (not `design/`), which is out of arc's direct-edit lane per heartbeat.md priority-1.5 (lane check). Hence proposal, not direct edit.
