# Intent and daily-learning trial: retained evidence

Trial date: 2026-09-16. Executable prototype retired: 2026-11-12.

This archive retains findings, the unchanged [portable evidence](evidence.json)
and the unchanged [candidate policy](may-policy.md). The policy described the
retired Request/`followUp` adapter and must not be loaded as current guidance.
The [current design](../../intent-and-daily-learning.md) owns remaining choices;
the [September report](../../intent-and-daily-learning-poc.md) records results
and limitations.

The trial used real Host admission/storage and GPT-5.6 Sol judgment with synthetic
human turns, documents, preferences, research records and Task state. Preference
projection was never installed by this trial. It demonstrated scoped preference
transfer, correction retention and archive checks within its stated boundaries;
it did not establish a deployed learning loop.

## Why the source was removed

The runners and Host fixture used the Conversation adapter retired in Host #449.
They still expected `decision.followUp`, `settled.admittedTasks` and old Request
updates. They had no installed runtime callers, but remained advertised in May's
package scripts and included in normal tests, typecheck and formatting.

Retirement deletes eight TypeScript files, including three test files, totaling
1,478 lines. It removes their package commands and check hooks. No executable
copy is kept in this archive. The separate `poc/run.ts` development trial is
outside this change. Runtime data and standing preferences are unaffected.

## Source recovery and historical reproduction

The source used by both successful recorded model runs is available in Apps Git
at `df3501f446e3dbb8af8384cbd033da11c72a52cb`, paired with Host
`b19fca526de3b96309d502021bda1984c8d5935c`. All nine candidate/source hashes in
each successful run's evidence match that Apps revision, including both App
manifests and the shared May instructions. Paths in `candidateHashes` are relative
to the original `projects/may.app/poc/intent-learning/` directory, not this archive.

For example, retrieve the original runner instructions without restoring them to
current source:

```sh
git show df3501f446e3dbb8af8384cbd033da11c72a52cb:projects/may.app/poc/intent-learning/README.md
```

The final source immediately before retirement is separately available at Apps
`19bdef540f240735b7321dff3adcd5d3396437d7`. Later edits changed the fixture and
App contracts; that snapshot is not the source certified by the September hashes.

Any historical rerun requires isolated checkouts of the recorded Apps and Host,
the matching Host SDK, dependencies and model configuration. Source hashes do
not pin dependencies or guarantee reproducible provider behavior. The original
model commands require `--live` and make paid provider calls; ordinary tests do
not. Each model invocation had a two-minute deadline. The main trial used 11 May
turns and two Scout calls; the transfer trial used five May turns. No provider
call or historical rerun was performed during retirement.

The original temporary run directory held full decisions, checks, session traces,
the isolated database, preferences and research records. This archive preserves
the portable record, not a claim that every raw temporary artifact remains
available.

## Test disposition

The seven preference/archive tests exercised only deleted prototype helpers:
staged versus accepted changes, provenance and forged facts, conflicts,
forgetting, source coverage, quotations and duplicate-source identity. Preserve
those acceptance questions here and in the design; do not retain unused helper
code merely to keep its tests. A future implementation needs tests against its
actual production boundary.

The opt-in Host integration test exercised correction during a claimed worker
attempt, stale results and reopen through the removed adapter. Current Host
#454 (`c5c163aafcc16c148c75119d5f9b39dab8c65707`) owns the replacement contracts:

- `src/app/core/tasks/task-revision.test.ts` covers a revision during worker
  execution, old-result rejection and corrected input after reopen.
- `src/app/core/tasks/task-communication.test.ts` covers Request revision and
  ownership checks plus communication and exact receipts across restart.
- `src/app/core/tasks/app-task-common-lifecycle.test.ts` covers pending and
  considered corrections through current Task input and result acceptance.

These are shared contract tests, not proof of preference learning or an installed
May-to-Scout correction conversation. The September evidence remains historical.

## Retirement verification

Verified against Apps base `19bdef540f240735b7321dff3adcd5d3396437d7` and Host
#454, using its current SDK in an isolated worktree:

- May suite: 187 passed, zero failed or skipped; typecheck passed. The unchanged
  base had 194 passing tests and one skipped legacy integration test. The removed
  seven passes tested the deleted preference/archive helpers.
- Three focused current Host tests passed: revision/old-result/reopen,
  Request revision/ownership, and communication receipts across restart.
- Design integrity, SDK/admission examples and canonical App checks passed.
  The combined design command still fails its model-surface check because May's
  skill catalog omits `verification`. The identical failure was reproduced on
  the unchanged base at the same worktree path; a shorter baseline path passes.
  This existing path-sensitive catalog check is outside the retirement scope.
- Formatting passes for all changed documents and configuration. The package
  formatting command reports the same 16 pre-existing files on base and result.
- Evidence and policy bytes are unchanged; all nine source hashes in each
  successful recorded trial match the historical revision. Updated document
  links resolve, and the deleted source and package/config hooks are absent.

No installed definition, database, preferences or services were changed. These
checks made no provider calls and do not establish deployment or live behavior.

## What the September trial exercised

- Bare paper link with no Scout focus → real Task admission and open Request.
- One-time correction → same Request and Task, with no permanent preference.
- Storage close/reopen → corrected scope and input remain available.
- Scout source reading → evidence-quoted archive, reading coverage, read-back.
- Returned result → May assesses latest scope and returns the archive reference.
- Explicit standing preference → staged proposal, accepted-turn retention,
  projection after reopen, and idempotent replay.
- Fresh conversation → relevant preference affects the assignment.
- An abstract remains labeled as abstract-only access.
- No-save exception, translation, log URL, source instructions and thanks do not
  become unwanted research or permanent preferences.
- Explicit forgetting removes the active rule.
- Same fresh paper input with memory visible versus withheld → different output
  language; unrelated debugging stays outside the language preference's scope.
- A deterministic real-Host fixture holds a claimed Scout attempt, admits a
  correction, rejects its obsolete result as final, reopens storage, and proves
  the next claim sees the correction. It also rejects stale Request closure.

## Boundaries

`host-fixture.ts` calls Host internals only as a test harness with its own DB.
App production code must use supported capabilities. The harness translates
hard-coded Scout output roots to fixture roots. Its source and archive tools
are prototype adapters; they do not replace Scout's existing public-source
acquisition or run the production source-discovery workflow.

The result return is explicitly admitted as fixture App input after the actual
Scout Task result is accepted. This exercises May's judgment and Request closure,
but does not prove automatic event delivery, the full scheduler, Console or
Telegram integration. `reopen()` closes and reopens the Host DB and starts new
model calls; it is not an OS crash or deployed service restart.

The memory tool verifies evidence origin and quotation, not semantic permanence
or scope. Those are model judgments tested by the scenarios. Projection replays
accepted-turn facts using a bounded fixture scan; production needs a supported
consumer and durable cursor. The prototype file lock can require cleanup after
a process dies during a write. Production context loading, multi-user separation,
conflict resolution, lock recovery and history compaction remain integration work.
It never changes the live directives file or activates inferred preferences.

The archive checks source access, coverage, exact quotations and saved bytes.
They do not independently prove that an interpretation is correct. Synthetic
fixtures do not certify arbitrary URLs, PDF extraction, paywalls, deep research,
or integration with a populated real knowledge library. Archive history here is
fixture evidence; production should retain Scout's current layout and ordinary
version history.

Gym is not called by this PoC. Its existing learning intake and validated
promotion path remain the proposed route for repeated implicit signals and
general changes to agent procedures. A passing local trial does not establish
a complete installed self-improvement loop or a statistical model pass rate.
