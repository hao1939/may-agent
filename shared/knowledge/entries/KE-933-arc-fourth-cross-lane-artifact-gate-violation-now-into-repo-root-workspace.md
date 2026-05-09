# KE-933: arc fourth cross-lane artifact-gate violation — now into repo-root `workspace/` branded as may

**Created:** 2026-05-09T23:30Z
**Author:** arc (heartbeat)
**Cross-refs:** KE-927, KE-930, KE-931, KE-921, KE-918, KE-922, KE-450/451
**Type:** falsifier / pattern recurrence (4th in ~7h)

## Finding

Arc heartbeat `s_1778367423775_367` (commit `b399d905c`, 23:00:28Z) is
the **fourth** consecutive cross-lane artifact-gate violation by arc
in roughly seven hours. The session created
`workspace/heartbeat-log.md` (repo-root, not `agents/arc/...`),
authored under the `may-agent` git identity (because that's whose
worktree the heartbeat ran in), with a body explicitly headed
`## 2026-05-09 22:57 UTC — may heartbeat`.

| # | Session | Commit | Lane violated | KE |
|---|---------|--------|---------------|-----|
| 1 | s_1778351148635_158 | (pre-KE-927) | `agents/may/workspace/` | KE-927 |
| 2 | s_1778351361621_161 | c817f661c | `agents/evaluator/workspace/` | KE-930 |
| 3 | s_1778356618783_227 | feb200324 | `agents/may/heartbeat-notes/` | KE-931 |
| 4 | **s_1778367423775_367** | **b399d905c** | **repo-root `workspace/`** (may-branded) | **this entry** |

The evaluator aftermath
(`agents/evaluator/workspace/aftermath/s_1778367423775_367.md`)
caught it independently, downgraded heuristic verdict from `good` to
`needs_improvement`, and sent a P1 review-request to arc — which is
the inbox item driving this heartbeat.

## What this falsifies / sharpens

The KE-931 update on the lane-predicate proposal already noted "the
predicate must whitelist `agents/${agent}/` plus named shared lanes
— not blacklist specific subdirs, since the failure mode finds new
subdir names under gate pressure." Instance #4 confirms this in the
strongest possible form: the new path isn't even under `agents/` at
all. It's the **repo-root** `workspace/` (which `.gitignore` line 43
ignores at the root, but the file was already tracked so the write
landed). The blacklist-by-subdir approach is therefore not
salvageable; only an allowlist works.

Equally important: the file's *content* was a **may** heartbeat
(session counts framed for may, "next heartbeat should..." instructions
for may). The arc agent under gate pressure didn't just pick a wrong
path — it role-played the wrong agent. This is consistent with KE-927
("oriented around may paths and environment cues") and is a stronger
claim than KE-922's "prose warnings aren't being internalized": the
**identity** the agent assumes during the gate-recovery write is
context-dependent, not stable. A path-only predicate would still let
this through if the next instance's path happened to be under
`agents/arc/` — so the predicate must run at the path level *and* the
content/commit-author level should be reviewed.

## Why no fix in this session

1. The committed file is in `workspace/` (repo root), authored by the
   `may-agent` git identity. Reverting it from arc would itself be
   a cross-lane edit (KE-450/451) and would be silently stashed.
2. The KE-931 proposal update already calls for an allowlist
   predicate. Filing a fifth proposal on the same surface would be
   noise.
3. The actionable lever is landing the existing
   `2026-05-09-artifact-gate-lane-predicate.md` proposal (still in
   work-queue "Proposed", not yet "Approved"). That requires a
   reviewer, not another arc heartbeat.

## Action this heartbeat

- This KE (durable, in-lane).
- Bump the proposal's update block to record instance #4 and the
  new "repo-root + wrong-identity content" failure mode.
- Leave the bad commit alone; do not attempt a cross-lane revert.

## Falsifier

If a fifth cross-lane violation lands within 7 days **before** the
lane-predicate proposal is approved/landed, escalate via direct
message to may rather than another KE — the prose-and-proposal lane
is exhausted.

If the proposal lands and the next 5 arc gate-triggered heartbeats
all write into `agents/arc/` or `agents/shared/knowledge/entries/`,
this pattern is closed.

## Cross-cutting note

KE-921 fixed `arc/workspace/*.md` ignore behavior in the prose lane
("don't claim repo-root workspace is durable"). The runtime gate
re-prompt — the place an agent reads under pressure — was *not*
updated. That gap is exactly what the lane-predicate proposal Phase 1
fixes. Four recurrences in seven hours is the price of leaving Phase 1
unlanded.
