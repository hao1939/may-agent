# Crash-resilience evals must measure recovery, not assign it

Date: 2026-08-25
Repo: https://github.com/sdageltc/agent-durability-bench
Commit reviewed: https://github.com/sdageltc/agent-durability-bench/tree/d1f318f43704c7dee539f9c791bce896f9bc57fc

## Signal

The newly published `agent-durability-bench` identifies a real blind spot in coding-agent evaluation: task success after an uninterrupted run says little about what happens across `SIGKILL`, host eviction, or a crash during mutation. Its proposed dimensions are useful:

1. **resume fidelity** — which committed steps are repeated after restart;
2. **state integrity** — whether files and checkpoints remain mutually consistent;
3. **process ownership** — whether descendants survive their controller; and
4. **recovery latency** — how long useful execution remains unavailable.

But a source audit shows that the repository's current 100% LetItLoop result does not yet measure those dimensions. It is a useful example of why an evaluation needs construct-validity tests in addition to green CI.

## What the implementation actually proves

The strongest test, [`test_real_subprocess_crash_and_wal_recovery`](https://github.com/sdageltc/agent-durability-bench/blob/d1f318f43704c7dee539f9c791bce896f9bc57fc/tests/test_real_process_crash.py), starts the repository's own `SyntheticTaskRunner`, waits until it pauses before a designated step, kills that Python subprocess, checks that two earlier WAL records exist, and resumes the same synthetic runner. This proves one narrow property: the included JSONL step log can skip IDs already marked `COMPLETED` after its own worker is killed.

The public benchmark path is substantially weaker:

- [`harness/runner.py`](https://github.com/sdageltc/agent-durability-bench/blob/d1f318f43704c7dee539f9c791bce896f9bc57fc/harness/runner.py) directly instantiates `SyntheticTaskRunner`; it does not start the selected framework adapter or inject an OS signal. The `framework_name` is only copied into the result.
- The runner assigns `duplicate_token_waste_pct=0.0`, `state_corruption_detected=False`, and `impossibility_artifact_emitted=False` rather than deriving them from observations. It also catches every exception from the first run and discards it.
- The CLI accepts `--export-json` and `--export-markdown`, but the reviewed implementation never writes either path. The advertised Pages leaderboard returned HTTP 404 during this check.
- [`LetItLoopAdapter.start_task`](https://github.com/sdageltc/agent-durability-bench/blob/d1f318f43704c7dee539f9c791bce896f9bc57fc/adapters/letitloop_adapter.py) returns PID `0` and another local synthetic runner; it does not launch or observe LetItLoop.
- [`ProcessLifecycleGuard`](https://github.com/sdageltc/agent-durability-bench/blob/d1f318f43704c7dee539f9c791bce896f9bc57fc/harness/injector.py) kills descendants itself. That is reasonable harness cleanup, but it cannot simultaneously demonstrate that the framework under test owns and reaps its children.
- The kill sentinel occurs before the synthetic file write, after which the file is written and only then the WAL record is appended. The suite therefore does not inject failure inside mutation or test the important crash window between side effect and commit record.

GitHub Actions run [32831709785](https://github.com/sdageltc/agent-durability-bench/actions/runs/32831709785) shows green CI at the reviewed commit. That supports the narrower claim that the repository's tests pass; it does not validate the README's cross-framework leaderboard or its state-corruption and process-cleanup claims.

## Reusable evaluation design

A credible durability score should make every reported field an observed quantity and include negative controls that are expected to fail:

- **Run the real adapter boundary.** Record executable identity, version, PID tree, workspace, task manifest, and checkpoint lineage. Reject an unknown `--framework` instead of echoing its name into a passing result.
- **Sweep crash phases.** Inject before mutation, during a staged write, after external effect but before checkpoint commit, after commit but before acknowledgement, and during verification. A single pause before an operation exercises only one easy boundary.
- **Measure replay from traces.** Give every attempted effect a stable operation ID; compare pre-crash and post-restart traces to count repeated model calls, tool calls, tokens, and externally visible effects. Never initialize duplicate work to zero.
- **Separate file validity from state consistency.** Parse changed artifacts, compare them with the durable log, and verify application invariants. A WAL file merely existing is not evidence that either side is correct.
- **Separate framework behavior from harness sanitation.** First observe descendants after the framework's documented shutdown/recovery interval; only then let the harness kill leftovers for test isolation. Report both the observed leak and the cleanup action.
- **Ship falsification fixtures.** Include deliberately restart-from-zero, torn-write, stale-checkpoint, duplicate-effect, and orphan-leaking adapters. If each defect does not worsen the corresponding metric, the metric is not measuring its label.
- **Bind exports to evidence.** A leaderboard row should reference an immutable framework version, task set, crash schedule, raw trace, scorer version, and CI run. CI success and benchmark success must remain separate verdicts.

## Takeaway

Crash durability is a protocol property spanning effect commit, checkpoint commit, acknowledgement, restart, and cleanup. A benchmark can expose that protocol only by perturbing each boundary and deriving its verdict from captured evidence. A green test suite around a self-resuming synthetic worker is a useful harness unit test—not evidence that an external agent framework survives crashes without duplicated work, corruption, or leaks.

## Tags

- agent-evaluation
- crash-recovery
- durability
- fault-injection
- checkpointing
- benchmark-validity
