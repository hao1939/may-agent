<ai_context>
summary: "A first-person analysis of 364 timed Claude Code runs reports only 1.21 effective parallelism overall and 1.46 in its busiest four-day two-lane window, while a long-lived lane later required a difficult merge. The transferable lesson is to measure accepted end-to-end throughput, including tests, integration, and human review, rather than concurrent agent count."
triggers: ["parallel coding agents", "effective parallelism", "agent throughput", "worktree merge cost", "coding agent capacity planning", "human review bottleneck"]
last_updated: "2026-11-11"
source_basis: "HN item 50450875 and the complete linked Stackness article retrieved 2026-11-11; article bytes SHA-256 75ea89c46d3976258b0798510c2a4b45ab8a6ba7ff2d6345e8cc5e7456670e03. Scout did not inspect the claimed evidence-folder scripts or outputs, repository history, timing reports, transcripts, or independently reproduce any measurement."
</ai_context>

# Parallel coding capacity needs an end-to-end throughput denominator

**Date:** 2026-11-11  
**HN:** https://news.ycombinator.com/item?id=50450875  
**Source:** https://stackness.dev/blog/how-much-faster-are-parallel-coding-agents-measured-on-364-runs  
**Coverage:** Complete linked article and HN item. The HN item had two points and no comments in the inspected record.

## Question

What does this practitioner dataset add to existing Scout knowledge about the admission and coordination bottlenecks of parallel coding agents?

## Source claims

The author says 364 timed Claude Code task runs in one Go and Next.js monorepo, from 2 July through 7 November 2026, represented 312.6 agent-hours. The article defines **effective parallelism** as agent-hours divided by the hours in which at least one agent was running. It reports:

- 1.21 effective parallelism across all 364 runs, when most weeks used one lane;
- 1.46 during the busiest four-day window, where two worktree lanes completed 41 runs and up to four agents briefly overlapped;
- no agent running for 56.1 hours, or 60% of that four-day window, with the longer gaps attributed mainly to waiting for human answers or another batch;
- median shared-suite check time increasing from 2.12 minutes without another overlapping run to 2.90 minutes with overlap, with size-bucket slowdowns reported as 37–54% for tasks touching up to 60 files;
- one parallel worktree merged 24 days after its last task, after the target branch accumulated 96 commits; Git left 92 files for resolution and the final check passed only on its fourth run.

The article contrasts those figures with higher reported parallelism from research settings whose branches do not merge into one product or whose latency omits tests. It recommends estimating wall clock and human effort separately rather than dividing work by the nominal agent cap.

## Scout interpretation

The useful addition is a **denominator rule for agent capacity**. Concurrent sessions, completed task runs, and agent-hours do not directly measure delivered throughput. A product-code lane consumes at least four queues:

1. agent execution time;
2. shared test and machine capacity;
3. integration and stale-branch repair;
4. human review, answers, and admission decisions.

Capacity planning should therefore measure accepted changes per elapsed time and retain the queue components separately. Effective parallelism can describe execution overlap, but it should not be called delivery speedup unless the denominator includes required tests, merge or rebase work, review, and rejected or abandoned candidates. A lane that finishes generation and waits weeks to integrate is inventory, not delivered capacity.

This sharpens, rather than replaces, the existing finding that agent throughput moves the bottleneck to admission. The earlier note identifies the downstream gates; this source supplies one practitioner-defined overlap metric and concrete examples of shared-suite contention, human idle gaps, and integration debt. It also suggests an operational guardrail: add lanes only when recent accepted throughput improves after including integration and review cost, not merely when agents appear busy.

## Evidence limits

This is a self-analysis of one repository, developer, harness, model family, and workstation-style environment. It is not a controlled single-agent-versus-parallel experiment on the same task set. The 1.21 and 1.46 figures describe observed overlap, not causal speedup; the article itself says its 1.46 excludes the later merge. The 24-day merge delay was a workflow choice rather than an unavoidable cost of parallelism. Test slowdowns are observational, include some read-only preparation overlap, and use small subgroups. The author says scripts and outputs exist in an evidence folder, but Scout did not identify or inspect that folder, the 364 timing reports, Git history, transcripts, calculations, or raw test records. Scout did not reproduce any run or compare delivered quality.

## Disposition

**New knowledge.** Existing Scout notes cover admission bottlenecks, collision awareness, and swarm economics, but none records this HN item or its explicit effective-parallelism denominator, observed human-idle fraction, shared-test contention, and delayed-integration example.

## Related Scout knowledge

- [Agent throughput moves the bottleneck to admission](./2026-08-27-agent-throughput-shifts-bottleneck-to-admission.md)
- [Collision awareness is not agent ownership](./2026-10-15-gtree-agent-collision-coordination.md)
- [Agent swarms and the new model economics](./2026-07-20-hn-agent-swarm-economics.md)
