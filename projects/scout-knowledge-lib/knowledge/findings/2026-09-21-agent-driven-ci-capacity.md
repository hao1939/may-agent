<ai_context>
summary: "Linear reports that agent-accelerated code and test production shifted its bottleneck into CI. The reusable response is to measure queue-to-verdict latency and runner consumption separately, remove repeated setup before adding shards, optimize small fan-out gates, and make any weaker-isolation fast path an explicit test-file contract that coding agents also receive."
triggers: ["agent coding", "CI capacity", "test growth", "runner minutes", "test sharding", "critical path", "generated tests", "test isolation"]
last_updated: "2026-09-21"
source_basis: "Linear engineering article and current HN item read on 2026-09-21; reported production measurements were not independently reproduced."
</ai_context>

# Agent-Driven Test Growth Makes CI a Capacity-Control Problem

Date: 2026-09-21  
HN: https://news.ycombinator.com/item?id=49792067  
Source: https://linear.app/now/ci-bottleneck-reworked  
Coverage: complete public article and the three HN comments present at review time

## Signal

Linear reports that coding agents now write the majority of its tests and that
its suite nearly quadrupled during 2026, with roughly 2,000 tests being added per
week. Faster code production did not remove the feedback constraint: every pull
request still passed through CI. The company therefore optimized two different
quantities—how long a pull request waits for CI and how much runner time each
test consumes—rather than treating parallelism as a universal speedup.

The reported interventions show why those measures must stay separate:

- Faster runners reduced like-for-like job duration by 34% on average, and the
  native TypeScript compiler reduced the type-check median by 73%.
- Narrowing checkout and dependency installation reduced small fan-out gates
  and repeated setup. Consolidating seven short checks into two jobs reportedly
  saved about 87,000 runner-minutes per month, or 11.8% of usage.
- Moving from four to eight API-test shards became economical only after setup
  per shard fell from 110–140 seconds to about 40 seconds. Before that work,
  doubling shards would have duplicated more setup time than test time.
- Opting selected Vitest files out of per-file module isolation produced the
  largest single saving, but Linear calls it the highest-correctness-risk
  optimization. Eligibility is explicit, teardown is required, unsafe files
  remain isolated, and the constraint was added to the coding-agent skills that
  generate tests.

The overall self-reported result was a reduction in pull-request wait from more
than six minutes to just over five while machine time per test roughly halved,
even as the suite grew. The article estimates the unoptimized suite would now
take about eleven minutes.

## Operational pattern

Treat CI as a bounded verification service whose demand can grow faster than
human review when agents produce code and tests:

1. **Track latency and consumption independently.** Measure queue-to-required-
   verdict latency, critical-path duration, runner starts, setup time, and total
   runner-minutes. A faster wall-clock result can still consume more capacity.
2. **Profile fan-out gates first.** A small checkout or cache lookup that blocks
   every shard has more leverage than its isolated runtime suggests. Remove
   unnecessary repository data and non-verification writes from that path.
3. **Reduce fixed cost before adding concurrency.** Prebuild stable tools,
   install only the relevant workspace slice, and compare cache restore time
   against rebuilding. Increase shards only after measured setup duplication is
   lower than the parallelism benefit.
4. **Make fast paths enforceable authoring contracts.** If tests may share
   module state, require explicit eligibility, teardown, and negative examples;
   expose the same rule to human and agent authors. Generated tests should not
   silently enter a weaker isolation mode just because it is cheaper.
5. **Re-measure as the suite grows.** Use per-test and per-change-normalized
   measures alongside aggregate spend so that increasing output volume does not
   disguise a regression or make a one-time benchmark permanent policy.

The non-obvious implication is that agent throughput changes verification
capacity planning. Scaling generation without budgeting the independent
feedback path merely moves the queue; scaling CI with unconstrained sharding can
turn that queue into hidden infrastructure spend or weaker test isolation.

## Evidence boundary

The measurements and statement about agent-authored tests come from Linear's
own engineering article. Scout read the current HN item and all three comments,
which suggested Bazel and duration-aware balancing but supplied no independent
measurements. Scout did not inspect Linear's private workflows, reproduce the
benchmarks, or validate the cost accounting. The exact gains are therefore
case-specific reports; the reusable contribution is the measurement split,
fixed-cost ordering, and explicit correctness boundary around shared-state test
execution.
