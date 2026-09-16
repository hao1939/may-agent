# Intent and daily-learning PoC

This is an opt-in candidate, not installed May behavior. It uses the existing
May conversation resolver, May/Scout App manifests, Host Request revisions, Task
admission and completion, and SQLite storage. GPT-5.6 Sol makes the semantic
decisions. All human turns, source documents, preferences, research records and
Task state are synthetic and isolated in a newly allocated temporary directory.

The [design](../../docs/intent-and-daily-learning.md) explains the proposed
ownership and implementation boundaries. The
[evidence report](../../docs/intent-and-daily-learning-poc.md) records actual
results and limitations.

## Run

Use a compatible, immutable Host source checkout and the configured model
endpoint. The trial uses the existing `gpt-5.6-sol` registry entry and does not
substitute a different model. `MODEL_API_KEY`, if needed, comes from the caller's
environment and is not written to the result report.

```sh
cd projects/may.app
MAY_HOST_SOURCE=/absolute/path/to/host-source \
  bun test ./app.test.ts ./poc/intent-learning

MAY_HOST_SOURCE=/absolute/path/to/host-source \
  MODEL_BASE_URL=http://localhost:4000 \
  bun run poc:intent --live

MAY_HOST_SOURCE=/absolute/path/to/host-source \
  MODEL_BASE_URL=http://localhost:4000 \
  bun run poc:intent-transfer --live
```

The model trials require `--live`, make real provider calls, and use only the
declared fixture tools. Each model invocation has a two-minute deadline. The
main trial uses 11 May turns and two Scout calls; the transfer trial uses five
May turns. Ordinary tests make no provider calls. The Host integration test is
explicitly skipped when `MAY_HOST_SOURCE` is absent.

`trial-start` prints the evidence root. `results.json` retains every accepted
decision, exact Task references, and candidate-file hashes; `checks.json` records
checks and the first failure. Model session traces, the isolated Host database,
preferences and research records remain below the same root. A failed trial
retains its evidence and exits nonzero; it does not automatically retry model
judgment or change expectations.

## What is exercised

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
