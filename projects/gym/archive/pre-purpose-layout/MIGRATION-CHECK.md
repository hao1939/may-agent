# Purpose-layout migration check

This records a structural move, **not an agent benchmark result or approval**.
The prior Gym source revision was `d3dd6ade7d`. No models were run.

## Preservation checks

- **6,091 original tracked files** in the old global case tree and eight old
  benchmark folders have byte-identical archival copies.
- **Two existing Gitlinks** retain their original commit references. They were
  already embedded repositories, not portable fixture contents; relocation does
  not repair or expand that historical compatibility guarantee.
- **119 resolved cases** were captured before the loader/layout changed. All
  original capture fingerprints were checked unchanged before comparison.
- **531 task/expectation/fixture/semantic paths**, all 119 resolved metadata
  objects and all 119 per-case approval records match the new owners. The capture
  comparison accounts for the `scenario.json` → `case.json` spelling change.
- Generic decision/Task-result scorer implementations are unchanged. Location-only
  delegation wrappers remain in the archive; active suites bind evaluators explicitly.
- All 119 IDs remain present, with one active owner each: **70 previously approved
  labels and 49 draft labels**. All **17 core labels remain draft**. Twelve extra
  retired-case labels stay in the original archived catalog, not active review.
- Existing `.state/benchmarks/` inputs, results, approvals and reviews were not
  migrated or rewritten. New layouts require fresh matched baselines.

The temporary pre-move capture supplied an independent one-time comparison.
`test/purpose-layout.test.ts` also reconstructs archived definitions and checks
resolved tasks, fixtures, rubrics, metadata and approval records against the new
owners. Those tests are implementation evidence, not proof the answers are right.

## Execution checks

- Gym build/type checks and **321 Bun tests**, plus **6 Node/scorer tests**, pass.
- All **119 active cases / eight purpose benchmarks** pass ownership/structure checks.
- All **1,488 benchmark review checks** pass.
- The Gym App comparison adapter's **12 tests** pass with purpose-local fixtures.
- A separate **tracked-files-only checkout** builds, validates all 119 active
  cases, passes the purpose-layout tests and passes the six Node/scorer tests.
  Missing empty fixture folders are materialized as empty inputs; Git need not
  retain empty directories.
- Legacy validation in the original working tree reports **616 runnable,
  zero errors and 483 metadata/partial-case warnings**. These are historical
  diagnostic inventory numbers, not additional curated coverage or a claim that
  every archived fixture is independently portable.
- The old benchmark script alias reaches the new purpose command and rejects a
  deliberately invalid trial count before execution. The state path was blocked
  as an additional no-model-call safeguard.

The relocated intent canary keeps approval provenance, but automatic scheduling
is disabled pending a fresh baseline/review. Exact expectation review, permission
for model runs and any agent-change approval remain separate outstanding decisions.
