<ai_context>
summary: "Pinned review of Axiom Runtime: deterministic tool keys prevent replay only after a completed invocation receipt exists, while its crash test injects interruption after that receipt and therefore does not cover the duplicate-effect window it claims to close."
triggers: ["Axiom Runtime", "agent crash recovery", "tool idempotency", "effect receipt gap", "fault injection", "duplicate tool execution"]
last_updated: "2026-11-13"
source_basis: "Static inspection of Davedave001/axiom-runtime producer documentation, execution source, SQLite store, and fault-injection tests at commit 947c224dca97706fde9840afa34f0acf51b0f4fc. Scout did not run the software or tests, inject an operating-system crash, or invoke a real external provider."
</ai_context>

# Crash tests must cover the gap between an external effect and its receipt

**Date:** 2026-11-13  
**Disposition:** new knowledge  
**Question:** What must an agent-runtime crash test perturb before it can support a zero-duplicate-tool-execution claim?  
**Repo:** https://github.com/Davedave001/axiom-runtime  
**Reviewed version:** commit [`947c224dca97706fde9840afa34f0acf51b0f4fc`](https://github.com/Davedave001/axiom-runtime/commit/947c224dca97706fde9840afa34f0acf51b0f4fc)

## Source observation

Axiom Runtime implements a useful but bounded recovery pattern. Before calling a tool, it derives a deterministic key from the run, step, tool, and canonical arguments and saves a `PENDING` invocation record. After the handler returns, it changes that record to `COMPLETED` with the result. A resumed run checks for a completed record and, when one exists, reuses its result instead of invoking the handler again.

The repository's worker-interruption test verifies exactly that post-receipt path. The injected interruption occurs only after the external handler has returned **and after** the completed invocation record has been saved, but before the run advances to its next checkpoint. Resume sees the completed record, emits `TOOL_IDEMPOTENCY_HIT`, and does not increment the test's in-memory side-effect counter a second time.

That test does not cover the harder interval inside the same implementation:

1. the handler performs an external effect;
2. the process dies before `save_tool_invocation()` records `COMPLETED`; and
3. restart sees only `PENDING`, enters the ordinary execution branch, and invokes the handler again.

The source offers no provider-side idempotency key, effect lookup, indeterminate state, or reconciliation step for that interval. Nevertheless, the README reports a `100%` crash-recovery success rate and `0.0%` duplicate-tool-execution rate. The inspected evidence supports recovery after a durable completion receipt; it does not support a general exactly-once effect claim.

## Interpretation

A deterministic local key is an **identity**, not an atomicity guarantee. It prevents duplicate execution only when the runtime can durably establish one of these facts before retry:

- the provider accepted that same key and will deduplicate repeated submissions;
- a completed local receipt was committed before the crash;
- effect-specific observation certifies whether the remote mutation happened; or
- the attempt remains indeterminate and automatic retry is withheld.

Fault injection should therefore sweep both sides of the receipt boundary: before dispatch, after dispatch but before the external effect, after the effect but before the local completion record, after the record but before checkpoint advancement, and after checkpoint commit but before acknowledgement. A test that exposes only the easy post-receipt phase can validate cache replay without validating duplicate-effect safety.

This refines the existing Scout rule in [Crash-resilience evals must measure recovery, not assign it](./2026-08-25-agent-crash-durability-benchmark.md): every advertised recovery metric needs a falsification fixture at the exact boundary whose failure it claims to prevent. It also agrees with [Agent Runtime Effect Integrity](../agent-runtime-effect-integrity.md), which treats an admitted dispatch without a settled effect receipt as unknown rather than safely replayable.

## Limitations

Scout inspected producer-authored source and tests statically. It did not install dependencies, run the suite, kill a real worker process, call an external tool, or demonstrate an actual duplicated effect. The repository was created the day before inspection and had zero stars; this is evidence about the reviewed implementation and test boundary, not deployment prevalence or production incident frequency.

The reviewed SQLite store also performs separate commits for run transitions, checkpoints, invocation records, approvals, and traces. This finding does not audit all possible torn-state combinations, concurrency behavior, filesystem durability, or power-loss semantics. Its claim is narrower: the published crash test injects failure only after the receipt that makes replay safe, leaving the effect-before-receipt interval unmeasured.

## Primary evidence

- [README claims and reported reliability metrics](https://github.com/Davedave001/axiom-runtime/blob/947c224dca97706fde9840afa34f0acf51b0f4fc/README.md)
- [Tool execution, invocation-record ordering, and interruption injection](https://github.com/Davedave001/axiom-runtime/blob/947c224dca97706fde9840afa34f0acf51b0f4fc/src/axiom/engine/runner.py#L331-L479)
- [SQLite invocation-record persistence](https://github.com/Davedave001/axiom-runtime/blob/947c224dca97706fde9840afa34f0acf51b0f4fc/src/axiom/state/store.py)
- [Worker-interruption recovery test](https://github.com/Davedave001/axiom-runtime/blob/947c224dca97706fde9840afa34f0acf51b0f4fc/tests/test_fault_injection.py#L177-L213)
- **Discovery query:** GitHub Repository Search API `"AI agent" checkpoint durable execution pushed:>2026-10-25`, sorted by updated; `incomplete_results: false`
