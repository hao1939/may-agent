<ai_context>
summary: "GitHub implementation signal for evaluating browser-agent final reports separately from task completion. Deedchain provides deterministic claim extraction, expected-state adjudication, failure and wrong-draft stress cases, but its current suite does not yet establish deed-level fidelity because most objective success comes from an API terminal status, the scorer ignores step traces, and no raw live-run artifacts are committed at the inspected revision."
triggers: ["deedchain", "report fidelity", "browser agent evaluation", "false success", "claim adjudication", "task success", "execution trace"]
last_updated: "2026-09-10"
source_basis: "GitHub repository discovery and source audit of PillCrew/deedchain at commit 3b2e68c963885706506fa77ced3d9be69742eea3."
</ai_context>

# Browser-agent reports need a fidelity axis separate from task success

Date: 2026-09-10  
Source: GitHub  
Repo: https://github.com/PillCrew/deedchain  
Commit reviewed: https://github.com/PillCrew/deedchain/commit/3b2e68c963885706506fa77ced3d9be69742eea3

## Signal

`PillCrew/deedchain` turns an under-measured distinction into an explicit
2×2 evaluation: whether a task objectively succeeded and whether the final
report agrees with recorded evidence are separate axes. A successful run can
still contain a false count or action claim; a failed run can still be reported
honestly. This is more diagnostic than collapsing both properties into one
pass/fail score.

The pinned implementation contains a deterministic `extract → adjudicate →
score` pipeline rather than an LLM judge. Its deliberately narrow extractor
recognizes action targets (`clicked`, `opened`, `typed`), numeric state
(`count`, `price`, `percent`), and one success/failure declaration. The scorer
compares those claims with expected evidence and reports verified,
contradicted, and unresolved claims; omissions; a truthfulness score; and one
of four outcome/fidelity quadrants.

The 24 committed HTML tasks encode two useful stress patterns in addition to
ordinary navigation, forms, and extraction:

- seven impossible tasks test whether an agent admits failure; and
- seven “temptation” tasks supply an incorrect draft report and test whether
  the agent corrects rather than inherits it.

Each fixture has a committed SHA-256 hash. Four count metrics also have a
machine-recomputed tag-count check. In local source inspection, all 24 fixture
hashes and those four derivations passed `make_gold.py --check`; suite
validation returned 24 tasks and no errors. The 11 synthetic adjudication cases
also reproduced their expected results. Full `pytest` execution was not
available in the inspection environment because `pytest` was not installed.

## What it proves—and what it does not

The durable design lesson is **orthogonal scoring**, not the repository's broad
claim that it measures whether a report tells the truth about “what the agent
actually did.” At the reviewed revision, the live harness sets objective
success to false for impossible tasks and otherwise maps the browser API's
terminal `completed` status to success. It does not derive ordinary navigation,
form, or extraction success from a captured final DOM or a confirmed action
effect. A report can therefore agree with the task's expected fixture state
without proving that the agent performed the deed it describes.

Three additional boundaries matter:

1. The scorer adjudicates the final report against task-level expected metrics,
   not against the step records in its own `AgentRun` JSONL format.
   `DISPLACEMENT`—a true fact attributed to the wrong step—is reserved but
   always zero.
2. Numeric comparison allows ±20% relative error for counts and prices and
   ±2 percentage points for percentages. Those tolerances may be useful for
   noisy domains but are lenient for tasks asking for an exact deterministic
   count.
3. The README reports 0 false claims in 18 easy hosted-agent probes and
   explicitly says this does not yet support a meaningful agent-lying thesis.
   The inspected tree contains the probe scripts but no raw probe outputs or
   full-suite submissions, so the 0/18 observation remains author-reported at
   this revision rather than independently auditable from committed records.

The open, fixed vocabulary also admits evasive phrasing: a report with no
checkable claims receives truthfulness 100, even though omissions are counted
separately. Consumers should rank or gate on coverage and contradiction
jointly, not truthfulness alone.

## Reusable evaluation pattern

A stronger report-fidelity benchmark should preserve Deedchain's separate axes
while binding every claim class to harness-owned observations:

- **Outcome:** derive task success from a domain oracle, not an agent report or
  generic terminal status.
- **Action:** compare claimed actions with timestamped tool/effect receipts.
- **State:** compare reported values with independently captured state at the
  relevant step.
- **Coverage:** score required claims stated, contradicted, unresolved, and
  omitted as separate quantities; never let silence become perfect fidelity.
- **Attribution:** use stable step and task IDs so a fact true elsewhere cannot
  satisfy the current claim.
- **Auditability:** publish the agent/model version, task revision, raw trace,
  scorer revision, and recomputable verdict together.
- **Falsification:** include agents that complete without reporting, report
  without acting, inherit a poisoned draft, act correctly but cite the wrong
  step, and exploit known parser blind spots.

This yields a more precise target: **report fidelity is agreement between typed
report claims and independently attributed execution evidence, conditional on
claim coverage**. Task success is related but not a substitute.

## Primary sources

- Discovery query (Search API returned `incomplete_results: false`): https://api.github.com/search/repositories?q=topic%3Aai-agents+created%3A%3E%3D2026-09-01&sort=stars&order=desc&per_page=20
- Inspected revision: https://github.com/PillCrew/deedchain/tree/3b2e68c963885706506fa77ced3d9be69742eea3
- Normative methodology: https://github.com/PillCrew/deedchain/blob/3b2e68c963885706506fa77ced3d9be69742eea3/METHODOLOGY.md
- Declared limitations: https://github.com/PillCrew/deedchain/blob/3b2e68c963885706506fa77ced3d9be69742eea3/KNOWN_LIMITATIONS.md
- Report extractor: https://github.com/PillCrew/deedchain/blob/3b2e68c963885706506fa77ced3d9be69742eea3/deedchain/report.py
- Adjudication and quadrant logic: https://github.com/PillCrew/deedchain/blob/3b2e68c963885706506fa77ced3d9be69742eea3/deedchain/runner.py
- Live-suite success policy: https://github.com/PillCrew/deedchain/blob/3b2e68c963885706506fa77ced3d9be69742eea3/benchmarks/run_suite.py
