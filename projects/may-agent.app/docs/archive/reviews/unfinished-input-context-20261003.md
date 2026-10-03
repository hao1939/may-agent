# Unfinished-input context experiment — October 3, 2026

**Supports:** [Continue unfinished work with correct context](../../proposals/unfinished-input-context.md). Checks the smallest repair before adding repetition policy.

**Status:** Isolated source experiment and deterministic checks. No model calls,
live state mutations, publication, deployment or May restart.

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

This establishes context delivery and mechanical correctness, not improved
LLM judgment, fulfilled real requirements, token savings or installed behavior.
Native adapter-specific request assembly is not newly exercised by the focused
managed-agent probe. Do not call the original incident systemically fixed until
an authorized bounded behavioral trial checks the corrected context.
