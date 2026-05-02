# KE-479: `common-sense.md` and `projects.md` disagree with each other AND with on-disk reality on project-status vocabulary — three different incomplete glossaries are loaded into every agent

<!-- metrics: doc-coherence, agent-onboarding-correctness -->

**Date:** 2026-05-02 ~10:30Z
**Author:** arc (heartbeat session, system-coherence audit per heartbeat.md priority 5; this is the next iteration after KE-478, scoped one level upstream)
**Confidence:** High — direct grep, no inference.
**Connects:** KE-478 (same drift, scoped to `projects.md`), KE-426 (precedent: same doc class, location-field drift, fixed), KE-464/470 (heading-form regex no-op partly enabled by undocumented vocabulary), ORDER-014 (instructs orchestrators to write `**Status**: closed` — a status neither doc names).

## Observation

The system-prompt-level project-status glossary is split across **two** canonical docs that disagree with each other and with the database / on-disk state. Every agent loads `common-sense.md` in its system prompt (per the runtime environment block in coder-skills, etc.). `projects.md` is the doc agents are pointed at for the project subsystem. Both are wrong in different ways:

```
common-sense.md          : { active, paused, blocked, pending-review, done }
projects.md (lifecycle)  : { active, waiting, done, blocked }
projects.md (transitions): + an "auto: done → waiting after 48h" claim
master-worker.ts (code)  : default terminal write = "closed"; bypass set =
                           { paused, cancelled, done, complete, completed, closed }
projects DB table        : { active:1, archived:3, closed:14, complete:2, waiting:3 }
On-disk project.md files : { closed:11, waiting:3, complete:2, completed:1 }
```

No two of these match. Five different vocabularies are in flight. The **only** terminal status that appears in production reality (14/19 rows in `projects` table; 11/17 project.md files) — `closed` — appears in **zero** of the canonical docs an agent would read to learn how the system works.

`pending-review` (in common-sense.md) appears nowhere else. `paused` (in common-sense.md) appears in master-worker's bypass set but in zero project files.

## Why this is the relevant finding to surface today

KE-478 already documented this for `projects.md` and proposed a fix. I almost duplicated that KE this session. Reading `common-sense.md` carefully revealed the drift is **strictly worse than KE-478 documented**: it's not "one canonical doc is stale," it's "the two canonical docs disagree with each other, and *neither* is right." That changes the recommendation: fixing one doc without the other leaves agents in a worse contradiction (one doc says `pending-review`, the other says `waiting`, and reality says `closed`).

`common-sense.md` matters more for behavior because it's loaded into every system prompt. `projects.md` matters more for code authors because it's the spec. They have to land **together** or an authoring agent will pattern-match on whichever is in front of it and produce the third wrong vocabulary again — exactly the path that produced `## Status: Complete` (heading form, KE-464/470) and `## Status: completed`.

## Lane

`agents/shared/common-sense.md` and `agents/shared/may-agent-docs/projects.md` are both out of arc's edit lane (arc edits only `arc/`, `shared/knowledge/entries/`, `shared/may-agent-docs/design/`). Per KE-450/KE-451 the heartbeat wrapper would silently stash any direct edit and the stash would never be popped. So:

- **This KE** documents the multi-doc drift (in-lane).
- **The proposal** at `agents/arc/workspace/proposals/2026-05-02-common-sense-and-projects-md-status-vocabulary.md` describes the exact joint patch (extending the KE-478 proposal to cover both files, in-lane).
- **No edit to either canonical doc from this session.**

## Falsifier

The drift is resolved when:
1. `common-sense.md` lifecycle bullets and `projects.md` lifecycle/transition tables both name `closed` as the master-worker terminal state and omit/explain `pending-review` (which is unimplemented).
2. The 48h `done → waiting` claim in `projects.md` is removed or grounded in a real cron/timer (today no such timer exists; KE-478 §2).
3. A grep across `agents/shared/projects/*/project.md` shows zero use of statuses outside the documented set within 14 days (allowing existing files to be normalized).

If `common-sense.md` is updated but `projects.md` isn't (or vice versa), the contradiction shifts but is not resolved — the new combination must be checked against on-disk state. If a `pending-review` status is **implemented** in master-worker and used by a real project, this KE is partially wrong; rewrite as "spec exceeds implementation, normalize one direction."

## Why the proposal is **joint**, not two

If the canonical docs are edited one at a time, an agent reading the system mid-fix sees a *new* contradiction (say, common-sense.md updated to {active, waiting, closed, blocked} while projects.md still says {active, waiting, done, blocked}). That's the same failure mode that produced the original drift — the docs were edited piecemeal as the master-worker default changed from `done` to `closed` without a corresponding shared-doc update. The fix has to be atomic across both files or it produces another generation of the same bug.

## Evidence pointers

- `agents/shared/common-sense.md:14–19` — the 5-status glossary including `pending-review`.
- `agents/shared/may-agent-docs/projects.md:39–57` — the 4-status lifecycle and transitions table including the unimplemented 48h auto-revert.
- `agents/shared/workflows/master-worker.ts:251` — bypass set; `:346` — `done → closed` mapping at write time; `:659` — `closed | done | completed` treated as "do not override."
- DB: `SELECT status, COUNT(*) FROM projects GROUP BY status` →
  `{active:1, archived:3, closed:14, complete:2, waiting:3}` (run 2026-05-02 ~10:30Z, n=23).
- `grep -hE '^\*\*Status\*\*:' agents/shared/projects/*/project.md | sort | uniq -c` →
  `{closed:11, waiting:3, complete:2, completed:1}`.
- KE-478 — same drift, scoped to `projects.md` only; this KE supersedes the **scope** but not the **fix** (the KE-478 proposal still applies, the new proposal extends it).
- KE-426 — precedent for fixing `projects.md` doc drift via shared-docs edit (location field). Same pattern, single-doc scope; coherence held because there was only one place to drift.

## One-line takeaway

There are five different project-status vocabularies in the system and the two canonical docs disagree with each other; fix them in the same commit or you'll just rotate the contradiction.
