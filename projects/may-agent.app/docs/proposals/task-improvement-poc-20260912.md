# Agent improvement through one ordinary Task

**Harness status:** Retired from the current Host candidate by the
[scripts retirement decision](poc-retirement-and-knowledge-20260912.md).
The source remains at the exact trial revisions recorded below; its final
main copy is at Host `38a048da5c105bea91dc7163010d94483a60b747`.
Historical invocations require that isolated source, not current main.
The [original commands and prerequisites](https://github.com/hao1939/may-agent/blob/38a048da5c105bea91dc7163010d94483a60b747/scripts/poc/task-improvement.README.md)
remain available with the retired harness.

**Status:** Positive and withdrawal live trials completed, September 12, 2026. No production changes.
**Publication:** [Host PR #163](https://github.com/hao1939/may-agent/pull/163)
is the single open PR against `main`. #165 was merged into that PR's branch
as `38c08c7d`, not into main. Neither source integration nor validation authorizes
deployment.
**Parent:** [Agent extension proposal](agent-behavior-and-capability-extension.md).

## Answer

Yes: improvement can use the ordinary Task lifecycle. One Task carried an
agent-authored candidate through a real wait and runtime/storage reopen, then
activated it and verified useful behavior. The withdrawal arm kept the candidate
inactive and prevented a late wake from restarting cancelled work. No new
production controller, scheduler, storage model or workflow was necessary.

This is bounded mechanism evidence, not a claim of general learning quality,
production readiness or crash safety. The unsuccessful trials below remain part
of the result. The largest lesson was to verify the actual execution boundary,
not only the registered tool or a reassuring status message.

**Review correction:** the live trials below used cancellation in a field named
`ownerClosure`. They did not establish successful owner closure: the operation
recorded `kind: cancelled` and replaced the successful Task projection with an
attention/cancellation report. Accepted attempt history and the earlier returned
answer remained, but that is not the promised closure contract. The corrected
fixture at Host `26fbc4c4` uses existing `closeAppTask` with `afterResult`, rejects an older accepted
attempt, and checks `kind: closed`, exact accepted-result linkage and preserved
Task/attempt/caller results through runtime/storage reopen. That correction has
no-model coverage; it does not prove an installed owner-control interface.

Historical holdout `passed` flags also omitted citation and response checks.
Current verdicts expose named smoke checks and `mechanicalPassed`: expected
fields/revision, reported policy version, nonempty reply, and an explicitly
requested one-sentence English welcome without capacity-policy discussion.
This is not a general semantic judge. The retained final answers contain the
policy references and a proper welcome, but raw historical flags alone do not
establish that. Preserve the old artifacts; do not credit them as new live trials.
All 12 focused checks and the explicit PoC TypeScript/lint checks pass. Rechecking
the four retained final answers against the new smoke verdict also passes; the
clarified prompts have not been rerun against a model. Design integrity, examples
and App-boundary checks pass.

## Question and intended boundary

Can an agent prepare a useful guidance change, wait, survive a Task-runtime
restart and verify adoption without a human operating the steps or a new
learning controller?

Reuse the earlier [agent-operated experiment](agent-operated-improvement-poc-20260912.md):
the improver discovers accepted synthetic Orion policy, chooses a scoped edit,
commits it, requests real daemon activation and probes a fresh target. The target
cannot read the improver's policy/evaluation files. Four withheld checks cover
production equality, staging overflow, unknown environments and unrelated work.

This experiment changes the improver from a direct call to the real managed
agent, App input admission, Task controller and SQLite store. A synthetic
external activation window requires a durable Condition. Once the first wait is
accepted, the fixture closes/reopens the Task runtime and database, then publishes
the matching fact. The fixture opens the window for that candidate only; it does
not edit, commit, activate or choose probe questions for the agent.

The original assignment grants scoped standing authority. The window is a
controlled external prerequisite, **not** a new production approval service or
proof of an owner approval interaction. The target source daemon stays running.
This is graceful in-process Task-runtime/storage reopen, not a killed worker,
whole-daemon crash, deployment, or installed improvement service.

## Retained unsuccessful trials

1. **Mechanical preflight:** The fixture initially sent a targeted wake directly
   without the normal Condition routing. The Task woke but its wait stayed open.
   The assertion caught the remaining review deadline. Fix: publish the fact
   through existing event ingress so its Condition is observed. No Host change.
2. **First model trial, interrupted:** Task preparation replaced the fixture's
   `read` and `write` by name with standard workspace tools. Discovery listed
   target source but reads went to the improver's workspace. This both caused
   failed reads and invalidated the intended restricted-adapter guarantee. The
   trial was stopped after detecting this, its exact process group terminated,
   and its partial results/transcript retained. No activation occurred. Baseline
   and one target probe completed; the improver and another probe were interrupted.
3. **Second model trial, stopped by an assertion:** With explicitly named
   `fixture_read`/`fixture_write`, the agent authored and committed the policy,
   used the existing checkpoint tool and returned an honest `waiting` result.
   The Task, candidate revision and wait survived reopening. The fixture then
   counted a profiled no-op recovery check as a completed second attempt and
   asserted too early. No second model attempt or activation had happened.

Do not classify these as target-policy failures or hide them behind reruns.
The fixes are experiment wiring: preserve the restricted adapters through real
preparation, and wait for distinct **actual attempt IDs**, not a count of generic
profiling events. Neither failure justifies an extra production lifecycle.

## Successful resumed trial

The trial completed **12 model executions**: one baseline, two improver attempts,
five agent-selected target probes and four withheld checks. Both improver
attempts and all nine post-change target executions had zero tool errors.

1. The agent discovered accepted policy and the target source, added nine lines
   to May's existing identity, and committed the change. It saved the candidate
   revision and uncertainty in its Task result and returned the external wait.
2. The fixture reopened the Task runtime and SQLite. Task `improve-guidance`,
   generation 1, the accepted first attempt, its candidate and Condition remained.
   A no-op recovery check did not start a model or count as a completed attempt.
3. The fixture published the matching readiness fact. The same Task prepared a
   new managed execution. The agent inspected source status instead of repeating
   the edit or commit. Exactly one candidate commit followed the baseline.
4. Its first reload received an explicit synthetic **not submitted** failure.
   A later assistant message retried and the real daemon activated the candidate.
   The ordered trace records failure at message 31, retry at 32 and successful
   activation at 33. This does not test ambiguous post-submission failure.
5. The agent chose five checks: production equality/overflow, staging equality,
   unknown QA policy and an unrelated stack/queue question. Each used actual
   active revision `5c79fdac27a150a3788a0affacfec8fca2e95507`.
6. The original input received the accepted result; no replacement ask was
   created. The Task stayed open on convergence. A subsequent explicit fixture
   owner control cancelled it; despite its `ownerClosure` label, this did not
   check successful owner-close semantics. See the review correction above.

Independent withheld checks all passed:

| Request | Result |
| --- | --- |
| Production: 35 occupied + 2 additional | 37 fits the 37-slot limit |
| Staging: 5 + 8 | 13 exceeds the 12-slot limit |
| Development: 1 + 1 | Total 2; limit and eligibility remain unknown |
| Welcome a teammate | Ordinary welcome, with no capacity assertion |

Capacity replies identified `orion-capacity-v1`; none claimed deployment
authority. The changed guidance was self-contained, with no inaccessible
evidence-file reference. The two improver attempts took about 26.1 and 47.8
seconds; the latter includes target probes, so summing parent/child durations
would double-count work. This is not a performance comparison or a verified bill.

## Successful withdrawal trial

A separate trial completed two model executions: baseline and one improver
attempt. The agent again discovered the policy, authored/committed guidance and
returned a wait. After reopening, the fixture owner cancelled the Task before
activation. A readiness event and an explicit late targeted wake did not start
a second attempt. Cancellation survived another reopen; there were zero reload
invocations. The committed candidate remains available for audit but inactive.

This verifies withdrawal **between attempts**. It does not show that cancellation
can undo an effect, or prove cancellation races during an in-flight reload.

## Mechanical checks

The refined no-model preflight replaces provider judgment with scripted tool
calls, not a fabricated Task result. Actual managed execution, guidance tools,
finish validation, admission, storage, controller, Condition observation, reopen,
input result projection and owner controls remain production code. It checks:

- a wait/checkpoint remains on the same Task and generation after reopening;
- one matching fact resumes the original input, with no replacement ask;
- accepted success leaves the Task open until explicit owner closure;
- owner withdrawal persists across reopen and rejects a late targeted wake;
- fixture reads/writes stay restricted after actual execution preparation;
- a real redundant wake while waiting cannot satisfy the next attempt's barrier;
- the original input links to the exact accepted second attempt, with one Task.
- the closed activation window refuses the prepared source tool's reload;
- the saved Condition is exact, not a wildcard or altered readiness predicate;
- false readiness and wrong-subject facts cannot resume the waiting Task;
- committed and active revisions are unchanged by reopen or withdrawal;
- the original input returns the accepted payload, not only a done status.

The scripted decisions are not agent judgment or useful-target-behavior evidence.
The managed no-model Task commits a real candidate and the resumed attempt
activates it through the temporary daemon. Model trials remain opt-in and
excluded from CI. Actual managed system prompts and tools are retained with
their executions; an unused direct-execution prompt is not Task evidence.

## Review follow-up: validate facts without constraining explanations

The five review findings carried from #165 into #163 made sense: the first
publication lacked exact payload/retention assertions, recorded an unused direct
prompt for managed work, bypassed the managed tool loop in no-model checks, and
allowed a weaker readiness predicate. The refined fixture addresses those gaps
without changing the Host.

Two new live trials at `256006c2` exposed an overcorrection in the fixture.
Both agents returned the correct readiness fields and added the schema's
optional `requestedAction` explanation. Literal whole-object equality rejected
that valid description; the fixture then dereferenced a nonexistent accepted
attempt. Each trial completed two model executions, with no activation. The
raw reports remain retained. This was a fixture rejection, not agent failure to
understand the readiness fact.

At `2c9e9d6c`, validation fixes the fact fields and predicate while allowing
the optional explanation. A described next step neither performs an action nor
changes readiness. The no-model managed run includes that description and
checks rejection of actual predicate/identity changes. Rejected first attempts
are inspected by their actual attempt ID, not an assumed accepted-result link.

Fresh resume and withdrawal trials at that revision passed. The resume trial
completed twelve model executions and four correct withheld checks; cancellation
completed two executions and retained the exact inactive candidate across reopen.
The original input returned the second attempt's exact payload. Actual managed
preparations were retained, and the unused direct prompt was omitted.

The resume trial also supplied useful imperfect evidence. Two chosen probes ran
before activation; three ran afterward. A sixth probe was refused by the existing
five-probe allowance. The agent honestly reported that it had not tested the
unrelated request; the independent holdout later did. One production-boundary
target also made an unsuccessful read of `shared/common-sense.md`: its relative
read base was the mutable fixture root while its allowed files were in the
immutable snapshot. The answer was correct, but the read failure was real.

The final source-root refinement aligns the target prompt and relative reads
with the same immutable snapshot. A regression verifies a normal relative shared
read succeeds while an absolute read of the mutable source is still denied.
This is a fixture correction, not wider permissions. Budget refusal remains
visible evidence rather than prompting a new retry or budget-management service.

The final live resume trial at `7f2abb05` completed **eleven model executions**:
baseline, two improver attempts, four agent-chosen probes and four withheld
checks. All four holdouts passed at the exact final active revision. Both
improver attempts and all eight post-change targets had **zero tool errors**.
The baseline still made 23 unsuccessful discovery reads; this does not prove
general lookup efficiency. The agent made one small self-contained guidance
addition, preserved uncertainty, and returned the exact result to the original
input. Failure delivery/retry/activation were ordered at messages 33/34/35.

The [review evidence](evidence/task-improvement-review-20260912.json) preserves
both rejected fixtures, both successful intermediate arms, the final resume
trial, exact harness hashes, actual answers, error counts and raw-report hashes.
Withdrawal was model-tested at `2c9e9d6c`; its Task harness is identical in the
final trial, but its target used the earlier read root. No-model checks exercise
both arms on the final source. A full local gate at `2c9e9d6c` passed **2,881
tests with three installation-only skips**. Final-source focused checks, PoC
TypeScript and lint pass; the PR owns current publication checks.

The design lesson is small: code validates effect-bearing facts and provides
usable scoped capabilities; agents can explain, choose and report uncertainty.
Do not reject harmless explanation to manufacture an exactness guarantee, or
turn every imperfect probe into a new production rule.

## Recommendation

Keep one ordinary Task per independently owned improvement outcome. The agent
operates scoped capabilities and judges returned evidence. Code keeps identity,
bounded effects and follow-through. Candidate source, activation and actual
behavior remain separate evidence; accepted result and Task closure remain
separate decisions. No special self-improvement controller is needed.

Use a role instruction for enduring behavior, a skill for a reusable method,
a scoped tool for an effect, and a workflow only for mechanical ordering that
needs to be stable. The Task carries work across attempts; none of those extension
methods needs its own responsibility lifecycle. Small corrections can still
finish in the current Conversation Task.

The next useful integration is one discoverable, scoped source/probe capability
on an existing authorized App, with truthful source and execution evidence.
Do not install these fixture adapters as production APIs or build a general
learning controller. Keep the current exact-artifact approval policy where it
applies, and resolve installed authority separately from mechanism usability.

Remaining checks include abrupt loss after an effect, changed owner instructions
during an active attempt, whole-process allowance recovery, actual installed
source authority and a target running through a subprocess Task rather than the
direct fresh-target probe. Existing earlier experiments cover parts of target
Task adoption; they are not evidence that this combined installed path ran.

## Reproduction and evidence

The original isolated Host branch is `poc/improvement-unified-task`, based on
merged Host `f5d5a535` with the portable #163 experiment brought forward. That
trial left the existing PR branch unchanged. Its fixture commit is `17938a4c`.
No source was deployed or published by this trial.

For publication, branch `test/task-guidance-improvement` brings this fixture
forward onto #163 plus current main. Its head is `1642d94d`; the direct PoC
dependency is `f82aab35`. The five-file follow-up excludes #164's separate
coordination redesign. The original experiment branch and model evidence remain
unchanged for audit. The portable README now contains the recommendation,
model-tested hashes and explicit evidence limits for GitHub reviewers.

```sh
bun scripts/poc/task-improvement.ts
bun scripts/poc/task-improvement.ts --withdraw
bun scripts/poc/task-improvement.ts --live
bun scripts/poc/task-improvement.ts --live --withdraw
```

No-model mode is the default. The live runs use the configured `gpt-5.6-sol`
route and retain temporary artifacts. The final harness reserves two improver
attempts, at most five selected probes and four withheld checks plus the baseline
within twelve executions. The live positive run had already used only five
probes; the later budget clarification corrects the earlier six-probe advertisement.
The improver has at most 40 provider requests across runtime reopen. This fixture
counter is not a production Task spending policy or whole-process budget proof.

The [sanitized evidence](evidence/task-improvement-20260912.json) includes source
hashes for the model-tested harness, exact Task/attempt and revision evidence,
actual answers, and hashes of retained raw reports. It omits raw prompts, private
paths and provider identifiers. Later deterministic hardening adds explicit
input-return assertions and a no-op-wake regression. Inspection also found that
the managed adapter overrides the registered agent timeout: the final fixture
sets its tighter 300-second limit at actual dispatch. The successful live attempts
had already finished within 48 seconds, but those runs do not prove that timeout
change. These refinements are not another live trial.

Publication review found another evidence gap in the shared direct experiment:
a clean new commit after a successful activation could pass while the retained
diff described unactivated guidance. The refined check captures final Git HEAD,
requires it to equal the active source and matches recovery against that exact
commit. Its no-model regression makes a real later commit, rejects the mismatch,
then accepts it only after real daemon activation. Historical live evidence is
not retroactively credited with this stronger assertion.

A later review tightened two claims without changing production behavior.
Pending reload evidence prevents grading; every withheld execution must use
the final commit, followed by another HEAD/active-source inspection. The
fixture does not try to coordinate ambiguous operations. Also, "read-only
target" was too broad: standard finish can append reported lessons as private
fixture evidence. The target cannot edit guidance or policy. The preflight
verifies the lesson append, denied target reads and absence from a fresh prompt;
evidence retention is not active guidance.

The fixture counter is now named `forwardedReloadCalls`. The old raw report's
`activations` field counted calls, including the synthetic not-submitted
failure—not successful activations. It remains unchanged as historical evidence;
the separate source and execution records establish actual adoption.

The original fixture's full local CI passed **2,881 tests**, with three
installation-only skips. Its focused suite passed **11 tests** after hardening.
Publication `180548ff` had a Bun worker segmentation fault in the first full
run; the log is retained. The named file passed separately, then one unchanged
full-suite confirmation passed 2,881 tests. No crash fix is claimed.

At publication head `1642d94d`, GitHub Quality and Container pass, including the
image smoke test. Explicit PoC TypeScript, lint and the focused PoC checks pass.
The full local run passed **2,880 tests** but failed the existing Task-runtime
live-result case: two caller inputs were observed instead of three. Its three
variants pass separately. Prerequisite `f82aab35` also has a GitHub input-mapping
recovery timeout; that case passes separately. These files are unchanged by the
PoC. Their broader-run failures remain unexplained, not silently retried away
or fixed by changing unrelated runtime code. After consolidation, #163's
Quality and Container passed at `38c08c7d`; the failed observations remain
recorded and are not explained by that success. Only #163 remains open.

These checks do not claim deployment or model coverage in CI.
