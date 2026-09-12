# Agent improvement through one ordinary Task

**Status:** Positive and withdrawal live trials completed, September 12, 2026. No production changes.
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
   owner control closed it. This checks the control boundary, not human review.

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

The no-model preflight replaces only judgment with scripted results. Actual
admission, storage, controller, Condition observation, reopen, input result
projection and owner controls remain production code. It checks:

- a wait/checkpoint remains on the same Task and generation after reopening;
- one matching fact resumes the original input, with no replacement ask;
- accepted success leaves the Task open until explicit owner closure;
- owner withdrawal persists across reopen and rejects a late targeted wake;
- fixture reads/writes stay restricted after actual execution preparation.
- a real redundant wake while waiting cannot satisfy the next attempt's barrier;
- the original input links to the exact accepted second attempt, with one Task.

The scripted result is not agent judgment or target-adoption evidence. The
existing no-model source preflight separately uses a real temporary daemon,
Git commit and reload. Model trials are opt-in and excluded from CI.

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

The isolated Host branch is `poc/improvement-unified-task`, based on merged
Host `f5d5a535` with the portable #163 experiment brought forward. It leaves
the existing PR branch unchanged. Final fixture commit: `17938a4c`.
No source was deployed or published by this trial.

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

Verification: full local CI passed with **2,881 tests, three installation-only
skips and zero failures**. After the final fixture hardening, the focused suite
passed **11 tests** and the explicit PoC TypeScript check passed. These checks
do not claim deployment or model coverage in CI.
