<ai_context>
summary: "Reusable verification and verdict-integrity patterns: evidence bound to the verified subject, explicit receipt coverage and valid anomalies, claim-level platform enforcement evidence, negative controls for the verdict path, state-based effect grading with honest and adversarial oracle controls, freshness binding for replayed traces, evaluator immutability across repair, proof of the inspected universe behind a clean sweep, cross-artifact conformance for executable governance, phase-aware calibration of probabilistic rule checks, separation of reviewer diversity, verdict transport, and acceptance authority, actor-bound approval provenance, release-aware expected-outcome reconciliation, and lossless normalization of heterogeneous audit outcomes."
triggers: ["verification subject binding", "Brigade", "receipt coverage", "not_checked", "invocation_ref", "ASQAV", "claim-level platform evidence", "RTQ", "sandbox enforcement", "construction-only test", "meta-verification", "false-green verifier", "negative control", "ProjectGuard", "state-based grading", "reward hacking", "Compound Evals", "kyisaiah47/compound-evals", "trace freshness", "recorded trace", "skilldiff", "agent skill regression", "frozen tests", "test identity", "failure fingerprint", "RepoPilot", "post-merge outcome", "evaluation identity", "independent runner", "inspected universe", "compared-nothing-reported-clean", "cross-artifact conformance", "decision table", "DMN", "OutTheBox", "probabilistic rule check", "phase-specific precision", "Abide", "event-backed write", "Dream Studio", "checker eligibility", "acceptance authority", "reviewer diversity", "cross-provider review", "verdict transport", "portable DSH", "FinalAcceptance", "ContributionRecord", "Workstream", "review provenance", "content-addressed approval", "CRT", "XFAIL", "XPASS", "release-aware conformance", "Monet E2E", "audit outcome normalization", "decision vocabulary", "shadow mode", "approval timeout", "execution record", "node9"]
last_updated: "2026-09-21"
source_basis: "Extracted intact from agent-runtime-effect-integrity.md during its 2026-09-14 oversized-note review, then extended with release-aware expected-outcome reconciliation, replay-freshness analysis, evaluator-immutability analysis, actor-bound review-state analysis, cross-artifact governance conformance, post-merge outcome tracking, phase-aware probabilistic rule-check calibration, and a cross-provider review-control implementation. Sources are Brigade revision 0e8b83ae6ef779bb6be8701dd4cd534c064608f9; jagmarques/asqav-sdk revision 4cbf71b774fe18e67c2433c6ebee7b3940fe62ec, especially its standalone verifier contract, executable requirement map, frozen conformance corpus, invocation-reference duplicate vector, and unsigned-gap vector; Dilikjon/projectguard revision 55df81492aa4890d512efd4152e2cdca514471e8, including its CLI entry point, test runner, active gate configuration, and CI workflow, with npm test, npm run verify, and a known-bad test-runner negative control reproduced locally from the pinned archive; scs0209/skilldiff revision 285489f8c18f7cf48b0b2d6b2ec35a6da45fcd64, especially its recorded/live runner split, trace assertions, report formatter, baseline fetch, CLI, and GitHub Actions workflow; indada/repopilot revisions d184928c7bfef6bc0d7228f9d282f0ae2e56fda1 and a97fab7e11f85b87a3b74fd613f82b9ea2cac605, especially its frozen repair evaluator, post-merge checks, evaluation identities, deterministic evidence aggregation, and security boundary; SeayInsights/dream-studio revision 1014fc185cbade7cb5b11bdf67b7150ce1e47d13, especially its event-backed-write gate, focused gate tests, projection declarations, and blocking pre-push wiring; Flow-Research/workstream revision d5dd94d3f1f4e52fa9f191e88d3c210758bb4b3b, especially its lifecycle contract, roadmap capability ledger, review queue persistence, and canonical-review decision record; imron/crt revision e3ff1126b06528048673573a667bf3561f185539, especially its content-addressed file-review records, review types, MCP mutation tools, and architecture documentation; team-monet/monet-e2e revision ba8acbc55a4574b3a453dcbf49842f7fb363f70c, especially its suite runner, metrics ledger, source-baseline guardrail, and release-to-main flip test; scubagraham/outthebox-open-patterns revision c7d6fa84ad8b289116599966fc1bb2a853c19231, including its Markdown patterns, DMN tables, and Agent 365-shaped JSON templates; node9-ai/node9-proxy revision 915735f92d988423203707a749d63b6298defa2c, especially its central decision classifier, live-derived regression fixtures, hook-to-audit coverage helper, and captured multi-agent gate-contract matrix; coldteadotai/abide revision f2683828965ced03da07abae811e78af0383040c, especially its edit/turn hook paths, scoped checker, calibration classifier, event log, and retrospective replay benchmark; kyisaiah47/compound-evals revision 49fd05c6f79d6f5c2d1c10c7fec652aea8d08ef1, especially its state-based reward hooks, honest/adversarial grader suites, declared ungradable workflows, result schema, run receipts, and result validator; WDahah/portable-dsh-multi-agent-plugin revision cd16e198857891369fa52ac48ac7b53a976add4f, especially its provider-diverse review selection, verdict parser, bounded iteration states, side-effect retry policy, and test suite; and Latestinssan/RTQ revision 03006d4b0302b515d2d96ec19d8fcdf14ca83a1c, especially its claim matrix, threat model, sandbox tests and workflows, security pipeline, and current GitHub Actions job results, with the complete local test command reproduced by Scout."
</ai_context>

# Agent Runtime Verdict Integrity

**Companion note** to [Agent Runtime Effect Integrity](./agent-runtime-effect-integrity.md).

These patterns separate verdict questions that a green verification result can
otherwise collapse: which subject was checked, which axes were covered, whether
the verdict path can reject a known-bad case, whether replay evidence is fresh for
the candidate, whether the evaluator stayed fixed while the candidate changed,
whether the verifier inspected the intended universe, whether parallel policy
artifacts still encode the same contract, what authority may turn that verdict
into acceptance, whether a platform matrix exercised construction or real
enforcement, and whether heterogeneous audit producers preserve action phase and
decision cause.

## A Platform Matrix Must Name What Each Platform Actually Exercised — RTQ (GitHub, September 2026)

[RTQ](https://github.com/Latestinssan/RTQ) is a new capability-security
runtime whose useful contribution is an unusually explicit claim matrix. It
separates pure logic, cross-component contracts, construction checks, and real
OS enforcement; its authorization pipeline also binds a single-use ticket to
the capability version and frozen input, rejects replay synchronously, and
refuses execution when a required sandbox cannot be constructed. At pinned
revision `03006d4b0302b515d2d96ec19d8fcdf14ca83a1c`, Scout reproduced the complete
repository test command: 420 tests passed and 12 skipped. The skipped tests were
11 macOS Seatbelt cases plus one vector generator; because `bwrap` was absent,
the passing Linux sandbox tests checked argument construction and the
availability probe, not an executed containment boundary.

The repository also demonstrates why a green platform matrix is too coarse to
serve as a security receipt. Its GitHub workflow named “Sandbox — real OS
enforcement on each backend platform” is green on macOS, Linux, and Windows at
the pinned revision. Yet the checked suites provide different evidence:

- macOS tests actually launch commands under Seatbelt and test write and network
  denial;
- Linux tests inspect the generated bubblewrap arguments and probe whether
  `bwrap` exists, but do not execute an adversarial command through it; and
- Windows tests parse a fabricated success marker and inspect the PowerShell
  runner's text, but do not launch a target and demonstrate a denied effect.

The project's own verification matrix mostly preserves this distinction,
classifying Linux as “construction only locally” and Windows as a runner-output
parser test. The workflow name and job labels erase it. In addition, the
current top-level CI run is red because Windows `format:check` failed even while
the security and sandbox workflows are green. A repository-wide badge, a
workflow-level conclusion, a job title, and a claim-level enforcement receipt
therefore answer different questions.

**Verification rule:** for each platform and control, record the exact effect
attempted, the expected denial or allowance, whether the real backend launched,
and the resulting observation. Treat argument/profile construction, backend
availability, result parsing, and real enforcement as separate claim levels.
Skipped tests must remain visible, and an aggregate result must not promote the
weakest matrix cells to the strongest label. For high-impact controls, include
a denied-effect negative control and a permitted-effect positive twin on every
claimed platform.

RTQ remains an alpha project created one day before inspection with three stars
and no independent audit. Its threat model candidly trusts the host, and the
capability callback can ignore the supplied sandbox handle, so the framework
does not by itself prove that host code routes every effect through confinement.
The passing project-authored tests and green security workflows are useful
implementation evidence, not production validation.

- **Repo:** https://github.com/Latestinssan/RTQ
- **Inspected revision:** [`03006d4b0302b515d2d96ec19d8fcdf14ca83a1c`](https://github.com/Latestinssan/RTQ/commit/03006d4b0302b515d2d96ec19d8fcdf14ca83a1c)
- **Primary sources:** [verification matrix](https://github.com/Latestinssan/RTQ/blob/03006d4b0302b515d2d96ec19d8fcdf14ca83a1c/docs/SECURITY_VERIFICATION_MATRIX.md), [sandbox workflow](https://github.com/Latestinssan/RTQ/blob/03006d4b0302b515d2d96ec19d8fcdf14ca83a1c/.github/workflows/sandbox.yml), [Linux tests](https://github.com/Latestinssan/RTQ/blob/03006d4b0302b515d2d96ec19d8fcdf14ca83a1c/tests/sandbox/linux.test.ts), [Windows tests](https://github.com/Latestinssan/RTQ/blob/03006d4b0302b515d2d96ec19d8fcdf14ca83a1c/tests/sandbox/windows.test.ts), [macOS tests](https://github.com/Latestinssan/RTQ/blob/03006d4b0302b515d2d96ec19d8fcdf14ca83a1c/tests/sandbox/darwin.test.ts), [authorization/execution pipeline](https://github.com/Latestinssan/RTQ/blob/03006d4b0302b515d2d96ec19d8fcdf14ca83a1c/packages/security/src/index.ts), [green sandbox run](https://github.com/Latestinssan/RTQ/actions/runs/35508324861), and [failing aggregate CI run](https://github.com/Latestinssan/RTQ/actions/runs/35508324878)
- **Discovery query:** GitHub Repository Search API `"AI agent" in:name,description created:>=2026-09-20`, sorted by stars descending; `total_count: 998`, `incomplete_results: false`

## A Task Verdict Needs Product State, Oracle Controls, and Reachability — Compound Evals (GitHub, September 2026)

Compound Evals offers a concrete answer to a common agent-evaluation mistake: a
successful HTTP response, UI toast, or model-written completion message is not the
completed effect. Its reward hooks inspect Postgres state after an agent acts. Tasks
name the exact entity, state, attribution, and related rows that must exist, so a
plausible surface response cannot hide a write against the wrong lookalike record, a
missing object, an invented replacement record, or an operation performed under the
wrong actor.

The repository adds two independent controls around that state-based oracle. Each
task has an honest case that must score 1.0 and scripted cheap fakes that must score
0.0. This matters because negative cases alone can all fail for the same accidental
reason: the project reports an early 13/14 suite in which three cheats appeared to be
caught only because a UUID/string mismatch short-circuited a later guard; the honest
case exposed the dead path. Separately, task selection starts from reachable product
routes rather than database tables. Workflows found in the schema but absent from the
product surface are recorded as `not_gradable` instead of being converted into
fictional agent tasks.

At pinned revision
[`49fd05c6f79d6f5c2d1c10c7fec652aea8d08ef1`](https://github.com/kyisaiah47/compound-evals/commit/49fd05c6f79d6f5c2d1c10c7fec652aea8d08ef1),
the repository declares 24 environments, 109 tasks, 951 scripted cheats, 1,085
honest-plus-adversarial expectations, and 190 explicitly ungraded workflows. It also
contains one append-only run receipt for each task. Those author-produced receipts
record prompt hash, CLI version and exit, bounded output, per-guard scores, and timing;
the committed one-rollout Codex result has 93 task scores of 1.0 and 16 of 0.0. A
single rollout per task is useful incident-level evidence, not a stable capability
estimate or a cross-model comparison.

Scout downloaded the pinned archive and ran `tools/validate_results.py`; all 24 result
files passed its schema and cross-reference checks. That result has a narrower meaning
than the repository's recorded suite totals. The validator recomputes task, cheat,
guard, and browser-task counts; checks that each cheat names a declared guard; looks
for each task identifier in its `taskset.py`; and rejects incomplete model summaries.
It does **not** rerun the adversarial suites, bind recorded suite exit codes to an
execution receipt, or bind model receipts to a product commit, environment image, or
grader digest. The product applications are separate local trees, so Scout could not
independently recreate the full environments or rerun their browser/model evaluations
from this repository alone.

**Runtime rule:** grade the durable effect, then test the grader in both directions and
prove that the task is actually reachable. Preserve at least four separate receipts:
(1) product/environment identity, (2) agent execution and exact task prompt, (3)
post-action state-based reward details, and (4) oracle controls showing an honest path
accepted and realistic shortcuts rejected. Keep `not_gradable` explicit. A manifest
validator can prove internal result consistency, but it must not be described as proof
that the underlying suites just ran.

- **Repo:** https://github.com/kyisaiah47/compound-evals
- **Inspected revision:** [`49fd05c6f79d6f5c2d1c10c7fec652aea8d08ef1`](https://github.com/kyisaiah47/compound-evals/commit/49fd05c6f79d6f5c2d1c10c7fec652aea8d08ef1)
- **Primary sources:** [repository overview](https://github.com/kyisaiah47/compound-evals/blob/49fd05c6f79d6f5c2d1c10c7fec652aea8d08ef1/README.md), [fleet summary](https://github.com/kyisaiah47/compound-evals/blob/49fd05c6f79d6f5c2d1c10c7fec652aea8d08ef1/SUMMARY.md), [result schema](https://github.com/kyisaiah47/compound-evals/blob/49fd05c6f79d6f5c2d1c10c7fec652aea8d08ef1/RESULTS-SCHEMA.md), [result validator](https://github.com/kyisaiah47/compound-evals/blob/49fd05c6f79d6f5c2d1c10c7fec652aea8d08ef1/tools/validate_results.py), [model-evaluation runner](https://github.com/kyisaiah47/compound-evals/blob/49fd05c6f79d6f5c2d1c10c7fec652aea8d08ef1/tools/run_model_eval.py), and [example adversarial suite](https://github.com/kyisaiah47/compound-evals/blob/49fd05c6f79d6f5c2d1c10c7fec652aea8d08ef1/envs/unemploy-desk/adversarial/prove_graders.py)
- **Discovery query:** GitHub Repository Search API `"agent evaluation" in:name,description created:>=2026-09-18`, sorted by stars; 30 results, `incomplete_results: false`

## Reviewer Diversity, Verdict Transport, and Acceptance Are Separate Controls — Portable DSH (HN / GitHub, September 2026)

Portable DSH is a new host plugin that makes three often-collapsed review controls
separately observable. First, a review route prefers a provider different from the
producer, but does not weaken capability-evidence requirements to obtain that
diversity. If no qualified alternative exists, it can continue with the same
provider while recording `independent: false` and a reason. Diversity is therefore
an attributed property of a review, not a synonym for correctness.

Second, the review result travels through a four-state contract: `verified`,
`partial`, `failed`, or `needs-clarification`, plus an `onObjective` boolean. The
loop accepts a host-enforced structured object or valid JSON with that shape; it
does not infer a verdict from free-form prose. Missing or malformed output becomes
`VERDICT_UNREADABLE`, exhausted cycles become `UNCONVERGED`, and missing facts can
exit as `NEEDS_CLARIFICATION`. These states prevent transport failure, retry limits,
and uncertainty from being silently normalized into success.

Third, the orchestrator uses the declared verdict only to decide whether another
bounded revision cycle may run. It stores the reviewer's declaration rather than
re-judging the artifact itself. That is an important boundary, but it also means
`verified` remains a model-produced assertion: an external owner or admission
policy must decide whether that assertion is sufficient to accept the work. A
different provider can reduce shared model-family blind spots; it does not create
acceptance authority or prove the artifact correct.

The implementation adds a related effect-safety rule: read-only work may continue
after a clean token-limit stop, while work allowed to write files or run commands
stops for reconciliation rather than replaying uncertain side effects. Together,
these choices suggest a reusable record with independent fields for producer
identity, reviewer identity and provider relationship, qualification evidence,
verdict source and schema validity, loop stop reason, side-effect status, and the
separate admission decision.

Scout checked revision
[`cd16e198857891369fa52ac48ac7b53a976add4f`](https://github.com/WDahah/portable-dsh-multi-agent-plugin/commit/cd16e198857891369fa52ac48ac7b53a976add4f)
and reproduced its dependency-free test suite: 157 tests passed with no failures.
That validates the checked offline routing, persistence, parsing, and loop cases,
not the README's live cross-provider example, model competence, review accuracy, or
production host integration. The repository was created the same day as the HN
post and had no stars or forks when checked. Its `VALIDATION.md` also still names
package 1.0.0 and 61 tests while `package.json` is 1.9.2 and the current suite has
157, so that document is stale evidence and should not be used as the current
release receipt.

- **HN:** https://news.ycombinator.com/item?id=49779043
- **Repo:** https://github.com/WDahah/portable-dsh-multi-agent-plugin
- **Inspected revision:** [`cd16e198857891369fa52ac48ac7b53a976add4f`](https://github.com/WDahah/portable-dsh-multi-agent-plugin/commit/cd16e198857891369fa52ac48ac7b53a976add4f)
- **Primary sources:** [repository overview](https://github.com/WDahah/portable-dsh-multi-agent-plugin/blob/cd16e198857891369fa52ac48ac7b53a976add4f/README.md), [design notes](https://github.com/WDahah/portable-dsh-multi-agent-plugin/blob/cd16e198857891369fa52ac48ac7b53a976add4f/docs/DESIGN-NOTES.md), [verdict contract](https://github.com/WDahah/portable-dsh-multi-agent-plugin/blob/cd16e198857891369fa52ac48ac7b53a976add4f/src/verdict.mjs), and [validation record](https://github.com/WDahah/portable-dsh-multi-agent-plugin/blob/cd16e198857891369fa52ac48ac7b53a976add4f/VALIDATION.md)
- **Discovery feed:** HN Algolia `search_by_date?query=agent&tags=story&numericFilters=created_at_i>=1789846570&hitsPerPage=100`

## Probabilistic Rule Checks Need Phase-Specific Calibration — Abide (GitHub, September 2026)

Abide is an early implementation of a useful middle layer between instruction files
and deterministic linters. It compiles repository instructions into a readable
rubric, scopes rules to file globs, checks individual edits and whole-turn diffs at
separate phases, and maps model probabilities into clear, flag, or act bands. The
hook implementation does not pretend every edit was observed: incomplete diffs,
missing keys, check failures, and incomplete turn snapshots are written as skip or
error events, while the host is allowed to continue. A turn-level fallback also
rechecks edits that were not proven to cover the final file state.

The repository's own replay benchmark shows why these verdicts cannot be treated as
one uniformly calibrated gate. At the configured 0.8 action threshold, an author-run
replay over 93 Claude Code sessions reports 39 flagged edits with 10 confirmed by a
Claude reviewer (26% precision), versus 15 flagged turns with 11 confirmed (73%).
The strongest turn rules reason about properties such as single-use abstractions,
oversized files, and duplicated logic that are not answerable from the first edit.
The repository also preserves per-rule calibration summaries and labels rules
`skipped`, `noisy`, `weak`, or `decisive` rather than inferring quality from one
aggregate score.

This suggests a reusable design rule: **calibrate probabilistic policy checks by
phase, rule, and consequence**. An edit-level semantic signal with low measured
precision may still be valuable as feedback, but should not inherit the same blocking
authority as a better-calibrated turn-level rule. Publish the confusion evidence and
sample count behind each threshold; retain `unchecked`, `skipped`, and `error` as
coverage states; and use deterministic controls for rules that can be linted. Model
verdicts can request repair, but external effects and final acceptance still need a
separate, independently enforced boundary.

The evidence is narrower than the product headline. Replay reconstructed edit and
turn diffs from transcripts rather than running tasks again, omitted shell-written
changes, did not measure whether agents repaired a flagged change, and reviewed
private hunks that are not published. The reviewer was another model, not an
independent human study; recall was sampled only from 20 near-threshold cleared
hunks. Scout inspected the pinned source, benchmark method, and published aggregate
JSON but did not install the package, rerun the replay, or validate the hosted model's
calibration. This is therefore implementation and author-run retrospective evidence,
not independent proof that the checker prevents violations in live sessions.

- **Repo:** https://github.com/coldteadotai/abide
- **Inspected revision:** [`f2683828965ced03da07abae811e78af0383040c`](https://github.com/coldteadotai/abide/commit/f2683828965ced03da07abae811e78af0383040c)
- **Primary sources:** [repository overview](https://github.com/coldteadotai/abide/blob/f2683828965ced03da07abae811e78af0383040c/README.md), [replay method and limitations](https://github.com/coldteadotai/abide/blob/f2683828965ced03da07abae811e78af0383040c/benchmarks/replay/README.md), [published aggregates](https://github.com/coldteadotai/abide/blob/f2683828965ced03da07abae811e78af0383040c/benchmarks/replay/results-2026-09-18.json), [edit hook](https://github.com/coldteadotai/abide/blob/f2683828965ced03da07abae811e78af0383040c/packages/cli/src/hooks/postToolUse.ts), [turn hook](https://github.com/coldteadotai/abide/blob/f2683828965ced03da07abae811e78af0383040c/packages/cli/src/hooks/stop.ts), and [calibration classifier](https://github.com/coldteadotai/abide/blob/f2683828965ced03da07abae811e78af0383040c/packages/cli/src/lib/calibration.ts)
- **Discovery query:** GitHub Repository Search API `agent in:name,description created:>=2026-09-18`, sorted by stars; 16,615 results, `incomplete_results: false`

## Executable Governance Needs Cross-Artifact Conformance — OutTheBox (HN / GitHub, September 2026)

OutTheBox Open Patterns is a small, vendor-authored repository that expresses
three agent-governance checks in parallel forms: prose, a DMN decision table,
and a JSON template intended to map onto Microsoft Agent 365. The checked DMN
files are well-formed XML and make two useful policy choices explicit: `unknown`
evidence does not silently pass, and an alert does not count as an enforced
budget circuit breaker. The inventory and budget templates also agree with
their DMN tables on input names and listed recommendation values.

The identity-sponsorship pattern exposes the harder integrity problem. Its DMN
requires five facts—named individual, active status, explicit acceptance,
actual authority, and current review—and returns eight fields, including status,
reason, owner, deadline, restriction, evidence reference, and enforcement state.
The adjacent JSON template asks only three differently named questions, omitting
explicit acceptance and review currency; its `possibleValues` mix the DMN's
reason codes with a status-like field. All three JSON templates also point to
source-pattern and source-table filenames that do not exist in the checked tree.

This means an individual decision table can be exhaustive while the deployable
bundle is inconsistent. The repository says its logic was tested over every
input combination, but revision
[`c7d6fa84ad8b289116599966fc1bb2a853c19231`](https://github.com/scubagraham/outthebox-open-patterns/commit/c7d6fa84ad8b289116599966fc1bb2a853c19231)
contains no test files or CI configuration from which that claim can be
independently checked. The templates themselves correctly warn that their
Agent 365 shape is author-defined rather than a verified Microsoft schema.

**Runtime rule:** treat a governance bundle as one versioned contract. Generate
or validate every prose, decision-table, platform-template, and enforcement
projection against a canonical input/output schema. Conformance should fail on
missing fields, renamed semantics, unreachable references, output-domain drift,
and unsupported target-platform schemas. Separately test that each table covers
valid combinations and rejects malformed input, and bind the resulting receipt
to the exact bundle revision. Finally, keep decision logic distinct from effect
enforcement: a DMN verdict that says `BLOCKED` or `BREACH_CONTAINED` is not proof
that a runtime actually denied or throttled anything.

This is artifact-consistency evidence from a new zero-star repository, not an
independent validation of the policies, the claimed exhaustive testing,
Microsoft compatibility, or production effectiveness.

- **HN:** https://news.ycombinator.com/item?id=49767956
- **Repo:** https://github.com/scubagraham/outthebox-open-patterns
- **Inspected revision:** [`c7d6fa84ad8b289116599966fc1bb2a853c19231`](https://github.com/scubagraham/outthebox-open-patterns/commit/c7d6fa84ad8b289116599966fc1bb2a853c19231)
- **Primary sources:** [repository overview](https://github.com/scubagraham/outthebox-open-patterns/blob/c7d6fa84ad8b289116599966fc1bb2a853c19231/README.md), [identity DMN](https://github.com/scubagraham/outthebox-open-patterns/blob/c7d6fa84ad8b289116599966fc1bb2a853c19231/patterns/agent-identity-ownership-sponsor-assignment/decision-table.dmn), and [identity JSON template](https://github.com/scubagraham/outthebox-open-patterns/blob/c7d6fa84ad8b289116599966fc1bb2a853c19231/patterns/agent-identity-ownership-sponsor-assignment/agent365-template.json)

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

### Track the Outcome After Verification, Without Collapsing Lifecycle States (2026-09-20 update)

RepoPilot's next pinned revision extends this boundary beyond draft-PR publication.
Its opt-in tracker first revalidates that a PR still belongs to the goal's expected
repository, base branch, and generated head branch. After merge, it reads configured
checks against the merge commit and keeps `waiting_for_merge`, `observing`,
`healthy`, `regressed`, and `closed_unmerged` distinct. It can also require the
source Issue to be closed. A regression becomes a deduplicated, reviewable proposal;
it does not authorize a new repair run by itself.

The same revision adds explicit evaluation identities—suite, case, and profile—and
derives a case digest from repository, pinned commit, and goal definition. Reports
separate completed, verified, published, and post-merge-healthy outcomes; retain
per-case evidence; expose duplicate suite/profile/case keys; and flag cases whose
pinned subject or goal differs across profiles. This is preferable to a single
"agent success" score because publication and observed release health are different
claims.

Two limitations matter. `postMergePassRate` is calculated only over cases with an
observed `healthy` or `regressed` result, so it must be published with the observed
count rather than read as coverage of the whole suite. The repository documentation
also says terminal results are not automatically polled again, so a prior healthy
observation is not a continuous health guarantee. Scout reviewed the pinned code,
documentation, and repository-authored tests statically; it did not run the suite or
observe a live GitHub check.

**Runtime rule:** bind evaluation identity to the task definition, source revision,
and execution profile, then report lifecycle depth explicitly. A verified patch, a
published PR, and a healthy merged revision are progressively stronger but
non-interchangeable verdicts; every rate needs a denominator that reveals which
cases actually reached the measured stage.

- **Updated inspected revision:** [`a97fab7e11f85b87a3b74fd613f82b9ea2cac605`](https://github.com/indada/repopilot/commit/a97fab7e11f85b87a3b74fd613f82b9ea2cac605)
- **Change from prior inspected revision:** [one-commit comparison](https://github.com/indada/repopilot/compare/d184928c7bfef6bc0d7228f9d282f0ae2e56fda1...a97fab7e11f85b87a3b74fd613f82b9ea2cac605)
- **Primary sources:** [post-merge contract](https://github.com/indada/repopilot/blob/a97fab7e11f85b87a3b74fd613f82b9ea2cac605/docs/POST-MERGE-EVALUATION.md), [post-merge classifier](https://github.com/indada/repopilot/blob/a97fab7e11f85b87a3b74fd613f82b9ea2cac605/src/application/post-merge.ts), [evaluation aggregation](https://github.com/indada/repopilot/blob/a97fab7e11f85b87a3b74fd613f82b9ea2cac605/src/application/evaluation.ts), and [repository-authored tests](https://github.com/indada/repopilot/blob/a97fab7e11f85b87a3b74fd613f82b9ea2cac605/tests/post-merge.test.ts)
- **Discovery query:** GitHub Repository Search API `agent in:name,description created:>=2026-09-17`, sorted by stars; 22,449 results, `incomplete_results: false`

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

## Audit Normalization Must Preserve Action Phase and Decision Cause — node9 (GitHub, September 2026)

[node9](https://github.com/node9-ai/node9-proxy) exposes a concrete failure mode in
agent-governance telemetry: multiple producers can use superficially similar words
for events at different phases. At pinned revision
`915735f92d988423203707a749d63b6298defa2c`, its audit reader has to reconcile gate
rows (`allow`/`deny`), post-tool execution rows (`allowed`), daemon decisions
(`auto-deny`), pending reviews, DLP findings, and MCP discovery records. A former
reader reportedly treated every value other than literal `block` or `review` as an
allow, making 12,176 `deny` rows look permitted; another reader counted findings as
denials.

The repair is a central classifier with two levels of meaning. A coarse outcome
supports counting (`allow`, `deny`, `observe`, `info`, or `unknown`), while the label
retains cause and phase: **Approved** versus **Auto-allowed**, **Denied** versus
**Blocked** versus **Timed out**, **Would block** for shadow mode, **Ran** for a
post-tool execution record, and **Finding** for DLP output. Unknown vocabulary fails
loud as `unknown` while preserving the raw value; it never falls through to allow.
The row-form API also reads attribution from either `checkedBy` or `source`, avoiding
a per-reader choice that had reportedly erased human attribution on 37,576 rows.

Two repository-authored tests make the pattern stronger than a taxonomy alone. The
decision suite replays the exact decision/source pairs and frequencies observed in a
101,000-row local audit log, checks the aggregate distribution, and uses explicit
unknown-value and timeout-versus-human-denial controls. Separately, the gate-contract
matrix replays sanitized payload envelopes captured from Claude Code, Gemini CLI,
and Codex through the built CLI, then changes only the requested command or path to
prove both an allowed case and a credential-read denial. Missing live captures for
Copilot, Antigravity, and Hermes remain visible as `todo` cases rather than synthetic
fixtures.

The implementation also shows what this does **not** prove. Its coverage helper can
flag a session found in `hook-debug.log` but absent from `audit.log`, but only when a
debug line is JSON-parseable and carries a session ID. It counts non-JSON debug lines
without attributing them and does not establish that every effect generated either
record. Correctly classifying available rows is therefore distinct from proving log
completeness, and a post-tool **Ran** row is still not proof that the intended
semantic effect succeeded.

**Runtime rule:** normalize audit vocabulary once, but preserve orthogonal fields for
action phase, policy outcome, enforcement mode, actor/cause, and raw producer value.
Never collapse shadow-mode would-blocks into allows, timeouts into human denials,
findings into decisions, or execution observations into authorizations. Test the
normalizer against captured production shapes plus known-bad mutations, and measure
missing receipts separately from classification correctness.

- **Repo:** https://github.com/node9-ai/node9-proxy
- **Inspected revision:** [`915735f92d988423203707a749d63b6298defa2c`](https://github.com/node9-ai/node9-proxy/commit/915735f92d988423203707a749d63b6298defa2c)
- **Primary sources:** [central decision classifier](https://github.com/node9-ai/node9-proxy/blob/915735f92d988423203707a749d63b6298defa2c/src/audit/decision.ts), [live-derived classifier tests](https://github.com/node9-ai/node9-proxy/blob/915735f92d988423203707a749d63b6298defa2c/src/__tests__/audit-decision.unit.test.ts), [captured gate-contract matrix](https://github.com/node9-ai/node9-proxy/blob/915735f92d988423203707a749d63b6298defa2c/src/__tests__/gate-contract.matrix.test.ts), and [hook-to-audit coverage helper](https://github.com/node9-ai/node9-proxy/blob/915735f92d988423203707a749d63b6298defa2c/src/audit/coverage.ts)
- **Evidence level:** pinned source, README, repository tree, and project-authored tests inspected; the complete tree contained 686 entries and was not truncated. Scout did not run the package, inspect the underlying private audit log, or independently reproduce the reported historical row counts.
- **Discovery query:** GitHub Repository Search API `topic:ai-agent pushed:>=2026-09-20 stars:>50`, sorted by update time; `incomplete_results: false`
