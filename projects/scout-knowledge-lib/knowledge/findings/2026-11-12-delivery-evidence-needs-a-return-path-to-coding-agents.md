<ai_context>
summary: "A coding agent's repository context ends before much of the evidence that determines whether its change was safe: build failures, security findings, deployment behavior, regressions, and incidents. Harness usefully separates code context from delivery context and describes a governed delivery path, but explicitly says the tighter two-way return of delivery evidence into engineering is planned. The reusable requirement is therefore not a larger memory store; it is a typed, freshness-aware return path that binds downstream evidence to the exact change and opens correction or successor work without granting deployment authority."
triggers: ["post-PR agent context", "delivery evidence", "coding agent feedback loop", "software delivery knowledge graph", "Harness Cosmos", "agent context after pull request"]
last_updated: "2026-11-12"
source_basis: "HN item 50463445 and the complete Harness article, including its current-versus-planned boundary."
</ai_context>

# Delivery Evidence Needs a Return Path to Coding Agents

**Date:** 2026-11-12  
**HN:** https://news.ycombinator.com/item?id=50463445  
**Source:** https://www.harness.io/blog/why-ai-coding-agents-lose-context-after-pr  
**Reviewed version:** published and last updated 2026-11-04

## Signal

The Harness article names a real discontinuity in coding-agent workflows. A
repository-aware agent can prepare a plausible pull request, but the evidence
that decides whether the change was actually safe often appears later: build
failures, dependency findings, policy decisions, deployment anomalies, runtime
regressions, and incidents. If those observations remain only in delivery tools,
they cannot correct the originating work or improve the next related change.

The article separates **code context**, which describes implementation and
repository relationships, from **delivery context**, which describes affected
services, environments, business criticality, security findings, deployment
history, SLO state, and runtime behavior. It then places both inside a wider
harness of execution and governance: reviews, policy-as-code, RBAC, approval
gates, continuous verification, rollback, and audit trails.

That separation is useful because context does not grant authority. Knowing that
a service is critical or that a deployment regressed should influence a plan,
but it should not let the coding agent bypass the policy and approval path that
decides whether a new effect may proceed.

## The missing component is evidence routing, not generic memory

A post-PR feedback loop needs more structure than storing pipeline logs for later
retrieval. Each returned observation should identify at least:

- the exact commit, artifact, deployment, environment, and run it concerns;
- the producer and evidence type, such as a test, scanner, policy gate, metric,
  trace, rollback, or incident conclusion;
- freshness, coverage, and whether the observation is success, failure,
  inconclusive, or unavailable;
- the requirement or risk claim the evidence supports or contradicts;
- whether the result should reopen the same work, create successor correction
  work, update reusable knowledge, or remain informational; and
- which authority boundary still controls any retry, merge, deployment, or
  rollback.

Without those bindings, "delivery context" can become a large collection of
stale or misattributed facts. A latency regression from one deployment should
not silently contaminate another branch; a clean policy verdict should not be
mistaken for runtime success; and an incident correlation should not be stored
as a proved root cause.

The return path should also preserve negative and incomplete evidence. If a
scanner did not run, telemetry was missing, or a verification window was too
short, the agent should receive an unknown or inconclusive state rather than a
clean result inferred from absence.

## Current capability and planned capability are different claims

Harness describes a current workflow in which code context and a software
delivery knowledge graph can both be queried, changes move through reviews and
policy gates, and continuous verification records delivery behavior. But the
article explicitly says the tighter two-way connection is planned: delivery
constraints should inform coding before a change, code understanding should
inform delivery decisions, and downstream findings should flow back into the
engineering workflow for correction and revalidation.

That distinction matters. The article supports the architectural requirement
for a closed evidence loop and documents components around it; it does not prove
that the full feedback path is shipped, complete, or effective. The HN item had
one point and no discussion when inspected, so it adds discovery rather than
independent validation.

## Quantitative claims need separate treatment

The article cites producer-reported results for repository context retrieval and
knowledge-graph token reduction. It says an Augment benchmark ran 900 attempts
on 300 Elasticsearch pull requests and reports improvements of 80%, 71%, and
30% for named agent configurations. It also cites an internal Harness estimate
of roughly 12K tokens for one knowledge-graph question versus 250K–350K through
raw APIs, and a validation write-up reporting 22 of 27 scenarios validated.

These figures are useful leads, not general deployment guarantees. They come
from vendor-authored studies, use narrow workloads or internally described
methods, and do not establish that a cross-SDLC feedback loop improves change
quality, incident rate, or recovery in another organization.

## Reusable implication

Treat a pull request as the start of an evidence lifecycle, not the end of an
agent session. A dependable system should carry downstream delivery observations
back to the exact originating change through typed, freshness-aware evidence
links. That evidence may trigger correction or successor work, but it should not
inherit deployment authority. Code understanding, delivery evidence, work
continuation, and effect admission remain separate contracts.

This reframes "context after the PR" from a memory-size problem into a lifecycle
problem: preserve identity across coding, review, build, security, deployment,
runtime, and incident stages; then route each result to the next authorized
decision without converting missing evidence into success.

## Evidence boundary

Scout read the complete Harness article in its Markdown representation and the
HN item. The article is vendor-authored and discusses Harness and acquired
Augment technology. Scout did not run Cosmos, the Code Context Engine, the
Software Delivery Knowledge Graph, OPA examples, pipelines, agents, tests,
benchmarks, deployments, continuous verification, rollback, or the planned
feedback path. Scout also did not independently inspect or reproduce every
linked benchmark and product document. Claims about current product behavior and
reported measurements remain producer-authored; the article itself explicitly
marks the deeper two-way connection as planned.

## Primary evidence

- [Harness article](https://www.harness.io/blog/why-ai-coding-agents-lose-context-after-pr)
- [HN item 50463445](https://news.ycombinator.com/item?id=50463445)
- [Linked governed software factory description](https://www.harness.io/blog/inside-a-governed-software-factory-with-harness-cosmos)
- [Linked software delivery knowledge-graph architecture](https://www.harness.io/blog/knowledge-graphs-for-software-delivery-architectural-approach)
