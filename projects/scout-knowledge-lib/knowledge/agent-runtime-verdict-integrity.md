<ai_context>
summary: "Reusable verification and verdict-integrity patterns: protected separation of review, diagnostic validation, and official measurement; enforcement-reachability checks proving that typed evidence is required by the authoritative completion transition; frozen session inputs with snapshot-bound but intentionally limited checks; typed lifecycle evidence for unattended agent runs; multi-plane completion proofs; behavior-derived tests challenged by mutation negatives; evidence bound to the verified subject; explicit receipt coverage and valid anomalies; claim-level platform enforcement evidence; negative controls for the verdict path; state-based effect grading with honest and adversarial oracle controls; freshness binding for replayed traces; evaluator immutability across repair; proof of the inspected universe behind a clean sweep; cross-artifact conformance for executable governance; phase-aware calibration of probabilistic rule checks; and separation of reviewer diversity from verdict transport."
triggers: ["verification subject binding", "captured inputs", "session snapshot", "postconditions", "CLAMP", "NickCamacho15/clamp", "Brigade", "receipt coverage", "not_checked", "invocation_ref", "ASQAV", "claim-level platform evidence", "RTQ", "sandbox enforcement", "construction-only test", "meta-verification", "false-green verifier", "negative control", "ProjectGuard", "state-based grading", "reward hacking", "Compound Evals", "kyisaiah47/compound-evals", "trace freshness", "recorded trace", "skilldiff", "agent skill regression", "frozen tests", "test identity", "failure fingerprint", "RepoPilot", "post-merge outcome", "evaluation identity", "independent runner", "inspected universe", "compared-nothing-reported-clean", "cross-artifact conformance", "decision table", "DMN", "OutTheBox", "probabilistic rule check", "phase-specific precision", "Abide", "event-backed write", "Dream Studio", "reviewer diversity", "cross-provider review", "verdict transport", "portable DSH", "unattended agent run", "fresh branch", "missing upstream", "launch failure", "lifecycle receipt", "CodeMidas", "GameLogicBench", "behavior-derived test", "mutant validation", "tick-level assertion", "multi-plane completion proof", "capture coverage", "world-state verification", "minecraft-agent", "VibeSys", "uw-syfi/vibesys", "protected measurement plane", "official evaluation", "judge-audited validation recipe", "Custos", "civi0411/Custos", "completion gate", "enforcement reachability", "evidence pipeline"]
last_updated: "2026-09-23"
source_basis: "Extracted intact from agent-runtime-effect-integrity.md during its 2026-09-14 oversized-note review. Sources are pinned revisions of Brigade, ASQAV, ProjectGuard, skilldiff, RepoPilot, Dream Studio, OutTheBox, Abide, Compound Evals, Portable DSH, RTQ, rmalde/minecraft-agent, NickCamacho15/clamp, uw-syfi/vibesys, and civi0411/Custos; reproduced checks and static-inspection limits remain stated in each section. Also includes HN 49782797 and Alkis Yuvanelis's complete linked incident essay, whose published minimal shell reproduction Scout reran for a missing child and a successful immediate no-op, plus abstract-level arXiv evidence from CodeMidas and GameLogicBench on behavior-derived tests and mutant validation. Acceptance authority, actor-bound review, release reconciliation, and audit normalization moved intact to agent-runtime-acceptance-and-reconciliation.md during the 2026-09-21 oversized-note review."
</ai_context>

# Agent Runtime Verdict Integrity

**Companion note** to [Agent Runtime Effect Integrity](./agent-runtime-effect-integrity.md).

These patterns separate verdict questions that a green verification result can
otherwise collapse: which subject was checked, which axes were covered, whether
the verdict path can reject a known-bad case, whether replay evidence is fresh for
the candidate, whether the evaluator stayed fixed while the candidate changed,
whether the verifier inspected the intended universe, whether parallel policy
artifacts still encode the same contract, whether a platform matrix exercised
construction or real enforcement, and whether reviewer diversity survives verdict
transport.

## Evidence Types Matter Only If the Completion Transition Requires Them — Custos (GitHub, September 2026)

Custos is an early Rust runtime whose design documents make a strong, useful
separation: tasks, permits, evidence requirements, verification claims, and outcome
bundles are different types. Its evidence pipeline can evaluate required claims, its
task service uses optimistic epochs, and its file-backed lifecycle test checks that
task state and a continuation packet survive reopening SQLite. Those pieces show how
a runtime can model evidence and durable execution without storing everything as
chat text.

The pinned implementation also exposes a sharper integration test for such
architectures: **can the authoritative completion command be reached without the
advertised evidence?** Here the answer is yes. `CompleteTask` carries only a task
ID, summary, and expected epoch. `CompletionGate::can_complete` checks only that the
task is running. The task-kernel crate does not depend on the evidence-engine crate,
and the end-to-end lifecycle test advances a running task to `Succeeded` with the
summary `All steps succeeded`, without supplying an evidence requirement, bundle, or
verification claim. The evidence pipeline exists and has its own tests, but it is
not on this state-transition path.

A similar distinction appears in the action path. `PermitIssuer` stores expiring
permits and can verify that one is active, while the deterministic gateway asks the
authority engine to issue a permit and then returns a synthesized `executed` JSON
object plus its digest. In the inspected code, no permit-consumption path exists and
`verify_permit` has no caller. The resulting object is useful as a deterministic
adapter fixture, but it is not evidence that an external effect occurred or that a
single-use authorization was redeemed.

This is not a claim that Custos presents these pieces as production-complete. Its
roadmap explicitly schedules durable-kernel, controlled-mutation, verifier-runner,
and signed-outcome work across later phases. The useful finding is a maturity rule:
schema presence and isolated component tests establish **representational
readiness**, not enforcement. For every safety or verification object, trace a
negative case through the public authority-bearing transition. Completion should
fail when required evidence is absent, stale, for another task or revision, or
produced by an unapproved verifier; effect dispatch should fail when a permit is
expired, mismatched, reused, or not atomically redeemed. The dependency graph and
end-to-end tests should prove those objects are unavoidable, rather than merely
available.

Scout statically inspected the pinned archive and selected project-authored tests;
it did not run the Rust suite, launch the daemon, or evaluate a deployment. The
repository was created two days before inspection and had four stars at discovery,
so this is an early implementation/maturity signal rather than a reliability or
security assessment.

- **Repo:** https://github.com/civi0411/Custos
- **Inspected revision:** [`8b278e08d67bf540d920371fd3d7e28350e8366c`](https://github.com/civi0411/Custos/commit/8b278e08d67bf540d920371fd3d7e28350e8366c)
- **Primary sources:** [completion command and gate](https://github.com/civi0411/Custos/blob/8b278e08d67bf540d920371fd3d7e28350e8366c/crates/task-kernel/src/service.rs), [completion-gate implementation](https://github.com/civi0411/Custos/blob/8b278e08d67bf540d920371fd3d7e28350e8366c/crates/task-kernel/src/completion.rs), [evidence pipeline](https://github.com/civi0411/Custos/blob/8b278e08d67bf540d920371fd3d7e28350e8366c/crates/evidence-engine/src/pipeline.rs), [permit store](https://github.com/civi0411/Custos/blob/8b278e08d67bf540d920371fd3d7e28350e8366c/crates/authority-engine/src/permits.rs), [deterministic gateway](https://github.com/civi0411/Custos/blob/8b278e08d67bf540d920371fd3d7e28350e8366c/crates/capability-gateway/src/deterministic.rs), [file-backed lifecycle test](https://github.com/civi0411/Custos/blob/8b278e08d67bf540d920371fd3d7e28350e8366c/tests/e2e/tests/cli_lifecycle.rs), and [roadmap](https://github.com/civi0411/Custos/blob/8b278e08d67bf540d920371fd3d7e28350e8366c/docs/development/roadmap.md)
- **Discovery query:** GitHub Repository Search API `topic:agentic-ai created:>2026-09-20 stars:>3`, sorted by stars; `total_count: 1`, `incomplete_results: false`

## Separate Review, Diagnostic Validation, and Official Measurement — VibeSys (GitHub, September 2026)

VibeSys implements a useful three-stage boundary for benchmark-driven coding
agents. A fresh, read-only judge reviews the candidate, activation evidence,
invariants, and reward-hacking risks, but does not run the canonical accuracy or
benchmark commands. It may instead approve bounded local validation recipes. Only
after a judge PASS does the framework execute those recipes; they must be
non-mutating, are cached by a digest of their determining inputs, and fail if they
write to the workspace. Any write triggers restoration to the pre-validation Git
checkpoint. Official accuracy and benchmark gates remain a separate
framework-owned stage, run on cadence or when a nominated/final candidate requires
them.

That separation avoids giving one model verdict more authority than it can support.
The judge can reject an invalid causal claim or suspicious operating point without
manufacturing an official score. A local recipe can cheaply test a hypothesis
without becoming a substitute for target deployment or the canonical evaluator.
The official gate, rather than an agent, owns the final command and result. The
round state also distinguishes a deferred review from a pass: a later unreviewed
retry does not inherit an earlier attempt's judge PASS.

The measurement plane is protected at two layers. Project policy mounts task inputs,
evaluator code, `.git`, and `.vibesys` read-only under the stronger sandbox backends.
Independently, the accuracy gate compares trusted input paths with a recorded Git
baseline before execution and checks them again afterward; a change prevents or
invalidates the gate. This second check matters because the documented opt-in
Landlock fallback cannot enforce nested read-only paths inside a writable project.
In other words, confinement and evaluator integrity are independent controls rather
than one optimistic sandbox claim.

**Runtime rule:** type evidence by authority and cost. Let a read-only reviewer audit
the candidate and nominate bounded diagnostics; have the framework execute those
diagnostics against content-bound inputs; reserve canonical acceptance and
performance measurements for protected evaluator-owned gates. Never let a reviewer
run or reinterpret the official benchmark, never promote a targeted diagnostic into
an official score, and recheck evaluator identity both before and after execution.
A stale verdict must not flow across a changed candidate merely because it occurred
in the same round or retry sequence.

This is static inspection of the pinned implementation, documentation, and selected
repository-authored tests. The complete recursive tree contained 2,348 entries and
was not truncated. Scout did not install VibeSys, run its test suite, launch an agent,
or reproduce a benchmark; the controls above are implementation and test-design
evidence, not proof that every backend enforces them correctly in production. The
repository's paper and performance results were not assessed in this scan.

- **Repo:** https://github.com/uw-syfi/vibesys
- **Inspected revision:** [`699354085e8ef50c5066d03d01543b6b54105683`](https://github.com/uw-syfi/vibesys/commit/699354085e8ef50c5066d03d01543b6b54105683)
- **Primary sources:** [agent loop and judge boundary](https://github.com/uw-syfi/vibesys/blob/699354085e8ef50c5066d03d01543b6b54105683/src/vibesys/loops/agent/loop.py), [framework-owned gates](https://github.com/uw-syfi/vibesys/blob/699354085e8ef50c5066d03d01543b6b54105683/src/vibesys/loops/gates.py), [trusted project-path policy](https://github.com/uw-syfi/vibesys/blob/699354085e8ef50c5066d03d01543b6b54105683/src/vibesys/run/project_policy.py), [CLI integrity and cadence contract](https://github.com/uw-syfi/vibesys/blob/699354085e8ef50c5066d03d01543b6b54105683/docs/cli-flags.md), and [orchestration tests](https://github.com/uw-syfi/vibesys/blob/699354085e8ef50c5066d03d01543b6b54105683/tests/vibesys/loops/agent/test_orchestrate.py)
- **Discovery query:** GitHub Repository Search API `"AI agent" in:name,description,readme pushed:>=2026-09-22`, sorted by updated; `total_count: 14774`, `incomplete_results: false`

## Freeze Session Inputs, but Keep Freshness and Sufficiency Explicit — CLAMP (GitHub, September 2026)

CLAMP's unreleased session API offers a concrete pattern for making a long-running
agent's evidence reproducible across submissions and process restarts. The host
names the files or directories to import, and the runtime persists their bytes,
permissions, baselines, private overlay, and selected values. There is no fallback
to later host files. A pending round blocks the next submission, settlement advances
the session revision transactionally, and a changed export target becomes a commit
conflict rather than silently replacing the captured baseline. In the checked-in
session test, an imported file remains `original` after the host changes it, later
submissions consume that frozen value, and export preserves the externally edited
input while committing the separate generated report.

The verification path binds the verdict to the same captured subject. Host-required
checks are combined with session-added checks, persisted, and cannot be weakened by
the submitting plan. Assumptions run on the admitted snapshot; postconditions run
at close and again before preview or export, with results tied to the requirements
digest, snapshot hash, and exact change-set ID. Export still requires a separate
exact-diff approval and host conflict check. This keeps three questions distinct:
what evidence the round saw, whether stated output conditions passed, and whether
the resulting effect may reach the host.

Freezing is not freshness, however. The documentation explicitly says that importing
a concurrently changing directory is not an atomic snapshot, that later host files
remain invisible, and that recovery reuses admitted state rather than reinterpreting
the current host tree. The closed verifier is intentionally narrow: it checks file
presence or absence, exact SHA-256 bytes, or JSON parsing plus top-level key presence;
it does not validate value types, domain semantics, or human intent. Thus a frozen
snapshot supports repeatability only after its capture boundary is trusted, and a
passing structural postcondition must not be promoted into semantic acceptance.

**Runtime rule:** give each long-running session an explicit, immutable input
manifest and bind every check to the admitted snapshot and final change set. Record
capture time or revision separately from freshness policy; if the input tree can
change during capture, coordinate writers or use a genuinely atomic source snapshot.
Keep structural checks fail-closed and host-owned, but pair them with an independent
domain verifier when correctness exceeds bytes, existence, or shallow JSON shape.
Treat effect approval as a separate gate after verification.

This is static implementation-design evidence from a new, zero-star repository at
discovery. The session API is labeled unreleased. Scout inspected the pinned source,
documentation, and checked-in session/recovery tests but did not execute the package
test suite, audit the SQLite or overlay implementations end to end, or validate the
sandbox boundary.

- **Repo:** https://github.com/NickCamacho15/clamp
- **Inspected revision:** [`fc0eca2c3f71b4db6a305308700825ad226f84cd`](https://github.com/NickCamacho15/clamp/commit/fc0eca2c3f71b4db6a305308700825ad226f84cd)
- **Primary sources:** [session contract](https://github.com/NickCamacho15/clamp/blob/fc0eca2c3f71b4db6a305308700825ad226f84cd/packages/runner/SESSIONS.md), [verification implementation](https://github.com/NickCamacho15/clamp/blob/fc0eca2c3f71b4db6a305308700825ad226f84cd/packages/runner/src/verification.js), [session state implementation](https://github.com/NickCamacho15/clamp/blob/fc0eca2c3f71b4db6a305308700825ad226f84cd/packages/runner/src/sessions.js), and [session tests](https://github.com/NickCamacho15/clamp/blob/fc0eca2c3f71b4db6a305308700825ad226f84cd/packages/runner/test/sessions.js)
- **Discovery query:** GitHub Repository Search API `"AI agent" memory in:name,description,readme pushed:>=2026-09-20`, sorted by updated; `total_count: 14315`, `incomplete_results: false`

## Completion Proof Should Join Independent Planes — minecraft-agent (GitHub, September 2026)

The pinned `rmalde/minecraft-agent` verifier is a compact example of why a
successful agent-run verdict should not come from one self-reported flag. Its
`victory.json` must agree with the persisted Minecraft world: the run claims a
dead dragon and exit, while `level.dat` independently says the dragon fight is
complete, the game stayed in Survival at the declared difficulty, and commands
were disabled. The event log supplies another plane: it identifies planner and
controller models, deaths, capture lifecycle, and every decision and result
through victory. The verifier then checks that recording intervals cover those
events and that the video's measured duration matches the covered intervals.

The run setup also freezes the executable subject before play. `freeze-run.mjs`
rejects a reused run directory, copies a declared source and dependency set into
the run record, and stores SHA-256 digests. The final verifier compares those
digests with the live files and rejects logged harness repairs, multiple starts,
a capture failure, or missing recording finalization. It reports any decisions
after victory and includes hashes of both the event log and video, although the
post-victory count is not itself part of the pass predicate. This yields four
separately inspectable planes: controller events, externalized world state,
media coverage, and source identity. None is sufficient alone, but disagreement
between them makes a false completion claim easier to reject.

The boundary is as important as the pattern. The README says the cited run's
video, event log, world, and generated proof remain local and are excluded from
Git, so Scout could inspect the verifier but not validate the claimed 8:43 run
or its reported 17 run checks. Hashes emitted at verification time are integrity
identifiers, not signatures or proof of prior custody. The source manifest is a
hand-maintained file list, and the verifier checks current paths against it; an
omitted executable input would be outside that guarantee. Scout did not install
Minecraft, model credentials, or repository dependencies and did not execute the
live run or verifier.

**Runtime rule:** derive completion from a conjunction of independently sourced
observations. Bind the claimed terminal event to durable domain state, prove
that evidence capture covered every consequential action and result, freeze the
executed source and dependencies before launch, and record artifact identities.
Report missing planes as missing rather than letting a model-authored success
flag substitute for them. Keep provenance and custody distinct from checksums,
and challenge the verifier with inconsistent fixtures for each plane.

- **Repo:** https://github.com/rmalde/minecraft-agent
- **Inspected revision:** [`78b40ed59514e5e2abde33a05ce398ecb2c39e05`](https://github.com/rmalde/minecraft-agent/commit/78b40ed59514e5e2abde33a05ce398ecb2c39e05)
- **Primary sources:** [README and evidence boundary](https://github.com/rmalde/minecraft-agent/blob/78b40ed59514e5e2abde33a05ce398ecb2c39e05/README.md), [run verifier](https://github.com/rmalde/minecraft-agent/blob/78b40ed59514e5e2abde33a05ce398ecb2c39e05/verify-run.mjs), [source freezer](https://github.com/rmalde/minecraft-agent/blob/78b40ed59514e5e2abde33a05ce398ecb2c39e05/optimization/nether/freeze-run.mjs), and [completion-event predicates and tests](https://github.com/rmalde/minecraft-agent/blob/78b40ed59514e5e2abde33a05ce398ecb2c39e05/evidence.test.mjs)
- **Discovery query:** GitHub Repository Search API `AI agent in:name,description,readme created:>=2026-09-20`, sorted by stars; `total_count: 16284`, `incomplete_results: false`

## Behavior-Derived Tests Need Mutation Negatives — CodeMidas and GameLogicBench (arXiv, September 2026)

Two current arXiv abstracts expose complementary halves of an agent-generated
verifier pipeline. [CodeMidas](https://arxiv.org/abs/2609.22068v1) starts from
implemented source rather than issues or commits: agents explore the original
program, formulate behavioral specifications, generate execution-grounded tests,
and filter candidate tasks with execution checks and repeated solution rollouts.
The authors report 5,545 resulting training tasks from 3,185 repositories across
23 languages and improvements on five coding and terminal benchmarks after RL
training. This is useful evidence that executable behavior can seed task and oracle
construction at scale, but the abstract does not say that observing a reference
implementation makes the inferred specification complete.

[GameLogicBench](https://arxiv.org/abs/2609.21562v1) supplies the missing adversarial
control. Its evaluators check rules at every simulation tick across seeded scenario
variations, rather than accepting only a valid final state. Each evaluator is also
challenged with mutants—implementations with one required capability removed—to
show that different correct implementations pass while a targeted omission fails.
The abstract reports that evaluators built without mutant validation accepted
incorrect agent submissions. This directly separates a runnable, reference-grounded
test from a discriminating behavioral oracle.

Together they suggest a construction rule: mine candidate behavior from an executable
reference, then challenge every claimed requirement with a minimal negative that
removes or violates it. For stateful systems, assertions must cover intermediate
transitions as well as terminal state. A useful verifier receipt should therefore
bind the reference revision, extracted requirement, positive reference run, mutant
or omission tested, scenario/seed set, assertion phase, and observed rejection.
Repeated solution rollouts can filter unstable tasks, but cannot replace requirement-
level negative controls: many diverse implementations may share the same blind spot.

**Evidence boundary:** Scout read the complete live arXiv API abstracts, not the full
papers, code, datasets, or benchmark suites. Dataset sizes, benchmark gains, mutant
results, and task counts above are author-reported and were not independently
reproduced. CodeMidas addresses training-environment construction, while
GameLogicBench evaluates game logic; their combination is Scout's design synthesis,
not a comparison run by either paper.

- **Source:** https://arxiv.org/abs/2609.22068v1
- **Source:** https://arxiv.org/abs/2609.21562v1
- **Coverage:** complete arXiv API abstracts only

## Unattended Run Reports Need Typed Lifecycle Evidence — HN (September 2026)

A current [HN-linked incident essay](https://dev.yuv.run/writing/while-i-sleep/)
describes an overnight coding-agent job that reported twelve push failures even
though the assistant executable was missing and no assistant had started. The
failure came from collapsing distinct lifecycle facts. Every fresh worktree branch
lacked an upstream, so a comparison against `branch@{u}` suppressed Git's error,
substituted the string `none`, and interpreted `HEAD != none` as evidence of an
unpushed commit. The launcher remained visible until the next one-minute poll, each
start counted as a session, and tasks were never marked attempted, producing twelve
retries. A separate shell-scope bug left the headline's session counter at zero, so
the same report said both “quiet night” and twelve runs needed manual pushes.

The author's minimal shell reproduction is a useful negative control for status
logic. Scout reran it in two fresh directories. With a nonexistent child, the old
check reported committed work while a before/after `HEAD` check reported a zero-second
launch failure. With `true`, the old check again reported committed work; the repaired
heuristic also called the successful immediate no-op a launch failure. This second
case exposes the repair's limit: elapsed time and repository state can show that no
commit appeared, but cannot establish whether a process launched, exited cleanly,
failed internally, or intentionally produced no change.

**Runtime rule:** record launch, exit, repository delta, commit creation, publication,
and task disposition as separate typed observations. Do not infer one phase from a
sentinel created by another phase's error, and do not use duration as the authority
for exit semantics when the process status is available. Before trusting an unattended
summary, exercise at least a missing-executable case, a successful no-op, a committed
change, and an unavailable-upstream branch. The headline and detailed rows should be
derived from the same persisted attempt records, and retry eligibility should consume
an explicit attempt outcome rather than the mere continued presence of a task.

This is one author's retrospective about a small private automation job, not evidence
of prevalence across agent runtimes. The original overnight logs are no longer
available, and Scout did not inspect the production script. The complete essay and
its self-contained reproduction were read; Scout independently reproduced the two
local cases above. HN had one point and no comments at retrieval, so there is no
community validation. The durable contribution is the falsifiable lifecycle-control
pattern, not the incident's scale.

- **HN:** https://news.ycombinator.com/item?id=49782797
- **Source:** https://dev.yuv.run/writing/while-i-sleep/
- **Coverage:** complete linked essay and HN item; published minimal reproduction
  rerun locally for missing-child and successful-no-op cases

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

## Acceptance and Reconciliation Companion

The acceptance-authority, actor-provenance, release-reconciliation, and audit-
normalization patterns continue in [Agent Runtime Acceptance and Reconciliation](./agent-runtime-acceptance-and-reconciliation.md#checker-eligibility-must-not-become-acceptance-authority--workstream-github-september-2026). They were moved intact during the 2026-09-21 oversized-note review.
