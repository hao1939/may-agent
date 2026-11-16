# Manual agent trials — 2026-11-16

Completed: **five whole-benchmark runs, twelve trials: ten pass, one fail,
one invalid**. All selected labels remain draft. Tech-lead's failure and
invalidity require evaluation diagnosis, described below; neither has been
silently reclassified.

The user requested hands-on trials for each agent after broadening Alex's daily
review to the whole system. This is a finite manual familiarization pass, outside
the standing Task: read the target's plan, commission one complete benchmark,
inspect the actual output and scoring evidence, and retain one supported next
action. It does not start five improvement incidents or change the daily schedule.

| Target | Complete benchmark | Reason for this first trial |
| --- | --- | --- |
| May | `bounded-task-completion` v1 | Observe an actual local repair, preservation and verification. |
| Alex | `improvement-stage-selection` v1 | Observe the choice of a proportionate improvement mechanism. |
| Bob | `adoption-and-simplicity` v2 | Compare rejection of an unjustified migration with evaluation of a real gap. |
| Tech-lead | `repair-and-verification` v1 | Distinguish source defects from incorrect tests and choose bounded verification. |
| Scout | `research-evidence` v1 | Distinguish missing required evidence from a complete bounded assessment. |

Commission one trial per case with the adjacent production model and the plan's
four-minute subject timeout. Use at most one new whole-benchmark run per target,
five total, with no automatic retries or candidate-verification runs in this pass.
Prior evidence and unresolved incident budgets remain intact. Missing Bob/Scout
plans are measurement-coverage gaps, not evidence that either agent is defective.

All labels remain at their existing review status. These trials do not approve
truth, select promotion baselines, authorize adoption or prove production quality.
May includes execution; the other selected benchmarks evaluate decisions only.
Record unexpected scorer/runtime problems separately from agent failures and
retain the original failed evidence rather than rerunning for a green result.

Commands run from `/app`:

```bash
bun run gym:plan validate projects/may.app/agents/may/evaluation-plan.json
bun run gym test --plan projects/may.app/agents/may/evaluation-plan.json --benchmark bounded-task-completion
bun run gym test --plan projects/alex.app/agents/alex/evaluation-plan.json --benchmark improvement-stage-selection
bun run gym test --plan projects/alex.app/agents/bob/evaluation-plan.json --benchmark adoption-and-simplicity
bun run gym test --plan projects/alex.app/agents/tech-lead/evaluation-plan.json --benchmark repair-and-verification
bun run gym test --plan projects/scout-knowledge-lib.app/agents/scout/evaluation-plan.json --benchmark research-evidence
```

Admission/timing receipts and the finite run ledger are retained in
`/app/.state/gym-agent-manual-20261116/`. The underlying Gym run directories retain
the exact commissioned plan, inputs, tested candidate, transcripts and verdicts.
The [structured audit](agent-reports/agent-manual-trials-20261116.json) binds all
five run identities, commissioned plans, raw artifacts, transcripts, verdicts,
cost estimates and the observations below.

One process issue was visible before the trials: the older
[capability-improvement skill](../../alex.app/agents/alex/skills/gym-capability-improvement/SKILL.md)
prescribes a prompt → skill → workflow progression, filtered baseline examples,
and promotion after a passing gate. Current benchmark/plan rules instead require
diagnosing the responsible layer, complete compatible benchmark assignments for
plan coverage, and separate adoption/application authority. This pass uses those
current rules and leaves production guidance unchanged. The mismatch is a
documentation/process lead, not a measured agent failure.

## Results and what to inspect

| Target | Pass / fail / invalid | Command elapsed | Subject estimate | Grader estimate | Total model estimate |
| --- | --- | ---: | ---: | ---: | ---: |
| May | 1 / 0 / 0 | 44.842 s | $0.0911680 | $0.2347619 | $0.3259299 |
| Alex | 1 / 0 / 0 | 29.385 s | $0.0523560 | $0.1793789 | $0.2317349 |
| Bob | 3 / 0 / 0 | 78.530 s | $0.3896510 | $0.3905230 | $0.7801740 |
| Tech-lead | 1 / 1 / 1 | 102.921 s | $0.3080760 | $0.4056968 | $0.7137728 |
| Scout | 4 / 0 / 0 | 249.313 s | $0.4237928 | $0.4039308 | $0.8277236 |

The five commands took 504.991 seconds in total, excluding operator work and
inspection between commands. Model estimates total **$2.8793352**, comprising
$1.2650438 for twelve subject sessions and $1.6142914 for sixteen grader sessions.
All 28 session transcripts have complete reply-cost estimates; billed cost,
operator effort and full-cycle cost remain unknown. Grader durations can overlap,
so do not add them to produce a wall-clock duration. Bob used its configured
`gpt-6-astra`; the other subjects used their configured `gpt-5.6-sol`. These are
different tasks/models, not a controlled cross-agent cost or quality comparison.

- **May:** open the retained `task-result.json`, final `config/preview.json` and
  transcript. It changed only `requestTimeoutMs` from 30 to 30000, preserved the
  other settings and unrelated draft, then ran `node scripts/check-preview.cjs`.
  The checker passed and returned the exact final config hash. This is the one
  execution trial; no new May tuning target was demonstrated.
- **Alex:** the decision defers a proposed 250-line redaction workflow and
  inspects the existing context/tool/output boundary first. It permits a direct
  mechanical repair when diagnosis warrants it. This synthetic decision does not
  resolve the real cumulative-review-round accounting defect already in its plan.
- **Bob:** compare its three outputs together: remove a redundant entry point,
  reject a migration with no demonstrated value, and support a one-hour reversible
  comparison for a concrete parser gap. The last case helps distinguish
  proportional judgment from an unconditional preference for existing code.
  `workflow-ownership` was not run in this pass.
- **Tech-lead:** the test-correction decision passed. The source-repair case is
  invalid because the graders disagree about specification grounding. The
  publication case failed a lexical gate despite preserving the boundary in the
  actual structured result. The [frozen-scorer probe](agent-reports/manual-scorer-probe-20261116.json)
  also passes an explicit recommendation to publish without a May delivery Task.
  See the [diagnosis and controls](benchmark-scoring-gaps.md). The original
  machine scores remain unchanged; repair evaluation before using this result
  for agent tuning. Its production guidance also contains example phrases
  matching these cases, so familiar-case results do not prove generalization.
- **Scout:** compare the first and fourth outputs. Required unread sections
  correctly produce `incomplete`; supplied Section 4/Appendix B evidence supports
  `converged`, with 128 → 110 ms consistent with the rounded 14% claim. Its other
  decisions preserve an authoritative note and separate a technical candidate
  from low-signal reference context. No live retrieval or library publication was
  performed. This was the longest command; its receipts support a future
  efficiency question if daily-work evidence justifies one, not an automatic
  Scout change.

All five commands exited zero, including Tech-lead's run with a fail and invalid
trial. Process success establishes completion of the run; read the manifest
verdicts before judging quality. May's outer console capture initially recorded
a stream object instead of its output; canonical trial/session/checker evidence
was complete and used. Capture was fixed for later targets without repeating May.

## Direction after this pass

The next useful manual improvement is the **publication-boundary evaluation**:
use the original result, equivalent field-only restatement and contradictory
publication answer as controls. Assess complete production result semantics,
including `result.reason`; do not solve the defect by adding one more allowed
phrase. Align source-specification evidence requirements with the actual task
and calibrate the disputed case before drawing a quality conclusion. A changed
scorer or definition needs a fresh whole-benchmark baseline and existing truth
gates. This pass used its five-run allowance and did not perform that repair.

Keep production agent guidance unchanged. May, Alex and Tech-lead retain their
existing improvement context, while Bob and Scout now have explicit plans and
history reports. No baseline was promoted, truth approved, candidate applied or
App Task triggered. The standing system-wide Alex Task and daily deadline remain
independent. Alex still owns later system-wide prioritization; these findings
give it concrete evidence rather than a fixed requirement to change each agent.
