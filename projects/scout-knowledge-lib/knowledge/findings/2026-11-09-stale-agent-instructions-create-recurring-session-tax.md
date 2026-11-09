<ai_context>
summary: "An abstract-level controlled study of three real repository instruction defects reports that relevant stale guidance can add recoverable work without reducing final task success, while agents do not repair the shared instruction file. Treat success and recovery cost as separate outcomes, validate high-frequency instructions against current repository state, and give durable instruction repair an explicit owner."
triggers: ["stale agent instructions", "AGENTS.md maintenance", "CLAUDE.md maintenance", "documentation debt", "coding agent recovery cost", "instruction validation"]
last_updated: "2026-11-09"
source_basis: "arXiv:2611.09802v1 title, metadata, comment, and abstract retrieved through the workflow-owned cs.AI feed request on 2026-11-09. Scout did not inspect the full paper, replication package, repositories, tasks, instruction variants, trajectories, statistical analysis, prompts, models, or code."
</ai_context>

# Stale agent instructions create a recurring session tax

**Date:** 2026-11-09  
**Source:** [When Instruction Files Go Stale: Documentation Debt and Hidden Cost in Coding Agents](https://arxiv.org/abs/2611.09802v1)  
**Source revision:** arXiv:2611.09802v1  
**Coverage:** Title, metadata, comment, and abstract only  
**Disposition:** New knowledge

## Question

Can a repository instruction file remain harmful even when coding agents eventually complete their assigned maintenance tasks, and who repairs the shared defect?

## What the abstract reports

The study examines three stale instructions from active open-source repositories: an obsolete test command, an outdated code location, and a stale procedure for adding a component. Agents performed 22 maintenance tasks under three versions of each instruction: stale, corrected to current state, or removed. The code and assigned task were held fixed. The authors analyzed 732 trajectories from two models at individual-tool-call granularity.

The reported effects are selective rather than universal:

- agents followed stale guidance when it was relevant to the task, sometimes despite correct information elsewhere in the repository;
- for the stale test command, Claude Sonnet 5.5 used about two extra tool calls per run, roughly one-third more than with the corrected command;
- the authors report no detectable behavioral-cost difference for the other two stale-instruction cases;
- agents generally recovered from immediate failures and completed the task, but none repaired the underlying instruction file;
- correcting the instruction eliminated operations on obsolete paths, while removing it prevented most such operations.

The result identifies a failure mode that final task success can hide: a durable instruction defect can charge a small recovery cost to every relevant future session while surviving those sessions unchanged.

## Scout interpretation

Instruction maintenance needs at least four distinct receipts:

1. **Task outcome:** did the agent complete the assigned code change?
2. **Recovery cost:** did stale guidance add failed commands, obsolete-path reads, or other avoidable operations?
3. **Instruction diagnosis:** was the shared guidance identified as the cause rather than treated as a one-off obstacle?
4. **Durable repair:** was the authoritative instruction corrected, removed, or escalated to an owner with scope to change it?

A successful task receipt does not settle the last three. If agents only route around stale guidance, the repository accumulates **documentation debt with recurring interest**: each session can recover locally while the shared defect persists globally.

This complements [Agent instructions are maps; checks provide enforcement](./2026-10-15-agent-instructions-map-vs-enforcement.md), which finds that instruction rules rarely name executable checks, and [Stale repository signals can turn into unsolicited agent work](./2026-11-07-stale-repository-signals-distract-coding-agents.md), which concerns stale inline bug references expanding scope. The present source adds controlled evidence about authoritative agent instruction files: relevance can make agents obey stale directions, immediate recovery can conceal the cost, and task-scoped agents may not repair the shared artifact.

For agent platforms, the practical boundary is to validate high-frequency path, command, and procedure references against current repository state, measure obsolete-reference operations separately from success, and assign instruction-file repair explicitly. Automatic deletion is not justified by this abstract: two of three cases showed no detectable cost difference, and Scout did not inspect the underlying tasks or analyses.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 444 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, comment, and abstract. The full 11-page paper and linked replication package were not inspected. Therefore this note cannot assess repository selection, task construction, instruction wording, model settings, independence of the 732 trajectories, statistical power, effect sizes beyond the abstract, recovery quality, or whether any instruction repair was within the agents' authorized scope.

The abstract supports a narrow claim: relevant stale instructions can create measurable but recoverable overhead that final task success misses, and the studied agents did not repair the source artifact. It does not show that every stale instruction has a meaningful cost, that instruction removal is generally preferable to correction, or that automatic repository-wide cleanup is safe.
