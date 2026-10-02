# Execution consolidation: candidate and PoCs

**Historical context:** [Agent Cooperation](../../2a-design/agents.md). Retained rationale and evidence; this record does not define the current contract.

September 14, 2026. Isolated source implementation and portable experiments;
the original trials used no live deployment or provider credentials. The
[proposal](execution-entrypoint-consolidation.md) owns the change;
the [execution boundary](../../2a-design/system-boundary.md#execution) owns the contract.

## Source and result

Publication follow-up: [Host PR #186](https://github.com/hao1939/may-agent/pull/186)
contains candidate `9ba26ee768e751b4e10fa3d0147ae41566a538e6`, based on Host main
`6935b325`. Paired App/design changes were integrated locally at
`73ec4e945030ce2308b6b05c469a40fd48643195`; the integration design check passed.
Hosted Quality and Container results belong to the PR. Land the Host before
enabling consumers of the new continuation/helper contract; deployment and a
live provider trial remain separate.

Host base: `b478bc5cf1a8ff8f93583d7ed8bf9a17b3f0815d` on the existing execution-feedback
candidate. App/design base: `4f7724e9ef`. Reviewed local Host commits:

| Revision | Change |
| --- | --- |
| `26bfe5fe4b8e8c27f267c90cd22f693e438791f8` | Share execution scope, join helper cleanup, use exact one-shot results and retire heuristic stopping/revival. |
| `9ba26ee768e751b4e10fa3d0147ae41566a538e6` | Make the feedback-recovery fixture honor the caller's saved retry time. |

The final `bun run ci` gate passed: **3,011 tests, 13,409 assertions, zero
failures**, across 300 files. Three installation-only agent-catalog checks were
explicitly skipped; browser and real subprocess tests ran. Portable tests took
159.25 seconds, excluding the preceding successful Host/SDK type, boundary and
lint checks. Design integrity, compiled examples and canonical App integrity
also passed against the paired source. Scout's strict typecheck and full App,
workflow, tool, watcher and research-fixture suite passed: **355 tests, 1,758
assertions, zero failures**, across 34 files (162.38 seconds). This certifies the local candidate,
not the running container or a hosted release check.

The candidate addresses the reported inconsistency: starting the same helper
through a different entry no longer selects a silence watchdog or detached
recovery policy. A small `ExecutionScope` supplies a fixed allowance, caller
abort propagation and cleanup. Direct results remain direct. Task ownership,
Conditions, Events and periodic recovery keep their existing responsibilities.

This is execution consolidation, not a general supervisor. It does not decide
whether a worker's approach is worthwhile or guarantee feedback from arbitrary
shell-created remote work.

## Entry and consumer inventory

Paths are relative to the Host unless marked App/design.

| Entry | Scope and result | Evidence |
| --- | --- | --- |
| Task agent execution: `src/app/adapters/executors/managed-agent.ts` | Existing Task/attempt identity; finite configured bound; exact result and Task recovery | Existing Task integration, timeout, ownership and restart tests |
| Generic `agents.call` / `agents.fork`: `src/lib/manager-agents-tool.ts` | Trusted live caller supplies Task binding, workspace, tool restriction, signal and remaining allowance | Agent-tool, lineage and execution-scope tests; missing caller and broader policy rejected |
| Workflow fresh, resumed and corrective steps: `src/lib/workflow-tool.ts` | Remaining workflow allowance, cancellation and result normalization; parent joins required cleanup | Workflow, repair and resume tests; unawaited agent and nested-workflow promises observed and joined |
| Direct execution/evaluation: `src/lib/agent-execution.ts`, `src/app/direct-agent.ts` | Local scope; no Task, daemon or database requirement; configured/default limit, signal/deadline and direct result | Existing direct-agent tests; caller abort and deadline; accepted finish retained during cleanup |
| One-shot CLI: `src/app/modes/oneshot.ts` | Managed bounded invocation, exact receipt and exit code | Real subprocess success/failure, including a failed session already removed from the live map |
| Direct chat: `src/lib/manager.ts`, `src/app/command-router.ts` | One scope per active turn; idle context retained | Long idle between turns, synchronous next-turn start, child cleanup/receipt failure |
| CLI tool: `src/lib/tools/run-cli-agent.ts`, `src/lib/cli-agent.ts` | Existing provider timeout and caller signal; exact native process group and direct tool result | Real synthetic native-protocol subprocesses, retained output, deadline, cancellation and process drain |
| Native Task executor: `src/app/adapters/executors/codex/codex-goal-executor.ts` | Earlier candidate's fixed invocation deadline and Task owner | Existing protocol, timeout, cancellation and correction tests rerun in full gate; no live provider trial |
| Standalone startup: `src/app/core/tasks/startup-recovery.ts` | Drain stale state; require explicit permitted caller to resume; no guessed Task | Startup/restart tests retain Task recovery and cross-owner rejection |
| App/design: Scout, Evaluation and Gym workflows | Retain `ctx.agents.call`, structured finish/result behavior and parallel calls | Consumer source inventory, paired SDK checks and Scout tests; no executable workflow requiring detached forks found |
| App/design: May standing orders and Bob instructions | Replace detached dispatch guidance with bounded helpers or accepted App Tasks | Readback and design checks; no live definitions changed |

The generic model tool itself remains a supported scoped-fork consumer. Keeping
its action preserves caller-owned concurrency; it uses the same manager scope
and result records, without independent resumption or a duplicate dispatch event.
Agents need not construct their own timeout, ownership or notification metadata.

## Iterations and failures

1. Initial scoped-execution tests exposed generic tool fixtures without a live
   caller. Permission and target errors remain first; successful calls now use
   a real caller. A later focused pass exposed old token-progress and startup
   resume expectations. Terminal activity is evidence, and explicit recovery
   is tested separately from automatic startup policy.
2. The first broad focused pass was green: 99 tests, 400 assertions. Review then
   found old chat cleanup could close a newly started turn. Cleanup now captures
   the exact scope, and old trace links are cleared before publishing idle.
   A child receipt failure also now terminally fails its chat parent rather than
   leaving it reported as running.
3. Extending public-action tests initially produced two timeouts: fixtures
   ignored the tool's delegation memo and chat's structured user-message input.
   Correcting those fixtures gave 35 passing tests, 117 assertions. Cancellation
   is repeated while cleanup is held open to prove it cannot release live state.
4. The first full gate had 2,996 passes, three installation-only skips and 13
   failures. These identified retained heuristic expectations, fake caller IDs,
   a mock that bypassed the new signal path, and repair fixtures that expected
   settlement before helper cleanup. Their replacement assertions exercise live
   ownership, ordinary failure evidence and cancellation followed by actual join.
   A 50ms repair deadline also expired during setup under suite load; the revised
   test uses one second and observes cancellation rather than racing an extra
   500ms timeout. Focused repairs passed: 32 tests/91 assertions and 17 tests/47 assertions.
5. Two combined PoCs use the real workflow, manager, agent loop, CLI tool and a
   native-protocol subprocess. Success returns structured `{ verified: true }`.
   Owner cancellation propagates to the helper and native process; the process
   is gone and its ownership record cleared before the final check. Both pass,
   12 assertions, approximately 0.5 seconds total in the focused run. Provider
   responses are synthetic; neither PoC contacts a model service.
6. Further review included nested and unawaited helpers. Their public promise
   wrappers must also observe rejection, not just the inner execution promise.
   The shared local pending set joins both, including delayed cleanup. It is
   transient invocation bookkeeping, not a durable operation registry.
7. A subsequent gate stopped at lint because a removed heuristic left one
   unused import. It was removed; no test or check was skipped to hide a failure.
8. The next full run had one failure in the existing caller-feedback restart
   fixture; that test passed alone. Captured state showed its caller retry time
   still ahead of the simulated clock, even though the collector was ready.
   The fixture now follows the caller's saved retry time before demanding its
   next attempt. Runtime scheduling was not changed. Original-request retention,
   single-blocker reporting and exact final-result assertions remain.

## Reproduction and acceptance

From the paired Host checkout:

```sh
bun test src/lib/execution-scope.test.ts src/lib/timeout.test.ts \
  src/lib/workflow-tool.test.ts src/lib/workflow-repair.test.ts \
  src/lib/agent-execution.test.ts test/integration/execution-composition.test.ts
bun run ci
```

The full gate includes unchanged Condition/dependency tests for result-before-wait,
duplicate/lost notifications, restart and closed owners. Those tests verify the
existing async path; this change does not add another notification transport.
The paired App/design check uses `bun run check:may-design`; Scout's workflow
and tool tests verify its continuing use of the existing SDK contract.

## Cost, defaults and limits

- Previously omitted execution limits now default to 30 minutes, matching Task
  workflow execution. One-shot CLI retains its five-minute default. Shorter
  provider/operation limits remain. Invalid effective limits are rejected.
- Progress and tool errors remain observations; they do not reset the timer or
  trigger another model review. Quiet unproductive work can consume more of its
  allowance. Its owner decides the next attempt using the returned evidence.
- Running and waiting remain independent facts. Cancelling an invocation does
  not close its durable Task or erase outstanding provider results.
- In-process cancellation is cooperative. The candidate waits for helper
  cleanup; it cannot forcibly terminate arbitrary JavaScript or prove a remote
  service cancelled its work. Existing execution-worker/process boundaries and
  exact owner controls remain necessary. Unconfirmed cleanup is not safe capacity.
- Conflicting tool profiles under a restricted caller are rejected. No new
  capability ordering or permission lattice is introduced.
- No automatic fallback supervisor, live review loop, daemon, model poll or
  operation registry was added. No throughput or idle-CPU benchmark was run;
  test duration is not a production performance claim.
- Production source has 253 added and 405 removed lines, a net reduction of 152.
  The common scope is 54 lines. Tests remove retired-policy checks and add
  lifecycle/process boundary regressions; line counts are maintenance context,
  not proof of correctness or performance.
- Installation-specific forks/direct invocations need an inventory before
  rollout. This candidate rewrites no Task/session history and performs no live
  migration. Long-running live provider behavior still requires a separate trial.
