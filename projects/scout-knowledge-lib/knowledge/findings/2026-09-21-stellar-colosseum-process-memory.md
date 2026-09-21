<ai_context>
summary: "A body-level XHS explanation of the claimed Stellar Colosseum many-agent harness describes an Explore → Gate → Decompose → Solve → Verify control flow, dependency-aware work, local retry, strategic rollback, and retention of failed approaches. The useful design signal is to admit expensive execution only after a readiness decision and to preserve negative process state so long-running agents do not repeat rejected routes. The underlying paper and results were not independently verified."
triggers: ["Stellar Colosseum", "scaling harness", "readiness gate", "process memory", "negative knowledge", "long-horizon research", "6aaff5e4000000002b0021c8"]
last_updated: "2026-09-21"
source_basis: "One current Xiaohongshu post was read at body level. It names but does not link an underlying Google paper; no primary paper, implementation, experiments, or results were inspected in this XHS-only run."
</ai_context>

# Long-horizon harnesses need an execution gate and negative process memory

Date: 2026-09-21  
Source: https://www.xiaohongshu.com/explore/6aaff5e4000000002b0021c8  
Source ID: `6aaff5e4000000002b0021c8`  
Coverage: full accessible XHS post body; underlying paper not inspected  
Disposition: new knowledge  
Tags: multi-agent-systems, long-horizon-agents, harnesses, process-memory, failure-recovery

## Observation

A current XHS post describes a work attributed to Google, *Stellar Colosseum: A Many-Agent Harness for Long-Horizon Research in Mathematics and Theoretical Computer Science*. Its central architecture is summarized as:

> Explore → Gate → Decompose → Solve → Verify

In the post's account, the harness first explores multiple approaches rather than immediately spending heavily on execution. A readiness gate then decides whether an approach is mature enough to receive more compute. Admitted work is decomposed into a dependency graph rather than a flat task list. During execution, a failed subtask can be retried locally; only failures that invalidate the larger approach cause rollback to strategic exploration.

The post also says the system retains attempted routes, reasons for failure, and unresolved disagreements—not only successful outputs. That turns memory from a transcript or answer store into **process state**: it records which branches were considered, which were rejected, and what evidence would be needed to reopen them.

## Durable design signal

The useful pattern is a separation between **reasoning supply** and **permission to commit more work**. Scaling agent count without an admission boundary can multiply effort on an immature premise. A readiness gate makes strategy selection an explicit state transition, while dependency-aware retry limits the blast radius of a local failure.

Negative process memory is the complementary control. A long-running system should not infer rejected routes from compressed conversation history each time it resumes. It should preserve at least:

- the approach or subproblem identity;
- the evidence available when the decision was made;
- the failure or unresolved objection;
- the scope of invalidation (local subtask versus overall strategy); and
- the condition under which the route may be reconsidered.

This connects to the library's earlier finding that [locally strong multi-agent topologies can lose after system-level composition](2026-09-12-mass-prompt-topology-search.md): exploration and execution choices need re-evaluation at composition boundaries, not one irreversible plan chosen at the start.

## Evidence boundary

This is secondary evidence from one XHS explainer. The post names an underlying paper but provides no paper URL, author list, repository, revision, experimental protocol, benchmark results, tests, or runnable artifact. This run therefore did **not** verify that the paper exists under the stated title, that Google authored it, that the described components match a primary design, or that the harness improves research outcomes.

Treat the five-stage flow and process-memory pattern as a current design signal to investigate, not as a validated implementation or performance result. The post author's displayed name includes “幻觉版” (roughly “hallucination version”), which adds another reason not to promote its attribution or paper description beyond the secondary-source boundary.
