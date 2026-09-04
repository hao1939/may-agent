<ai_context>
summary: "HN finding on Terminal-Bench-Science 0.1: expert-authored, artifact-graded scientific workflows improve task realism, but a continuous benchmark deliberately calibrated against each frontier needs fixed anchor cohorts and task-lineage reporting; otherwise changing resolution rates confound model progress with task admission, retirement, and verifier revision."
triggers: ["Terminal-Bench-Science", "continuous benchmark", "scientific agents", "benchmark anchors", "task admission", "moving benchmark", "resolution rate", "scientific workflow evaluation"]
last_updated: "2026-08-28"
source_basis: "HN item 49472820, the Terminal-Bench-Science 0.1 announcement, repository README, and tagged v0.1.0 release."
</ai_context>

# A Continuous Benchmark Needs a Fixed Anchor Cohort

Date: 2026-08-28  
Source: https://news.ycombinator.com/item?id=49472820  
Repo: https://github.com/harbor-framework/terminal-bench-science  
Release: `v0.1.0`

## Signal

HN surfaced Terminal-Bench-Science 0.1, a benchmark of 70 terminal-based tasks
contributed and reviewed by researchers across five scientific domains. Tasks
cover artifacts such as analyses, simulations, proofs, code, and data products,
and use task-specific reproducible tests rather than answer-only grading. The
announcement reports three independent trials per task and a 30.0% resolution
rate for the strongest evaluated system, leaving substantial headroom.

The strongest methodological signal is upstream of the leaderboard. The project
reports 920 proposals, 464 approvals to implement, 386 opened pull requests, and
70 tasks admitted to v0.1. Domain reviewers assess scientific validity and
realism, technical reviewers inspect construction and verification, and a final
bar raiser checks quality. Benchmark realism is therefore not produced merely by
asking experts for questions; it depends on a selective **task-admission
pipeline** that converts research work into reproducibly gradable artifacts.

That strength creates a longitudinal measurement problem. The project is also a
continuous benchmark: future releases will add tasks, retire saturated or
underspecified ones, improve existing tasks, and calibrate additions against the
then-current frontier. A headline resolution-rate change between releases will
therefore mix at least four effects:

```text
system capability change
+ admitted-task mix change
+ verifier/task revision
+ retirement and frontier-calibration policy
```

**Reusable interpretation:** a benchmark can optimize for current frontier
discrimination or preserve a stable progress ruler, but it cannot infer both
from one changing aggregate. Continuous benchmarks need fixed anchor cohorts and
explicit task lineage alongside their live frontier score.

## Evidence and boundaries

- Version 0.1 contains 70 tasks spanning life, physical, Earth, mathematical,
  and engineering sciences. Tasks include data analysis, statistical inference,
  simulation, optimization, theorem proving, image reconstruction, inverse
  problems, calibration, model fitting, and scientific machine learning.
- The announcement reports that every system evaluated on both datasets scored
  more than ten percentage points lower on Terminal-Bench-Science 0.1 than on
  Terminal-Bench 3.0. This demonstrates deliberate difficulty, not by itself
  greater realism or better prediction of research usefulness.
- Reported resolution rates range from 30.0% for Claude Opus 5 with Claude Code
  to 3.3% for GPT-5.6 Luna. The same page reports materially different cost and
  token Pareto frontiers: GPT-5.6 Sol matches Claude Fable 5's resolution at
  less than one-third of its dollar cost, while Fable uses fewer tokens. A
  single accuracy ranking would hide these deployment tradeoffs.
- The repository asks operators to run oracle solutions five times and report
  flakes. This is a useful verifier-health check, but an oracle passing on one
  environment does not establish that tests reject scientifically wrong but
  artifact-compatible approaches.
- Domain-expert contribution improves provenance and relevance, yet the admitted
  set remains selected for objective terminal verification and current-model
  difficulty. Scientific work whose value depends on long time horizons,
  physical experiments, tacit judgment, negative results, or non-terminal
  collaboration may be systematically underrepresented.
- This finding inspects the public announcement, README, and release metadata;
  Scout did not independently run the 70 tasks or reproduce the leaderboard.
  The reported scores and trial costs remain project-authored results.

## Reporting contract for evolving benchmarks

Publish at least three views rather than replacing one release score with the
next:

1. **Frozen anchor score:** identical task versions, verifier versions, harness,
   and aggregation, rerun across model generations.
2. **Live frontier score:** the current curated release, clearly labeled as a
   changing challenge set rather than a time-series ruler.
3. **Lineage bridge:** results on tasks shared between adjacent releases, with
   additions, edits, retirements, and reasons reported separately.

Also expose proposal-to-admission counts by domain, verifier flake rates, task
version, per-task trial variance, dollar cost, and token cost. Retired tasks
should remain queryable with their retirement reason. Saturation, ambiguity,
leakage, and broken infrastructure are different events and should not collapse
into “removed.”

For scientific-agent evaluation specifically, pair reproducible artifact tests
with selective expert audit and perturbation checks. A file can satisfy a test
while resting on an invalid scientific mechanism; changing assumptions, data
regimes, or boundary conditions can reveal that gap better than another run of
the same verifier.

## Primary sources

- HN discussion: https://news.ycombinator.com/item?id=49472820
- Announcement and leaderboard discussion: https://www.terminal-bench-science.ai/announcement
- Repository: https://github.com/harbor-framework/terminal-bench-science
- Tagged release: https://github.com/harbor-framework/terminal-bench-science/releases/tag/v0.1.0
- Version DOI: https://doi.org/10.5281/zenodo.22110254
