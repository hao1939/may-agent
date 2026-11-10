<ai_context>
summary: "A pinned harness-evaluation repository reports 560 trials across seven model–harness cells. Its 20 public dev tasks were too saturated to distinguish pass rates, while metered cost per solved task still varied materially. Benchmark reports should therefore publish separate resolution verdicts for outcome quality, cost, and operational completeness rather than treating one null result as either a tie or a useless run."
triggers: ["g-harness-evals", "harness benchmark", "model fixed harness comparison", "cost per solved task", "benchmark saturation", "minimum detectable difference", "evaluation resolution"]
last_updated: "2026-11-10"
source_basis: "HN item 50430971 and static inspection of garrytan/g-harness-evals at commit 1c26ae409de0c90c32f5becd33a2aa7c311e7ef7; Scout did not rerun analyses, trials, models, graders, or metering."
</ai_context>

# Harness Benchmarks Need Separate Quality and Cost Resolution Verdicts

**Date:** 2026-11-10  
**Source:** https://news.ycombinator.com/item?id=50430971  
**Repo:** https://github.com/garrytan/g-harness-evals  
**Inspected revision:** [`1c26ae409de0c90c32f5becd33a2aa7c311e7ef7`](https://github.com/garrytan/g-harness-evals/tree/1c26ae409de0c90c32f5becd33a2aa7c311e7ef7)

## Observation

The repository compares plain agent harnesses while holding the model and task
set fixed. Its current matrix records seven cells and 560 trials: Claude Code,
OpenClaw, Hermes Agent, and QM on Opus 5.5; Codex, OpenClaw, and Hermes Agent on
GPT-6.1 Sol; 20 public multi-user dev tasks; and four repetitions per task.
The checked-in report says requests were metered through a proxy, outcomes were
graded from simulated-world state and event logs, and per-trial receipts are
published for keyless analysis.

The useful result is not a harness ranking. Every preregistered pass-rate
comparison was reported as **“can't tell apart.”** Fourteen of 20 tasks had no
power to separate cells: 11 passed in every cell and three failed in every cell.
Observed pairwise gaps were 0 to 3.9 percentage points, below reported minimum
detectable differences of 7.7 to 14.2 points. The report therefore labels the
method `FIX-METHOD` and calls for harder tasks rather than promoting overlapping
point estimates into a leaderboard.

The same run still resolved an operational contrast. On Opus, reported cost per
solved task was $0.44 for OpenClaw, versus $0.19 to $0.24 for the other three
harnesses. The repository attributes much of the gap in a separate cost
breakdown to repeatedly sent context and cache writes. This cost evidence is
not a performance ranking: the report labels the cost differences descriptive,
with no preregistered cost test, and the pass-rate task set was saturated.

## Reusable finding: resolution is a vector

A benchmark should not receive one global label such as “valid,” “null,” or
“inconclusive.” It may resolve different questions differently:

1. **Outcome resolution:** Can the task set separate success rates at the effect
   size that matters? Report floor and ceiling tasks, pairwise discordance,
   uncertainty, and minimum detectable difference.
2. **Resource resolution:** Are tokens, list-price spend, cache behavior, retries,
   excluded trials, and cost per solved task measured consistently enough to
   support a resource comparison?
3. **Operational completeness:** Did every planned trial start and settle, and
   which cells are incomplete, cap-stopped, timed out, or missing charges?
4. **Causal resolution:** Was the intended factor isolated? Here, comparisons
   hold a model fixed within each family, while Claude Code and Codex are not
   compared because they cannot run the same model. QM's network was not held
   fixed, so its contrasts are explicitly secondary.

This prevents two common errors. A null quality result is not a tie when the
benchmark lacks resolution. Conversely, saturation on quality does not erase a
well-observed cost signal. Each claim should carry its own denominator,
uncertainty, exclusions, and verdict.

## Evidence boundaries

This is producer-authored evaluation evidence. Scout inspected the pinned README,
matrix report, report standard, scoreboard references, and focused cost,
rule-placement, and prompt-cut findings. Scout did not rerun the analysis scripts,
regrade receipts, execute the 560 trials, verify provider billing, or inspect all
per-trial artifacts. The repository says the tasks are public dev tasks rather
than held-out confirmation. Two OpenClaw cells were incomplete on the final task,
QM's network differed, and one timed-out OpenClaw charge sits outside its trial
record's interval basis. The public repository also states that its commit dates
cannot independently prove preregistration order.

## Primary evidence

- [HN item 50430971](https://news.ycombinator.com/item?id=50430971)
- [Repository README and headline matrix](https://github.com/garrytan/g-harness-evals/blob/1c26ae409de0c90c32f5becd33a2aa7c311e7ef7/README.md)
- [Harness × model matrix report](https://github.com/garrytan/g-harness-evals/blob/1c26ae409de0c90c32f5becd33a2aa7c311e7ef7/docs/benchmarks/2026-11-04-matrix-mu/report.md)
- [Report and claim-writing standard](https://github.com/garrytan/g-harness-evals/blob/1c26ae409de0c90c32f5becd33a2aa7c311e7ef7/docs/report-standard.md)
- [Focused harness-cost finding](https://github.com/garrytan/g-harness-evals/blob/1c26ae409de0c90c32f5becd33a2aa7c311e7ef7/findings/harness-cost/README.md)

## Related Scout knowledge

- [Harness Lift Needs a Comparability Receipt and an Audit-Coverage Receipt](./2026-09-15-harnessmark-lift-and-audit-coverage.md)
- [Harness optimization needs held-out outcomes and case-level budgets](./2026-08-08-arxiv-harness-optimization-evaluation.md)
- [Agent Evaluation Patterns](../agent-evaluation.md)
