# Development workflow PoC review

Date: 2026-09-15. Disposition: retain the opt-in experiment for review; do not
activate it in the running May App yet.

## Finding

The [design](development-workflow.md) works for a small local coding outcome.
An App workflow can enforce verification and review while agents judge the
design, implementation and requirement changes. It needs no additional Task
controller or workflow recovery service. The useful next step is an isolated
May-to-Task integration pilot, not more stages or a general workflow framework.

This is evidence of feasibility, not evidence that two profiles outperform one
agent. Bob designs and reviews; review is separate from implementation, but
does not provide a second independent design opinion.

## Actual model experiment

The trial used the real Host workflow runner, agent manager, profile builder,
structured finish, file/shell tools and the requested model routes. Runtime
state and repository worktrees were isolated. Task reads and settlement were a
fixture controller around the actual SDK result contract.

The starting parser used `parseInt`, so `2h` incorrectly returned `2`.

| Invocation                                                                                   | Observed outcome                                                    | Wall time | Agent calls |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------: | ----------: |
| Initial requirement: whole minutes or hours; reject malformed, negative and fractional input | Committed, checked and reviewed parser                              |  86.068 s |           3 |
| Fresh invocation, same requirement and accepted evidence                                     | Same accepted commit; no model or verification rerun                |   0.021 s |           0 |
| Corrected requirement: also accept `1h 30m`, reject negative components                      | New committed, checked and reviewed parser on the same fixture Task |  63.991 s |           3 |

Each active invocation called Bob (GPT-6 Astra) for design, tech-lead (GPT-5.6
Sol) for direct implementation, and Bob for review. All 44 recorded tool calls
completed without tool errors. Bob used only `read` and `finish`; tech-lead used
file tools, local Git, Node checks and `finish`. There was no delegated coding
worker, public write or deployment. Independent assertions outside the editable
verification script also passed. The baseline checkout stayed unchanged.

Two judgments were useful:

- Bob noticed that JavaScript's `$` anchor can admit a final newline and asked
  for complete-input validation and a regression assertion.
- After correction, Bob found that a candidate-added rejection of `1h 30m`
  contradicted the new acceptance. It directed tech-lead to remove that one
  superseded rejection while retaining all original assertions. The corrected
  implementation and checks passed.

The fixture retained Task ID `goal/duration-poc`; the correction changed its
generation from 1 to 2. This was a direct fixture update, not a human message
through May or a proof of Host creator-authority enforcement.

## Measured usage

The metrics candidate recorded all 22 model replies across the six calls.
These are the provider-reported token categories as recorded by the Host;
cached tokens are shown separately rather than hidden in a single input total.

| Profile                 | Calls | Replies | Uncached input | Cache read | Cache write | Output |
| ----------------------- | ----: | ------: | -------------: | ---------: | ----------: | -----: |
| Bob / GPT-6 Astra       |     4 |       8 |             24 |     13,771 |       9,557 |  2,283 |
| Tech-lead / GPT-5.6 Sol |     2 |      14 |             42 |     63,096 |      12,696 |  3,816 |
| Total                   |     6 |      22 |             66 |     76,867 |      22,253 |  6,099 |

The recorded catalog cost estimate was $0.2182 for the initial outcome and
$0.1946 for the correction, about $0.4128 combined. These are estimates, not
an invoice or verified endpoint pricing. The unchanged invocation had no
model calls. All calls used full context preparation; this trial does not
compare preparation strategies or establish cache savings against a baseline.

For a trivial parser, two judgments plus implementation are substantial
overhead. The benefit being tested is a useful separation of judgment and
enforced checks. Measure real project changes before making it the default
for every code edit.

## Mechanical checks and review iterations

App `bun run check` passed typechecking, formatting, and **23 tests with 99
assertions**. Tests exercise real temporary Git worktrees and subprocesses,
with scripted agent decisions. They cover failed verification, repairs and
redesign, continuation after repair allowance exhaustion, malformed decisions,
clarification feedback, a changed requirement during implementation, dirty
work after cancellation, and fresh input after an accepted result.

The final review added checks proving that changes during verification or
review cannot inherit passing evidence, and that a pass containing unresolved
findings is rejected. A shared primary checkout is rejected before agent calls.
These checks supplement model behavior; they do not depend on a model choosing
the right answer during a test.

The companion Host change passed full `bun run ci`: **3,063 passed, 3 skipped,
0 failed; 13,650 assertions**. The skips are installation-catalog checks that
require an explicit deployment tree. No container build or live rollout was
part of this experiment.

An additional isolated check used the normal Host agent loader with the
companion model registry. It discovered `may-bob` and `may-tech-lead`, selected
the exact requested models, and assembled the expected tools. The loader
also provides its standard scoped `tasks` tool. A later source inspection for
the local pilot found that it includes fact publication and creator-authorized
updates, even in the current read-only allowlist. The direct model harness
omitted that capability, so its lack of Task side effects does not prove the
same property for a normally loaded profile. File/shell restrictions and Task
authority must be assessed separately during activation.

Setup failures were kept distinct from product failures:

- The first App run used an older SDK test helper without `ctx.signal`.
  Selecting the reviewed SDK fixed that dependency mismatch.
- Sparse checkout initially omitted an existing Host-role instruction file
  needed by an existing App test. Restoring that fixture path fixed the test.
- The loader probe initially expected only configured preset tools and missed
  the automatic Task tool. The assertion was corrected. The description was
  later corrected again after inspecting its mutation actions; a passing tool
  name list alone had not proved a read-only boundary. No new Host workaround
  was added.

## Source and reproduction

- App base: `06980019a1e19fef431f5bf9223cc3da303db811`. The commit containing
  this report holds the PoC source, tests, profiles and temporary harness.
- Executed workflow blob: `dfa688fc19f00d83eb935ce874c0c0db570718df`.
- Executed harness blob: `83a2eec66d883fba49219ee1fffcd6220e4ff0ba`.
- Actual model-run Host/SDK: `d2f39dc9c22b1dd0c6f6db4ef98cd342d0c8ace8`, the
  context-metrics candidate. Its registry lacked GPT-6; the isolated harness
  selected the exact catalog model in memory, without a model substitution.
- Companion Host registry: `5cf932679dd5b7b0b9c3a4c64685bf8d4a81d628`, based on
  `83a27430794abf49a5ebb3f14a58af387bb8cccb`. Its loader conformance and full
  CI passed. Large-context behavior was not tested; its 400k trial cap is an
  operational limit, not a claim about the endpoint's full capacity.
- Fixture baseline: `842b418acdfb127ddedf65782f53e403d31d114b`.
- Initial candidate: `92be5bfd616cea3002302ff9cb8400d1ababb5f7`.
- Corrected candidate: `3bb612013d40b8651f7448666289e9b9cafbdc97`.

In a checkout with the matching SDK dependency installed, run `bun run check`
from `projects/may.app`. For another authorized model trial, set
`MAY_HOST_SOURCE` to the reviewed Host checkout, set `MODEL_BASE_URL` and any
required `MODEL_API_KEY` privately, then run `bun poc/run.ts --live`. The harness
prints its new evidence directory and retains fixture results, workflow
records, transcripts and the synthetic repository. The metrics candidate is
needed to reproduce the usage table; the model-registry change alone adds no
usage collector. Do not put endpoint credentials or raw transcripts in source.

The harness stays on this explicit experiment branch. It should be removed
when the isolated integration pilot replaces it, unless a recurring consumer
justifies retaining it. No permanent generic PoC service is proposed.

## Remaining scope and next pilot

Keep the current loop small. Its result is a local candidate, not a fulfilled
request for remote CI, a merged PR or deployment. Cached verification assumes
an unchanged local toolchain and ignored dependencies; a new input can request
rechecking when the environment changes. Large repositories and long builds
were not tested: subprocesses have a 120-second/2-MB bound and one invocation
has three repair rounds. The original agent-call caps were 180 seconds and
40 operations; the local integration trial exhausted the time limit during
report authoring. Agent calls now inherit the Host's remaining workflow
allowance and cancellation instead of those additional overrides.
Failed or exhausted attempts return ordinary incomplete feedback. Larger work
should first be split into suitable outcomes or use existing async capabilities.

The next isolated pilot should accept a plain-language request through May,
create one development Task through the ordinary App route, confirm its actual
project worktree, deliver a correction while it runs, interrupt one attempt,
and check that its result returns to the same Request. This closes the untested
boundaries: routing, scheduling, workspace allocation, creator authority and
notification recovery. Use the existing Host mechanisms for each boundary;
add no workflow-specific event handling or recovery path.
