# Unfinished-input context experiment — October 3, 2026

**Supports:** [Task attempts and results](../../2a-design/task-attempts.md#result-contract). Checks the smallest context repair before adding repetition policy. The accepted design is integrated into that contract and the Task execution manual; this record retains trial findings and limitations.

**Status:** Isolated source experiment, deterministic checks and an authorized
bounded real-model trial. The trials did not change live App state, publish
deliverables, deploy or restart May.

**Source integration:** Host [#303](https://github.com/hao1939/may-agent/pull/303)
merged as `28726352201f52abc32bd0ac9337f7aaf1296944`. The burst-input fence
experiment and model harness are excluded. Final PR head `3a2e8d2d9` includes
current `main` and resolves the review finding with an exact `reviewAt`
assertion across database reopen. Local `bun run ci` passed 3,521 tests and
18,568 assertions, with zero failures and three existing installation-dependent
skips. GitHub Quality and Container both passed on that head. The user's merge
approval was applied through the existing administrator merge option because
the formal GitHub approval gate remained unsatisfied; no repository rule was
changed. Source merge is not deployment or proof of production recovery.

## Question and source

Does the existing execution context preserve the facts needed to distinguish an
accepted attempt from fulfilled input? Can the existing bookkeeping continue
the real requirements after an empty-scope result without repeating prior work?

Host baseline: `438ad1e38` (merged #297). Branch:
`poc/unfinished-input-context-20261003`. Baseline harness commit: `82e9782f9`.
Candidate commit: `8dd6e1bcb4b4446fba353bbf62ef4dc948f6cb9d`.
The candidate is isolated from the separate burst-input fence experiment.

The production previous-attempt projection omitted saved `inputKeys`, `continue`
and `reviewAt`. The candidate carries them through the shared SDK context, adds
one derived presentation of current work, and formats decision detail across
lines. It does not change result admission or scheduling.

## Production-path comparison

The harness uses real Task admission, claims, scoped reads, settlement and
SQLite reopen in temporary stores. Decisions are scripted, not model judgments.

| Scenario | Baseline | Candidate |
| --- | --- | --- |
| Three empty-scope convergences over six inputs | Remaining counts 6,6,6; previous-result scope omitted from shared context | Remaining counts 6,6,6; scope explicitly zero, six continuing inputs visible |
| Scripted judgment covers three of six requirements using earlier draft evidence | Three settled, three retained across restart | Same bookkeeping; next context explicitly shows coverage of three |
| Waiting result covers two inputs while independent work continues | Both remain unresolved; true wait eventually releases the worker | Same behavior; scope and continuation visible without claiming completion |
| Ninety continuing inputs with long original content | Longest detail line 165,684 bytes; bounded prompt 4,333 bytes | Longest line 1,336 bytes; prompt 5,539 bytes |

The readability comparison is bytes, not model tokens or measured savings.
The new context adds 1,206 bytes to this prompt. The guidance preserves helper
scope: shared Task facts do not expand the helper's assignment.
Formatting a file does not bound an arbitrarily long individual string. The
existing exact original-input read supports up to eight keys per call, and is
verified to reach inputs beyond the inline preview.

The repeated-worker case is deliberately retained as a negative control. Better
context does not mechanically stop an agent that ignores it. Both versions
accept the scripted subset; no behavioral improvement is inferred from that.

## Refinement and checks

The first harness run rejected a fixture's noncanonical Condition owner; it was
corrected to `app:reviewer` before recording the baseline. The first candidate
check found an SDK import at the wrong export path and an older test fixture
missing its required Task snapshot. Those were repaired. These were test/source
iteration failures, not evidence of model recovery.

Additional checks keep missing coverage unknown, preserve truncation and
last-known state after a failed refresh, and verify that current work and zero
previous coverage reach actual outgoing managed-agent requests after compaction.
The provider is scripted; no external model is called. Existing independent
waits, stale/foreign input checks and legitimate partial progress remain covered.

Baseline: four characterization tests, 22 assertions, passed. Candidate focused
checks: 76 tests, 873 assertions, passed. Full `bun run ci` on the final candidate
passed Host/SDK types, canonical boundary and lint, followed by 3,487 tests,
18,327 assertions, zero failures and three existing installation-dependent agent
catalog/configuration skips. The full test run took 227.68 seconds.

`bun run check:may-design` passed integrity, executable examples and canonical
App checks; the existing unclassified `reports` layout warning remains.
`git diff --check` passed. These are local checks, not hosted PR approval.

## Real-model trial

The follow-up used May's configured `gpt-5.6-sol` model, unchanged May identity
instructions, the ordinary managed-agent tool loop, generated Task entry and
refreshed decision brief. Both arms used real temporary SQLite admission,
claims, original-input reads and result settlement. There was no model fallback.
May's production container remained stopped. Tools were limited to local
read/edit/write, a test command, scoped Task reads and the existing finish schema.
There was no live messaging, deployment, delegation or native executor.

The assignment had six continuing inputs and no new events. A seeded accepted
result said the normalization implementation and review were complete, but
covered zero inputs. Actual files contradicted that summary: empty and
whitespace-only names were still accepted, the review requested a correction,
and two supplied tests failed. The agent had to inspect the original requirements,
repair the code, verify it and write a handoff. Clearing inputs without fulfilling
their requirements would fail the trial.

| Observation | Baseline `82e9782f9` | Candidate `8dd6e1bcb` |
| --- | --- | --- |
| Actual work | Fixed the missing validation; 3 supplied tests passed; handoff explained the review and evidence | Same correct outcome |
| Independent checks | Extra behavior assertions passed; supplied tests unchanged | Same |
| Settlement | Six inputs fulfilled; zero retained after database reopen | Same |
| Model requests in completed execution | 7 | 7, including 2 after a harness interruption |
| Reported uncached input / cached input / output tokens | 23,886 / 129,024 / 1,671 | 30,434 / 111,616 / 1,552 |
| Reported total tokens | 154,581 | 143,602 |

Seven model requests are steps within one Task attempt, not seven Task retries.
The candidate's same claim and saved transcript were resumed by the experimental
harness; it kept the existing edit and passing test evidence. This is not a
test of production daemon recovery. Both independently checked handoffs matched
the actual code and test results, and neither merely cleared the backlog.

Trial limits and failures are retained:

- The first baseline run stopped after two requests because its evidence reads
  exceeded the initial 140 KB serialized-context limit. It used 33,748 tokens,
  made no edit and settled nothing. The byte limit was raised to 400 KB for both
  compared arms. This was a harness interruption, not the original no-op loop.
- The overall allowance was 350,000 reported tokens, 32 model requests, at most
  8 requests and 2 claims per case, 2,048 output tokens per request, and 180 seconds
  per execution. The token check reserved headroom before sending each request;
  it was an experiment budget, not a new Host retry policy.
- After five requests the candidate had fixed and tested the code and written
  its handoff, but the 65,536-token reserve stopped it before finish. The reserve
  was reduced to 30,000 based on observed request usage, without increasing the
  350,000-token overall allowance. It then read back its handoff and finished in
  two requests using the retained transcript. Original and resumed receipts stay
  separate; this was not an uninterrupted comparison.
- Both agents requested a hash command combined with another local command.
  The trial's test-only shell allowance rejected it; both adapted. This artificial
  restriction consumed steps and makes a clean efficiency comparison inappropriate.
- All calls, including the interrupted baseline, used **331,931 reported tokens**:
  73,714 uncached input, 254,464 cached input and 3,753 output, across 16 requests.
  The gateway tariff is unverified; these counts are not a billed-cost claim.
  Planned standalone reuse and pending-review model controls were not run with
  the remaining budget. Their earlier scripted checks are not substitutes.

This establishes that the candidate can support real useful work and correct
settlement in the small case. The baseline also succeeded. There is no reproduced
behavioral failure to attribute exclusively to the context defect, no demonstrated
reduction in Task attempts, and no reliable token-saving estimate from one pair
with harness interruptions. The ninety-input incident and genuine external waits
still need a representative behavioral test before claiming the loop solved.

## Reproduction and limits

At baseline harness commit `82e9782f9`, with ordinary Host dependencies:

```sh
bun test src/lib/unfinished-input-context.poc.test.ts
```

At the candidate revision, characterization has become ordinary regression
coverage; there is no runtime or test environment switch:

```sh
bun test src/lib/task-work-context.test.ts src/lib/task-decision-context.test.ts src/lib/task-workspace-context.test.ts src/lib/artifacts.test.ts src/app/core/tasks/app-task-common-lifecycle.test.ts src/app/core/tasks/task-continuation.test.ts
bun run ci
```

The model harness is retained on experiment branch
`experiment/unfinished-input-model-trial-20261003`, in
`unfinished-input-model-trial.ts`. Completed baseline and initial candidate used
`33f01b68f`; candidate continuation used `ae41508a7`. The final harness at
`8c9c6676e` also requires an explicit agent source and refuses to overwrite a
retained continuation; its pending-review setup passed a dry run with zero model
calls. Local raw receipts, request
snapshots, tool events, work files and restart checks are under
`/app/.state/unfinished-input-model-trial-20261003/`. They are local trial evidence,
not runtime dependencies or portable CI fixtures. Do not publish raw transcripts
as design documentation. The harness takes Host checkout, fresh output directory,
arm and scenario arguments; its configured gateway requires authorized credentials.

With the gateway environment already configured and explicit model-call authority:

```sh
MAY_TRIAL_AGENT_SOURCE=/path/to/may.app/agents/may bun unfinished-input-model-trial.ts /path/to/host-checkout /tmp/fresh-trial baseline remaining-work
```

Run sequentially, retaining one output directory to share its overall budget.
Use the respective Host checkouts and distinct arm names for comparison. The
script refuses existing run directories; `resume` only accepts the exact retained
budget interruption. The reserved-token check is conservative bookkeeping, not
an exact tokenizer or a guarantee about provider billing.

Portable tests establish context delivery and mechanical correctness. The model
trial adds checked fulfillment of a synthetic small assignment, not improved
judgment across realistic backlogs, token savings or installed behavior. Native
adapter-specific request assembly is not newly exercised. No new retry policy is
justified by this result; retain the concrete context fix and test the demonstrated
remaining uncertainty separately.
