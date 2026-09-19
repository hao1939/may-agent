<ai_context>
summary: "Reusable verification and verdict-integrity patterns: evidence bound to the verified subject, explicit receipt coverage and valid anomalies, negative controls for the verdict path, freshness binding for replayed traces, evaluator immutability across repair, proof of the inspected universe behind a clean sweep, separation of checker eligibility from acceptance authority, actor-bound approval provenance, and release-aware expected-outcome reconciliation."
triggers: ["verification subject binding", "Brigade", "receipt coverage", "not_checked", "invocation_ref", "ASQAV", "meta-verification", "false-green verifier", "negative control", "ProjectGuard", "trace freshness", "recorded trace", "skilldiff", "agent skill regression", "frozen tests", "test identity", "failure fingerprint", "RepoPilot", "independent runner", "inspected universe", "compared-nothing-reported-clean", "event-backed write", "Dream Studio", "checker eligibility", "acceptance authority", "FinalAcceptance", "ContributionRecord", "Workstream", "review provenance", "content-addressed approval", "CRT", "XFAIL", "XPASS", "release-aware conformance", "Monet E2E"]
last_updated: "2026-09-19"
source_basis: "Extracted intact from agent-runtime-effect-integrity.md during its 2026-09-14 oversized-note review, then extended with release-aware expected-outcome reconciliation, replay-freshness analysis, evaluator-immutability analysis, and actor-bound review-state analysis. Sources are Brigade revision 0e8b83ae6ef779bb6be8701dd4cd534c064608f9; jagmarques/asqav-sdk revision 4cbf71b774fe18e67c2433c6ebee7b3940fe62ec, especially its standalone verifier contract, executable requirement map, frozen conformance corpus, invocation-reference duplicate vector, and unsigned-gap vector; Dilikjon/projectguard revision 55df81492aa4890d512efd4152e2cdca514471e8, including its CLI entry point, test runner, active gate configuration, and CI workflow, with npm test, npm run verify, and a known-bad test-runner negative control reproduced locally from the pinned archive; scs0209/skilldiff revision 285489f8c18f7cf48b0b2d6b2ec35a6da45fcd64, especially its recorded/live runner split, trace assertions, report formatter, baseline fetch, CLI, and GitHub Actions workflow; indada/repopilot revision d184928c7bfef6bc0d7228f9d282f0ae2e56fda1, especially its pipeline, repair constraints, structured test-evidence comparison, architecture, verification-coverage statement, and security boundary; SeayInsights/dream-studio revision 1014fc185cbade7cb5b11bdf67b7150ce1e47d13, especially its event-backed-write gate, focused gate tests, projection declarations, and blocking pre-push wiring; Flow-Research/workstream revision d5dd94d3f1f4e52fa9f191e88d3c210758bb4b3b, especially its lifecycle contract, roadmap capability ledger, review queue persistence, and canonical-review decision record; imron/crt revision e3ff1126b06528048673573a667bf3561f185539, especially its content-addressed file-review records, review types, MCP mutation tools, and architecture documentation; and team-monet/monet-e2e revision ba8acbc55a4574b3a453dcbf49842f7fb363f70c, especially its suite runner, metrics ledger, source-baseline guardrail, and release-to-main flip test."
</ai_context>

# Agent Runtime Verdict Integrity

**Companion note** to [Agent Runtime Effect Integrity](./agent-runtime-effect-integrity.md).

These patterns separate seven questions that a green verification result can
otherwise collapse: which subject was checked, which axes were covered, whether
the verdict path can reject a known-bad case, whether replay evidence is fresh for
the candidate, whether the evaluator stayed fixed while the candidate changed,
whether the verifier inspected the intended universe, and what authority may turn
that verdict into acceptance.

## Verification-Evidence Binding — Brigade (GitHub, August 2026)

[Brigade](./findings/2026-08-09-brigade-receipt-subject-binding.md) adds a
useful boundary to runtime verification: a real process exit code proves that a
check ran, but does not by itself prove **which work passed**. Its version-2
receipt schema records baseline commit, tree fingerprint, and patch digest;
missing identity data remains explicit rather than being silently upgraded into
patch proof.

Brigade reserves scoreable `subject_binding` for tracked, manifest-selected
runs. That binding ties the named artifact and content fingerprint to the
verifier manifest, patch source, producer-owned delta, and independent verifier.
Ad hoc command receipts remain audit-only even when they are durable or signed.
The implementation also avoids shell execution for verification commands and
retains the local receipt if archival fails.

**Runtime rule:** treat verification evidence as a typed ladder:

1. execution receipt — the command and exit status are real;
2. state binding — baseline, tree, and patch identity are known;
3. subject binding — the artifact and approved verifier are named;
4. authority separation — producer and verifier identities are distinct; and
5. outcome admission — only evidence satisfying the required rung may change
   promotion, routing, or completion state.

This sharpens the effect-closure rule above. Cryptographic integrity can show
that a receipt was not altered, but semantic binding determines what claim the
receipt may support. The evidence is architecture and implementation evidence
from Brigade's own repository at revision
`0e8b83ae6ef779bb6be8701dd4cd534c064608f9`, not an independent reliability
benchmark.

- **Primary sources:** [receipt schema](https://github.com/escoffier-labs/brigade/blob/main/docs/receipt-schemas.md),
  [execution model](https://github.com/escoffier-labs/brigade/blob/main/docs/execution-model.md),
  [outcome scoring](https://github.com/escoffier-labs/brigade/blob/main/docs/outcome-scoring.md),
  and [verification implementation](https://github.com/escoffier-labs/brigade/blob/main/src/brigade/work_cmd/verification.py).

## A Valid Receipt Must Carry Its Coverage Boundary — ASQAV (GitHub, September 2026)

ASQAV adds a second qualification to the verification ladder: even a correctly
signed and subject-bound receipt does not establish checks the verifier never
performed. Its standalone verifier returns per-axis outcomes plus a
machine-readable `not_checked` list on passing results. Missing cryptographic
dependencies or trust inputs produce `SKIPPED` and prevent a passing verdict;
its generated requirement map likewise derives coverage by executing each
vector and explicitly refuses to count a skipped axis as coverage.

The conformance corpus also separates **evidence from enforcement** in two useful
edge cases. Two valid pre-action receipts with the same `invocation_ref` both
verify: the reference makes duplicate hook emission observable, but the verifier
must not invent a uniqueness policy and reject either signed event. Separately,
an `unsigned_gap` can record a signer outage without asserting that actions in
the gap were policy-evaluated. Receipt integrity therefore preserves an anomaly
for a downstream control plane; it does not resolve the anomaly or upgrade
missing evidence into a control claim.

This yields three distinct semantics that runtimes should not collapse:

1. **cryptographic validity** — the recorded bytes and supported bindings check out;
2. **verification coverage** — each required axis was actually evaluated with
   the needed dependencies and caller-selected trust material; and
3. **operational policy** — a separate owner decides whether duplicate
   invocation references, unsigned intervals, or other valid anomalies block
   admission and require reconciliation.

The repository goes beyond prose with a frozen, hash-pinned corpus, Python and
TypeScript parity fixtures, generated axis coverage, and negative vectors for
tampering, key substitution, chain gaps, duplicate JSON members, and unsupported
or absent trust inputs. That is implementation and conformance-corpus evidence,
not independent validation of the hosted signing service, its policy decisions,
or production adoption. The SDK is also Elastic License 2.0, and cloud-issued
receipt cryptography runs server-side; those boundaries matter when interpreting
“open” or “zero-trust” claims.

**Runtime rule:** require every receipt verdict to travel with evaluated axes,
explicit non-checks, and trust inputs; route valid-but-anomalous receipts to a
separate admission or reconciliation policy rather than forcing the verifier to
silently authorize or reject them.

- **Repo:** https://github.com/jagmarques/asqav-sdk
- **Inspected revision:** [`4cbf71b774fe18e67c2433c6ebee7b3940fe62ec`](https://github.com/jagmarques/asqav-sdk/commit/4cbf71b774fe18e67c2433c6ebee7b3940fe62ec)
- **Primary sources:** [standalone verifier contract](https://github.com/jagmarques/asqav-sdk/blob/4cbf71b774fe18e67c2433c6ebee7b3940fe62ec/verifier/README.md), [generated requirement map](https://github.com/jagmarques/asqav-sdk/blob/4cbf71b774fe18e67c2433c6ebee7b3940fe62ec/verifier/conformance-vectors/requirement-map.json), [frozen corpus and vector semantics](https://github.com/jagmarques/asqav-sdk/blob/4cbf71b774fe18e67c2433c6ebee7b3940fe62ec/verifier/conformance-vectors/README.md), [duplicate-emission expectation](https://github.com/jagmarques/asqav-sdk/blob/4cbf71b774fe18e67c2433c6ebee7b3940fe62ec/verifier/conformance-vectors/asqav-36-invocation-ref-duplicate-emission/expected.json), and [unsigned-gap expectation](https://github.com/jagmarques/asqav-sdk/blob/4cbf71b774fe18e67c2433c6ebee7b3940fe62ec/verifier/conformance-vectors/asqav-15-unsigned-gap/expected.json)
- **Discovery query:** GitHub Repository Search API `"AI agent" pushed:>=2026-09-14`, sorted by update time; `incomplete_results: false`

## The Verdict Path Needs Its Own Negative Controls — ProjectGuard (GitHub, September 2026)

ProjectGuard is a compact example of why a process exit code is only as strong as
the code that propagates the verdict. The repository presents a universal
pre-completion verification layer and its CI invokes both `npm test` and
`npm run verify`. At the pinned revision, however, three independent breaks make
those commands structurally false-green:

1. the test runner prints expected and observed outcomes but contains no
   assertions, throws, or failing exit assignment, so a mismatched expectation
   would not fail the process;
2. the CLI file defines and exports `runAll()` but never invokes it when executed
   as the package's `verify` script, so `npm run verify` performs no gates and
   emits no report; and
3. even if `runAll()` were called, the active `test.passes` gate runs
   `node -e "console.log('ok')"`, not the repository tests. The README and skill
   also advertise `lint.clean`, `evidence.fingerprint`, `custom`, `pg-gate`,
   `pg-status`, and `pg-report`, while the CLI dispatcher implements only
   `file.exists` and `test.passes`.

Scout downloaded the archive at the pinned commit and reproduced both command
paths: all six test cases printed their expected `PASS` labels and `npm test`
exited 0; `npm run verify` also exited 0 with no ProjectGuard output. A scratch
negative control then changed the test runner's expected-failure command into a
success: the runner printed `Got: FAIL` but still exited 0. The original six
examples happen to match their expectations; the negative control demonstrates
that the surrounding verdict path does not propagate an expectation mismatch,
while the empty verify run shows that the advertised entry point did not call
its own `runAll()` function.

This sharpens the verification ladder above. A command receipt must be paired
with **negative controls for the verifier itself**:

1. mutate or fixture one known-bad subject and require a nonzero verdict;
2. prove that the public entry point actually reaches the gate dispatcher;
3. bind configured commands to the intended check rather than a placeholder;
4. fail when advertised or configured gates lack implementations; and
5. keep test counts, assertion counts, and exercised entry points distinct.

A green CI step establishes only that its command returned zero. It becomes
completion evidence only after the verdict path has demonstrated both a true
positive and a true negative under the exact public invocation. This repository
was created the day it was inspected and had one GitHub star, so it is an early
implementation signal, not evidence about production prevalence.

- **Repo:** https://github.com/Dilikjon/projectguard
- **Inspected revision:** [`55df81492aa4890d512efd4152e2cdca514471e8`](https://github.com/Dilikjon/projectguard/commit/55df81492aa4890d512efd4152e2cdca514471e8)
- **Primary sources:** [CLI entry point](https://github.com/Dilikjon/projectguard/blob/55df81492aa4890d512efd4152e2cdca514471e8/src/cli/pg-verify.js#L55-L80), [test runner](https://github.com/Dilikjon/projectguard/blob/55df81492aa4890d512efd4152e2cdca514471e8/tests/run.js), [active gate configuration](https://github.com/Dilikjon/projectguard/blob/55df81492aa4890d512efd4152e2cdca514471e8/.projectguard.yaml), and [CI workflow](https://github.com/Dilikjon/projectguard/blob/55df81492aa4890d512efd4152e2cdca514471e8/.github/workflows/ci.yml)
- **Discovery query:** GitHub Repository Search API `AI agent created:>=2026-09-13`, sorted by stars; `incomplete_results: false`

## A Replayed Trace Needs a Freshness Receipt — skilldiff (GitHub, September 2026)

`skilldiff` explores a useful testing shape for instruction-only agent skills: a
plain-YAML scenario states expected files, commands, normalized tool calls,
forbidden effects, and output substrings; the reporter evaluates the same contract
against old and new traces and labels a failure as a regression only when the old
trace passed. Its live path also retrieves the old skill from a Git ref, restores
the current skill between runs, and uses a real harness against a fixture repo.
This makes agent behavior rather than a text diff the intended review object.

The checked CI path exposes a crucial provenance gap. On every skill PR, the workflow
selects checked-in `examples/traces/<scenario>-old.json` and `-new.json`; recorded
mode simply loads those JSON files and reevaluates their assertions. No step derives
either trace from the changed skill, records which skill revision produced it, or
fails because a trace predates the PR. A skill-only edit can therefore rerun the
same traces and obtain the same “new skill” verdict even though the new skill never
executed. The workflow gates recorded assertion failures, so its exit code is real,
but its verified subject is the supplied trace fixture—not necessarily the changed
skill revision.

The repository keeps live execution separate, which is a sound architectural
starting point but not yet a blocking freshness control. At the inspected revision,
`runner.ts` rejects every live harness except Freebuff despite broader adapters being
described in the README, and the GitHub Actions live step is manual-only and ends
with `exit 0` after running scenarios. Scout statically inspected the pinned source
and repository-authored assertion tests but did not install dependencies, execute
the tests, or run an agent harness. The repository had three stars at retrieval, so
this is an early implementation boundary rather than adoption evidence.

**Runtime rule:** every behavioral regression verdict should bind three different
artifacts: the candidate instruction revision, the exact execution environment, and
the resulting trace. Deterministic replay is valuable for testing parsers,
assertions, reports, and previously recorded incidents; it becomes fresh evidence
about a changed skill only when the trace is regenerated from that revision or a
content-bound freshness receipt proves equivalence. CI should fail closed when that
binding is absent, stale, or produced only by a non-gating/manual path.

- **Repo:** https://github.com/scs0209/skilldiff
- **Inspected revision:** [`285489f8c18f7cf48b0b2d6b2ec35a6da45fcd64`](https://github.com/scs0209/skilldiff/commit/285489f8c18f7cf48b0b2d6b2ec35a6da45fcd64)
- **Primary sources:** [recorded/live runner](https://github.com/scs0209/skilldiff/blob/285489f8c18f7cf48b0b2d6b2ec35a6da45fcd64/src/runner.ts), [trace assertions](https://github.com/scs0209/skilldiff/blob/285489f8c18f7cf48b0b2d6b2ec35a6da45fcd64/src/assertions.ts), [report semantics](https://github.com/scs0209/skilldiff/blob/285489f8c18f7cf48b0b2d6b2ec35a6da45fcd64/src/report.ts), [baseline fetch](https://github.com/scs0209/skilldiff/blob/285489f8c18f7cf48b0b2d6b2ec35a6da45fcd64/src/baseline.ts), [CLI exit path](https://github.com/scs0209/skilldiff/blob/285489f8c18f7cf48b0b2d6b2ec35a6da45fcd64/src/cli.ts), [GitHub Actions workflow](https://github.com/scs0209/skilldiff/blob/285489f8c18f7cf48b0b2d6b2ec35a6da45fcd64/.github/workflows/skilldiff.yml), and [repository-authored assertion tests](https://github.com/scs0209/skilldiff/blob/285489f8c18f7cf48b0b2d6b2ec35a6da45fcd64/tests/assertions.test.ts)
- **Discovery query:** GitHub Repository Search API `agentic created:>2026-09-17`, sorted by stars; 3,721 results, `incomplete_results: false`

## Freeze the Evaluator Before Asking an Agent to Repair — RepoPilot (GitHub, September 2026)

RepoPilot demonstrates a stronger repair boundary than merely rerunning a test
command after an agent edits code. Its controller first adds planned tests to
pinned base and head snapshots, requires those generated tests to be discovered
and fully executed on both, and classifies outcomes from the same case identities:
base-pass/head-fail is regression evidence, while base-fail/head-pass counts as new
behavior only when the scenario carries an exact requirement quote. Both-fail,
missing, skipped, or identity-changing cases stay unresolved rather than being
converted into repair opportunities.

The important control is that the evaluator is frozen before repair. The repair
answer is rejected if it changes any test path; package, lock, configuration,
instruction, and hidden paths are also protected. A candidate must then pass the
frozen generated cases and preserve the original base/head case identities. For a
reproduced regression, the pre-repair head run is repeated and its failing case
IDs and normalized failure fingerprints must match before source repair begins.
Test execution occurs in a runner separate from the Codex proposal container, and
publication can target only a separate draft branch after source freshness checks;
maintainers retain merge authority.

This yields a reusable **oracle-integrity receipt** for agent repair:

1. bind generated checks to pinned before/after subjects and cited requirements;
2. freeze evaluator bytes, discovery, case identities, and failure fingerprints
   before exposing failures to the repair agent;
3. prohibit the candidate from editing the oracle, runner configuration, or
   governing instructions;
4. rerun through an execution path separate from the proposing agent and reject
   missing or changed evidence; and
5. keep a verified patch distinct from merge or deployment authority.

The boundary is not tamper-proof attestation. RepoPilot's security model says the
target test code and reporter share a container, and its repository validation uses
mock APIs, agents, runners, and synthetic fixtures rather than real Codex, Docker,
or GitHub publication. Scout inspected the pinned source and repository-authored
validation statement statically; it did not install dependencies or run the suite.
The repository reported 95 stars at retrieval, which is an interest signal, not
reliability or adoption evidence.

- **Repo:** https://github.com/indada/repopilot
- **Inspected revision:** [`d184928c7bfef6bc0d7228f9d282f0ae2e56fda1`](https://github.com/indada/repopilot/commit/d184928c7bfef6bc0d7228f9d282f0ae2e56fda1)
- **Primary sources:** [repair pipeline](https://github.com/indada/repopilot/blob/d184928c7bfef6bc0d7228f9d282f0ae2e56fda1/src/application/pipeline.ts), [repair and protected-path constraints](https://github.com/indada/repopilot/blob/d184928c7bfef6bc0d7228f9d282f0ae2e56fda1/src/domain/repair.ts), [test assessment](https://github.com/indada/repopilot/blob/d184928c7bfef6bc0d7228f9d282f0ae2e56fda1/src/domain/test-assessment.ts), [test identity and fingerprint comparison](https://github.com/indada/repopilot/blob/d184928c7bfef6bc0d7228f9d282f0ae2e56fda1/src/domain/test-evidence.ts), [architecture](https://github.com/indada/repopilot/blob/d184928c7bfef6bc0d7228f9d282f0ae2e56fda1/docs/ARCHITECTURE.md), [verification coverage](https://github.com/indada/repopilot/blob/d184928c7bfef6bc0d7228f9d282f0ae2e56fda1/docs/VERIFICATION.md), and [security model](https://github.com/indada/repopilot/blob/d184928c7bfef6bc0d7228f9d282f0ae2e56fda1/SECURITY.md)
- **Discovery query:** GitHub Repository Search API `(ai-agent OR agentic) created:>2026-09-17`, sorted by stars; 3,652 results, `incomplete_results: false`

## A Clean Sweep Must Prove What It Swept — Dream Studio (GitHub, September 2026)

Dream Studio extends the negative-control lesson with a separate failure mode: a
correct detector can still return green after inspecting an empty or incomplete
universe. Its blocking `event-backed-write` gate looks for production functions
that insert directly into rebuildable projection tables without a reachable
canonical-event emission. The gate's own history records two listing failures
that could turn “checked nothing” into “found nothing”: decoding failure could
leave successful process status with no stdout, and an empty `git ls-files`
result could be mistaken for a repository with no Python files.

The repaired implementation makes **measurement coverage part of the verdict**:

1. an empty tracked-file listing raises instead of passing;
2. the target-table set is derived from each projection's `target_tables`
   declaration—the same declarations used to decide what rebuild truncates—rather
   than copied into a second hard-coded list;
3. the clean report states both derived target-table count and examined
   production-write-site count; and
4. focused tests require unreadable and empty listings to fail, require a real
   repository to enumerate its file, and check that declared projection targets
   reach the detector.

This is stronger than requiring only a known-bad test. A negative control proves
that the verdict path can reject one defect; it does not prove that the scan
reached the intended files or that its target inventory stayed aligned as the
system evolved. For agent gates and compliance sweeps, a useful receipt should
therefore bind **subject identity, inspected-universe identity, measured counts,
and exclusions** to the verdict. A zero-finding result without those fields is
ambiguous between compliance and absent input.

The same source also shows why “an event call exists” is too weak. The analyzer
credits only calls whose names resolve to the repository's spool writer, follows
helper reachability, and rejects a known incompatible envelope object unless it
is converted to the mapping accepted by the writer. In other words, evidence of
an attempted side effect is not evidence of a viable side effect.

The boundary is still narrower than complete event-sourcing assurance. This is a
static, repository-specific analyzer: it excludes tests, recognizes particular
SQL spellings, skips unreadable or unparsable source files, and catches projection
module import exceptions while constructing the target set. Those paths can
still reduce coverage, so the implementation is a useful pattern—not proof that
every write is reconstructable. The project's historical missing-event counts
and current clean-site count are repository-authored claims; Scout inspected the
pinned source and tests but did not run the suite or inspect its live database.

**Runtime rule:** a gate may report clean only when it can identify the intended
subject universe, prove that enumeration produced meaningful input, disclose
what it examined and excluded, and demonstrate that recognized evidence could
actually execute. Fail closed on absent input, not only on detected violations.

- **Repo:** https://github.com/SeayInsights/dream-studio
- **Inspected revision:** [`1014fc185cbade7cb5b11bdf67b7150ce1e47d13`](https://github.com/SeayInsights/dream-studio/commit/1014fc185cbade7cb5b11bdf67b7150ce1e47d13)
- **Primary sources:** [event-backed-write gate](https://github.com/SeayInsights/dream-studio/blob/1014fc185cbade7cb5b11bdf67b7150ce1e47d13/core/gates/event_backed_write.py), [focused gate tests](https://github.com/SeayInsights/dream-studio/blob/1014fc185cbade7cb5b11bdf67b7150ce1e47d13/tests/unit/test_event_backed_write.py), [task projection declaration](https://github.com/SeayInsights/dream-studio/blob/1014fc185cbade7cb5b11bdf67b7150ce1e47d13/core/projections/task_projection.py), and [blocking pre-push wiring](https://github.com/SeayInsights/dream-studio/blob/1014fc185cbade7cb5b11bdf67b7150ce1e47d13/canonical/workflows/pre-push.yaml#L569-L587)
- **Discovery query:** GitHub Repository Search API `"AI agent" pushed:>=2026-09-14`, sorted by update time; `incomplete_results: false`

## Checker Eligibility Must Not Become Acceptance Authority — Workstream (GitHub, September 2026)

Workstream documents a useful verdict boundary for governed human/agent work:
pre-submission checks decide whether a package is fit to submit, post-submission
checkers decide whether an immutable submission is eligible for the next route,
and a separate authorized decision decides acceptance. Its contract explicitly
says that passing intake does not prove correctness, durable checker results do
not grant final acceptance, and raw checker results cannot impersonate a human
Review. A checker can produce `allow_review`; it cannot produce accepted work.

The intended acceptance path binds the exact artifact, locked project policies,
review identity, findings, and one decision (`accept`, `needs_revision`, or
`reject`). Only `FinalAcceptance` may create an `accepted_submission`
`ContributionRecord`. That makes contribution and compensation records
**downstream projections of authorized acceptance**, rather than incentives that
can write or reinterpret lifecycle truth. On an automated branch, the same
separation still applies: a locked policy may route passing evidence into a
separate authorized acceptance operation, but checker success itself is not the
acceptance event.

This complements receipt and coverage integrity with a distinct question:
**what may a valid verdict cause?** A robust lifecycle should type at least four
transitions separately:

1. artifact intake — may the candidate become an immutable submission?
2. evaluation eligibility — did the required checks run and permit routing?
3. acceptance — which authorized actor or service admitted the exact submission
   under which locked policy?
4. consequence projection — which contribution, compensation, reputation, or
   publication facts may be derived from that acceptance?

Workstream is unusually explicit about its implementation boundary. At the
inspected revision, immutable submission and checker foundations exist, review
queue/lease persistence is hidden, while live post-submit `allow_review`, Review
decisions, `FinalAcceptance`, and `ContributionRecord` effects remain planned.
The repository therefore supplies an architecture contract and partial
persistence evidence—not proof of a completed end-to-end production lifecycle.
That qualification is itself useful: capability ledgers should prevent future
architecture from being reported as current enforcement.

**Runtime rule:** let checkers establish evidence and routing eligibility, never
acceptance. Require a separately authorized, artifact- and policy-bound
acceptance event before emitting contribution or economic consequences, and
publish the implementation status of each transition independently.

- **Repo:** https://github.com/Flow-Research/workstream
- **Inspected revision:** [`d5dd94d3f1f4e52fa9f191e88d3c210758bb4b3b`](https://github.com/Flow-Research/workstream/commit/d5dd94d3f1f4e52fa9f191e88d3c210758bb4b3b)
- **Primary sources:** [lifecycle and trust contract](https://github.com/Flow-Research/workstream/blob/d5dd94d3f1f4e52fa9f191e88d3c210758bb4b3b/README.md), [capability ledger and explicit planned boundaries](https://github.com/Flow-Research/workstream/blob/d5dd94d3f1f4e52fa9f191e88d3c210758bb4b3b/docs/roadmap_status.md), [canonical Review decision record](https://github.com/Flow-Research/workstream/blob/d5dd94d3f1f4e52fa9f191e88d3c210758bb4b3b/docs/decision_0009_review_decisions_are_canonical.md), and [implemented review queue/admission persistence](https://github.com/Flow-Research/workstream/blob/d5dd94d3f1f4e52fa9f191e88d3c210758bb4b3b/backend/app/modules/reviews/models.py)
- **Discovery query:** GitHub Repository Search API `"AI agent" pushed:>=2026-09-14`, sorted by update time; `incomplete_results: false`

## Content-Addressed Approval Still Needs Actor Provenance — CRT (HN/GitHub, September 2026)

CRT demonstrates a useful way to keep iterative human review from restarting every
time an agent rebases or amends a branch. A review is scoped by merge-base and
branch; each approved file is stored with an algorithm-independent content identity
formed from its base and worktree blob IDs, plus the review time and HEAD commit. If
that content identity changes, the file returns to the unreviewed set.
Comments likewise retain exact selected text, surrounding context, and anchor status,
so they can move with matching content or remain visible as approximate or orphaned
instead of silently disappearing.

This is stronger than remembering a line number or a commit-local UI position. It
binds the operator's attention state to the bytes that were inspected, allowing an
unchanged file to stay out of the way while changed work comes back for review. The
MCP interface also gives an agent structured access to exact diffs, comments, code
search, and definition lookup, avoiding the lossy handoff where a human describes a
problem in prose and the agent must rediscover its location.

The same interface exposes an important authority boundary. CRT intentionally lets
agents create comments, resolve them, and call `mark_file_reviewed`; its README says
this makes reviewers replaceable. At the pinned revision, however, `MarkReviewedParams`
contains only `file_path`, `ResolveCommentParams` only a comment ID, the stored file
review contains content identity, timestamp, and reviewed commit, and stored comments
and resolution events have no actor or reviewer principal. The MCP methods require a
selected review session but do not attach an authenticated reviewer identity or role
to these mutations. Consequently, “reviewed” proves that some connected client marked
the exact content, not that a human or an independently authorized reviewer approved
it. A fixing agent can resolve a comment and mark the resulting file reviewed through
the same channel that carries human review state.

These are two separate and complementary properties:

1. **attention freshness** — did the reviewed bytes remain unchanged?
2. **approval provenance and authority** — who inspected those bytes, in what role,
   under which policy, and may that actor's verdict admit the change?

A practical review record should therefore retain CRT's content identity while adding
an authenticated actor or service principal, reviewer class, operation type, policy
or checklist identity, and supersession history. Agent self-review can remain useful,
but it should produce a typed advisory verdict rather than overwrite or impersonate a
required human or independent-review state. Comment resolution should mean only that
the producer claims the concern was addressed; closure should occur when the required
reviewer rechecks the new content. Final merge or deployment must remain a separate
admission event bound to both the exact candidate and the required reviewer classes.

The repository is early-stage (two GitHub stars at retrieval), says its interface and
stored format may change without migration, and has no declared license in GitHub
metadata. Scout inspected the pinned README, architecture documentation, data types,
database writes, and MCP adapter but did not compile or execute CRT. This is therefore
implementation evidence for content-addressed review continuity and a static authority
gap, not an adoption, usability, or reliability benchmark.

**Runtime rule:** bind review freshness to content identity, but never infer reviewer
identity or acceptance authority from an untyped `reviewed` flag. Record who produced
each comment, resolution, and approval; keep producer resolution separate from reviewer
closure; and let only a policy-authorized, candidate-bound admission event promote the
change.

- **HN:** https://news.ycombinator.com/item?id=49761478
- **Repo:** https://github.com/imron/crt
- **Inspected revision:** [`e3ff1126b06528048673573a667bf3561f185539`](https://github.com/imron/crt/commit/e3ff1126b06528048673573a667bf3561f185539)
- **Primary sources:** [README and review loop](https://github.com/imron/crt/blob/e3ff1126b06528048673573a667bf3561f185539/README.md), [review-state architecture](https://github.com/imron/crt/blob/e3ff1126b06528048673573a667bf3561f185539/docs/OVERVIEW.md), [review parameter and status types](https://github.com/imron/crt/blob/e3ff1126b06528048673573a667bf3561f185539/src/review_types.rs), [stored review/comment records](https://github.com/imron/crt/blob/e3ff1126b06528048673573a667bf3561f185539/src/db.rs), and [MCP review mutation tools](https://github.com/imron/crt/blob/e3ff1126b06528048673573a667bf3561f185539/src/mcp.rs)
- **Discovery feed:** HN Algolia `search_by_date?query=AI%20agent&tags=story&hitsPerPage=20`

## Expected Outcomes Need Release-Aware Reconciliation — Monet E2E (GitHub, September 2026)

Monet E2E makes a useful distinction that ordinary green/red suites often lose:
**test execution health and the product behavior observed are different verdict
axes**. Its runner assigns separate exit codes to a passing contract, an
unexpected harness or product failure, a known defect still present (`XFAIL`),
and a known-defect test that now passes (`XPASS`). Only unexpected failures make
the aggregate suite exit non-zero; the summary retains the other counts.

That model prevents known defects from making every run unusably red, but it
also exposes a reconciliation obligation. A zero suite exit can contain both
open defects and behavior that appears fixed. The repository's metrics therefore
reports unexpected failure rate separately from `XFAIL` and `XPASS`, while the
runner emits an explicit warning that an `XPASS` needs issue-status review.
Without that second consumer, “green” can silently accumulate stale expected
outcomes: a fix remains an unexpected pass rather than becoming a normal
regression guard.

The pinned `doctor --json` test shows how to make the flip evidence-bearing
rather than version-guessing. It creates a corrupt isolated store, verifies that
startup fails closed and writes a causal sidecar, then compares the text and JSON
diagnostic surfaces. Against the published 1.11.0 artifact, the test classifies
absence of `startupFailure` in failure-path JSON as the known defect; if a later
artifact returns `status: found` with the same phase and error code, it flips to
`XPASS`. Broken setup, missing sidecar, malformed JSON, and loss of the
success-path `status: none` contract remain ordinary failures instead of being
absorbed into the expected-failure label.

Revision identity is essential to that inference. The same test records that
the repair had merged to the product's `main` branch but was not in the latest
release. The harness's new source-baseline guardrail was prompted by its own
audit finding that a local source clone was 39 commits behind and 32 of 48 cited
TypeScript files had changed. Those are repository-authored audit counts, not an
independent Scout reproduction, but the resulting rule is sound: bind behavioral
verdicts to the exercised release artifact and bind implementation explanations
to a pinned source revision. “Fixed on main” and “fixed in the tested release”
are different facts.

This is not independent evidence that Monet's full 57-test suite currently has
the repository-reported pass matrix: Scout inspected the pinned harness,
selected tests, guardrail, and ledger but did not install Monet or rerun the
suite. It is implementation evidence for a reusable verdict protocol. The
current runner also communicates reconciliation through text and exit codes;
an automated host must preserve the four-way state and route `XPASS` for review
rather than reducing every zero aggregate exit to `passed`.

**Runtime rule:** represent expected outcomes as version-bound observations, not
exceptions erased from suite health. Preserve at least `pass`, `unexpected
failure`, `known defect observed`, and `expected defect absent`; make setup
failure orthogonal; bind the observation to the tested artifact; and require a
separate reconciliation step that turns a reviewed `XPASS` into a normal guard
and updates the defect ledger.

- **Repo:** https://github.com/team-monet/monet-e2e
- **Inspected revision:** [`ba8acbc55a4574b3a453dcbf49842f7fb363f70c`](https://github.com/team-monet/monet-e2e/commit/ba8acbc55a4574b3a453dcbf49842f7fb363f70c)
- **Primary sources:** [four-way suite runner](https://github.com/team-monet/monet-e2e/blob/ba8acbc55a4574b3a453dcbf49842f7fb363f70c/harness/run_all.py), [`doctor --json` release-flip test](https://github.com/team-monet/monet-e2e/blob/ba8acbc55a4574b3a453dcbf49842f7fb363f70c/tests/test57_re57_doctor_json_startup_failure.py), [metrics ledger and verdict definitions](https://github.com/team-monet/monet-e2e/blob/ba8acbc55a4574b3a453dcbf49842f7fb363f70c/METRICS.md), and [pinned-source guardrail](https://github.com/team-monet/monet-e2e/blob/ba8acbc55a4574b3a453dcbf49842f7fb363f70c/GUARDRAILS.md)
- **Discovery query:** GitHub Repository Search API `"AI agent" pushed:>=2026-09-14`, sorted by update time; `incomplete_results: false`
