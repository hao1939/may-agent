<ai_context>
summary: "Runtime patterns for keeping checker eligibility separate from acceptance authority, binding review approval to actor and content provenance, deriving readiness from live premises at admission time, reconciling expected outcomes against the tested release, and normalizing heterogeneous audit decisions without losing action phase or cause."
triggers: ["checker eligibility", "acceptance authority", "FinalAcceptance", "ContributionRecord", "Workstream", "review provenance", "content-addressed approval", "CRT", "transactional readiness", "live premises", "Amenbo", "XFAIL", "XPASS", "release-aware conformance", "Monet E2E", "audit outcome normalization", "decision vocabulary", "shadow mode", "approval timeout", "execution record", "node9"]
last_updated: "2026-09-21"
source_basis: "Extracted intact from agent-runtime-verdict-integrity.md during its 2026-09-21 oversized-note review, then extended with ShiroDoromoto/amenbo revision 23cdac267aefa6806460c9c1c36a0eba8f105993. Other sources are Flow-Research/workstream revision d5dd94d3f1f4e52fa9f191e88d3c210758bb4b3b; imron/crt revision e3ff1126b06528048673573a667bf3561f185539; team-monet/monet-e2e revision ba8acbc55a4574b3a453dcbf49842f7fb363f70c; and node9-ai/node9-proxy revision 915735f92d988423203707a749d63b6298defa2c. Reproduction and static-inspection limits remain stated in each section."
</ai_context>

# Agent Runtime Acceptance and Reconciliation

**Companion note** to [Agent Runtime Verdict Integrity](./agent-runtime-verdict-integrity.md).

These patterns begin after a verifier has produced a result. They preserve the
boundaries between eligibility and acceptance, content freshness and reviewer
authority, expected and observed release behavior, and policy decisions versus
execution or telemetry records.

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


## Readiness Should Be Recomputed from Live Premises at Admission — Amenbo (GitHub, September 2026)

Amenbo provides a concrete implementation of a useful scheduling distinction:
a task's workflow status and its readiness to begin are different facts. A task
can remain `todo` while four independent premises determine whether it is
startable: no dependency is still open, every linked decision is settled and
current, its declared start date has arrived, and task creation is complete.
The CLI exposes the reasons through `ready:no`, while reservation rejects an
unready task with typed reason parts rather than a generic failure.

The stronger pattern is that discovery and admission share one predicate. The
mailbox's `ready:yes` filter and the reservation guard both derive their answer
from the same source-of-truth query, and a repository-authored test toggles each
of the four premises to check that the two surfaces stay equivalent. On the
write path, current status and premise blockers are read inside the same write
transaction as the `todo` to `in_progress` transition. A compare-and-set check
first distinguishes an already-held reservation from unmet premises; there is
no actor exemption or force flag.

This design avoids two common races: an agent cannot start work merely because
an earlier listing said it was ready, and a direct reservation cannot bypass a
condition hidden by the mailbox. It also preserves cause. Concurrent ownership
returns `already_reserved`; unmet dependencies or decisions return `not_ready`
with separate typed parts, allowing a host to route the right follow-up instead
of treating all refusals as contention.

One boundary is equally important. The readiness guard fires only when entering
`in_progress`. Adding a dependency or reopening a linked decision after work has
started does **not** revoke the reservation. That is a deliberate transition
contract, not continuous invariant enforcement. Systems that require active
work to pause when premises regress need a separate reconciliation consumer,
lease invalidation rule, or interrupt protocol; recomputing readiness only at
admission cannot provide that guarantee.

**Runtime rule:** represent readiness as a derived predicate over live premises,
not as a stale status bit. Use the same derivation for discovery and admission,
recheck it transactionally with the ownership transition, and preserve typed
causes. Separately specify whether later premise changes merely become visible
or actively invalidate work already in progress.

- **Repo:** https://github.com/ShiroDoromoto/amenbo
- **Inspected revision:** [`23cdac267aefa6806460c9c1c36a0eba8f105993`](https://github.com/ShiroDoromoto/amenbo/commit/23cdac267aefa6806460c9c1c36a0eba8f105993)
- **Primary sources:** [README task and decision contract](https://github.com/ShiroDoromoto/amenbo/blob/23cdac267aefa6806460c9c1c36a0eba8f105993/README.md), [transactional reservation guard and repository-authored tests](https://github.com/ShiroDoromoto/amenbo/blob/23cdac267aefa6806460c9c1c36a0eba8f105993/crates/amenbo-core/src/ops/task.rs), and [decision transition and supersession semantics](https://github.com/ShiroDoromoto/amenbo/blob/23cdac267aefa6806460c9c1c36a0eba8f105993/crates/amenbo-core/src/ops/decision.rs)
- **Evidence level:** pinned static source and checked-in tests inspected; the GitHub tree response was not truncated. Scout did not compile or execute the repository, so this is implementation evidence rather than a reliability or concurrency benchmark.
- **Discovery query:** GitHub Repository Search API `"AI agent" sandbox in:name,description,readme pushed:>=2026-09-20`, sorted by update time; `incomplete_results: false`

## Related Verification Patterns

For subject binding, receipt coverage, negative controls, evaluator integrity,
and verdict transport, see [Agent Runtime Verdict Integrity](./agent-runtime-verdict-integrity.md#verification-evidence-binding--brigade-github-august-2026).
