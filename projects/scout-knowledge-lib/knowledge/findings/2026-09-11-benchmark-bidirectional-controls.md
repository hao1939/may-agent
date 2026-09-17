<ai_context>
summary: "Rails Lemans turns benchmark preflight into two opposite executable controls: a shipped oracle must earn full credit and an untouched-tree no-op must earn zero. This cheaply detects impossible and vacuous tasks before paid agent runs, while result digests and revisions bind later scores to task/profile state; the current workflow remains operator-invoked rather than an automatic admission gate."
triggers: ["Lemans", "coding-agent benchmark", "benchmark preflight", "oracle control", "no-op control", "evaluator validation", "result provenance"]
last_updated: "2026-09-11"
source_basis: "Pinned README and implementation inspection at rails/lemans commit a659b1b038ccb769a5b36668f38e658745828f4f. No benchmark was independently executed."
</ai_context>

# A Benchmark Needs Controls at Both Ends of Its Score Range

**Date:** 2026-09-11  
**Source:** GitHub  
**Repo:** https://github.com/rails/lemans  
**Inspected revision:** https://github.com/rails/lemans/commit/a659b1b038ccb769a5b36668f38e658745828f4f  
**Discovery feed:** https://api.github.com/search/repositories?q=agentic+pushed%3A%3E%3D2026-09-01+stars%3A%3E20&sort=updated&order=desc&per_page=30 (`incomplete_results: false`; first 30 of 7,015 results)

## Finding

Lemans documents a useful, low-cost preflight for coding-agent benchmarks: run every task once with an **oracle** that applies the task's shipped solution and require a score of `1.0`; then run every task with a **no-op** agent against the untouched tree and require `0`.

The two controls catch opposite evaluator failures:

| Control | Expected result | Failure reveals |
|---|---:|---|
| Shipped oracle solution | `1.0` | The task, setup, solution, or verifier cannot recognize a declared success |
| No-op on untouched tree | `0` | The task begins solved, leaks the answer, or has a vacuous/permissive verifier |

This is stronger than checking only that tests execute. A benchmark can run cleanly while accepting everything, or reject everything while appearing strict. A high-end and low-end control establish that at least two known points map to opposite ends of the scoring range.

Pinned implementation supports the documentation rather than leaving these as labels. The oracle uploads and executes a task's `solution`, `solve.sh`, or `solution.patch`, and treats a failed supplied solution as infrastructure/configuration failure. The no-op returns completion without changing the environment. Lemans also records a profile digest, task-tree digest, repository revision, and harness version in each result, alongside the agent patch, trajectory, and verifier artifacts. That makes a score traceable to the benchmark material that produced it.

Primary pinned evidence:

- [README: oracle/no-op preflight and run artifacts](https://github.com/rails/lemans/blob/a659b1b038ccb769a5b36668f38e658745828f4f/README.md#4-prove-the-bench-before-benchmarking-anything)
- [oracle agent implementation](https://github.com/rails/lemans/blob/a659b1b038ccb769a5b36668f38e658745828f4f/lib/lemans/agents/oracle.rb)
- [no-op agent implementation](https://github.com/rails/lemans/blob/a659b1b038ccb769a5b36668f38e658745828f4f/lib/lemans/agents/nop.rb)
- [result provenance fields](https://github.com/rails/lemans/blob/a659b1b038ccb769a5b36668f38e658745828f4f/lib/lemans/result.rb#L145-L248)
- [task-tree digest](https://github.com/rails/lemans/blob/a659b1b038ccb769a5b36668f38e658745828f4f/lib/lemans/task_definition.rb#L203-L204)

## Design implication

Put a **bidirectional smoke gate** before expensive or decision-bearing evaluation:

```text
known success -> must receive maximum required score
known absence -> must receive minimum required score
both pass      -> admit the benchmark revision for candidate trials
```

This complements, rather than replaces, mutation testing and known-better/known-worse discrimination. Oracle/no-op controls establish basic endpoint responsiveness. They do not show that intermediate scores are calibrated, that subtly wrong solutions fail, that repeated trials are stable, or that the tasks generalize beyond their declared cases.

For stronger admission, bind the two control results to the exact task digest, profile digest, verifier revision, and harness version, and invalidate admission whenever any of those changes. That prevents an old green preflight from silently authorizing a changed benchmark.

## Limits

The repository inspection establishes implemented oracle/no-op agents and provenance fields, not real-world benchmark validity or adoption. The README presents the two runs as commands an operator should execute; this inspection did not find evidence that every ordinary candidate run is automatically blocked until those controls pass. The result digests support comparison, but recorded provenance does not by itself enforce that a consumer rejects mismatched or stale evidence.

Repository search metadata described Lemans as a Ruby agent-benchmark harness and showed 69 stars in the observed response. That metadata motivated inspection; it is not evidence that the benchmark controls work in all environments. No run was reproduced, and no claims are made about benchmark scores or model performance.
