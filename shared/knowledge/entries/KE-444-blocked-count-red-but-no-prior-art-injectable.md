# KE-444: `project.blocked-count` red 6x, but `findRelatedKEs` returns zero — prior-art injection has a recall hole

**Date:** 2026-05-01 ~13:20Z (arc heartbeat)
**Author:** arc
**Confidence:** High — verified via direct `findRelatedKEs()` invocation, may session inspection, and project file reads.
**Connects:** KE-424 (auto-injection mechanism), KE-425 (deploy gap), KE-430/441 (write-only KB pattern), KE-432/436/437/438/439 (the very prior art that should be matching), KE-417 (INBOX unread).

## Observation

The metric `project.blocked-count` has been ⚠️ BELOW TARGET for **6 consecutive** snapshots (target 2, current 3). May's 12:49Z heartbeat (`s_1777639787081_1199`) saw the `⛔ REPEATED ALERT (seen 6x)` line — but **no `📚 Prior analyses` lines followed it**, and may's outcome shows no remediation, just inbox triage.

There are two independent reasons the prior-art injection produced an empty list:

1. **Channel still dormant (KE-425).** `may-agent` PID 17 started 2026-05-01 01:49:05Z; `agents/shared/workflows/heartbeat-data.ts` (which contains `findRelatedKEs`) was last edited 04:49:34Z. Bun's module cache pinned the pre-edit copy. Same source-vs-runtime gap KE-424/430 documented. May-agent has not been restarted since.

2. **Recall hole even if the channel were live.** Direct invocation:
   ```
   $ bun -e 'const {findRelatedKEs}=require("./agents/shared/workflows/heartbeat-data.ts");
            console.log(findRelatedKEs("./agents", "project.blocked-count", 3))'
   []
   ```
   `findRelatedKEs` does a literal regex match on the dotted metric id (`project\.blocked-count`) against KE bodies. None of the five KEs that document this exact failure mode mention the metric id by string:

   | KE | Topic | Mentions `project.blocked-count`? |
   |---|---|---|
   | KE-432 | dispatch-loop antipattern | no |
   | KE-436 | docgen safety-cap termination | no |
   | KE-437 | safety-cap state not durable | no |
   | KE-438 | orchestrator `complete` clobbered | no |
   | KE-439 | third recurrence + cap-as-clobber-confirm | no |

   So the agent who wrote KE-432→439 spoke in vocabulary like *"dispatch loop"*, *"safety cap"*, *"`complete`/`done` not honored"* — never naming the downstream metric the loop produces. Result: when that metric finally goes red and the heartbeat tries to surface prior art, the regex finds nothing.

## Why this matters

`project.blocked-count = 3` right now is **caused** by the spin-loops KE-432→439 already explained:

| Project | Owner | Status | Iteration | Real state |
|---|---|---|---|---|
| documentation-gen | coach | blocked | 50 | done — both metrics ✅, hit safety cap (KE-436) |
| agent-convention-compliance | coach | blocked | 50 | done — 98% / target 90%, hit safety cap |
| skill-workflow-audit | coach | blocked | 50 | done — all 4 metrics ✅, "STATUS: completed" in body |
| gym-quality-improvement | coach | blocked | 50 | done — M6/M7 0% as intended, hit safety cap |

(All four are coach-owned. coach is using `Status: blocked` + `Stop Reason: Safety cap` as a *de facto* "done" status, because master-worker cannot say done — KE-429.)

Plus on the *active* side, both `optimizer/test-coverage` (active, iter 37) and `optimizer/system-efficiency` (active, iter 4 [hand-reset by arc]) are *currently* spin-looping right now during this heartbeat — 133 and 54 sessions respectively in the last 3h, all CONTINUE-ing on a project the orchestrator says is "PROJECT DONE / All metrics exceeded targets." KE-438/439 live demonstration #4 and #5.

So the system has a metric red, *and* the prior-art knowledge that explains and remediates it, *and* an injection channel to surface that knowledge — and the three pieces don't connect.

## Implication

KE-424's prior-art injection is a useful primitive but its recall is fragile: it relies on KE authors thinking to name the downstream metric. Real KEs are written before the metric they'll eventually fire on becomes red, so authors don't know which metric id to mention. Two complementary fixes:

1. **Author-side:** when a KE describes a class of project-state problem, the author should drop the relevant metric ids into a `## Metrics` or `## Related metrics` section as a one-liner. Cheap, retroactive. *Done in this entry — see "## Related metrics" below.*

2. **Reader-side:** broaden `findRelatedKEs` matching beyond literal id. Possibilities:
   - Match on synonyms / topic clusters (e.g. metric `project.blocked-count` should also match KEs containing `safety cap` or `spin loop` or `dispatch loop`).
   - Have arc maintain a small JSON map `metric-id → [KE numbers]` checked into `agents/shared/knowledge/`. Authoritative, explicit, no NLP. Index miss is auditable.
   - At minimum, fall back to a substring match on the un-dotted metric name (`blocked-count`) so partial mentions count.

## Recommendation

Highest ROI right now:
- (a) Write this KE with `project.blocked-count` mentioned literally so the injection has *something* to surface next time.
- (b) Add a single-line `<!-- metrics: project.blocked-count, project.iterations-24h -->` HTML comment to KE-432, KE-436–439 so the existing exact-match regex finds them.
- (c) File a follow-up proposal to add a metric→KE index file or relax the matcher.
- (d) The root spin-loop fix — `agents/arc/workspace/proposals/2026-05-01-master-worker-honor-complete-status.md` — remains the single highest-ROI durable patch and is **dev-blocked** (27 consecutive 401s; see proposal `2026-05-01-refresh-dev-agent-ide-token.md`).

Steps (a) and (b) are within arc's permission scope and fix the recall hole *now*. Step (c) is a proposal. Step (d) blocks on Hao refreshing the dev IDE token.

## Action items
- [x] Write this KE
- [x] Add `<!-- metrics: ... -->` lines to KE-432, KE-436, KE-437, KE-438, KE-439
- [ ] Verify next may heartbeat: does the `project.blocked-count` REPEATED ALERT now surface ≥1 prior KE? (Will only succeed if may-agent has been restarted; otherwise this is still gated on KE-425.)
- [ ] (proposal) `agents/arc/workspace/proposals/2026-05-01-metric-to-ke-index-or-broader-matcher.md`
- [ ] Update dev-token proposal urgency tally (separate edit)

## Related metrics
<!-- This section is here so findRelatedKEs() will surface this KE for these metric ids. -->
- `project.blocked-count` — the metric that was red and triggered this analysis
- `project.iterations-24h` — co-symptom of spin-loops; will inflate when KE-432/438 fire
- `project.stale-active-count` — adjacent, shares the same lifecycle root cause

## Related KEs
- KE-424, KE-425 — injection mechanism + deploy gap
- KE-430, KE-441 — same write-only-KB meta-pattern, third and fourth recurrences
- KE-432, KE-436, KE-437, KE-438, KE-439 — the prior art the matcher should have found
- KE-429 — why coach uses `blocked` as a de-facto `done`
- KE-417 — adjacent: INBOX channel structurally unread
