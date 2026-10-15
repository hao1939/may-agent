<ai_context>
summary: "Agent Baseline's version-1 reference architecture separates output acceptance from authority enforcement and keeps sandbox, network, supply-chain, and identity boundaries constant as orchestration becomes more autonomous."
triggers: ["secure software factory", "Agent Baseline", "agent-orchestrated factory", "runtime authorization", "software factory security", "plans are not permissions"]
last_updated: "2026-10-15"
source_basis: "Complete version-1 reference-architecture Markdown at pinned repository revision d842a1bb34a42e9d7c0d54a1b12ead9e0e59e283, its public landing page, and HN item 50109203. This is a contributor-authored design, not a deployed-system evaluation."
</ai_context>

# Keep software acceptance separate from agent authority

**Date:** 2026-10-15  
**Disposition:** New knowledge  
**Source:** https://agentbaseline.org/reference-architecture  
**HN:** https://news.ycombinator.com/item?id=50109203  
**Pinned source:** https://github.com/agentbaseline/agentbaseline/blob/d842a1bb34a42e9d7c0d54a1b12ead9e0e59e283/software-factory/software-factory.md

## Question

What useful boundary does Agent Baseline's new Secure Software Factory reference architecture add to agent-orchestration design?

## Source observation

The version-1 document models a software factory as an inner build-and-verify loop plus an outer review, evaluation, and production-feedback loop, surrounded by four security responsibilities:

1. a per-task **sandbox** confines execution and excludes host, sibling-task, and unmediated escape paths;
2. a default-deny **network** boundary mediates destinations, operations, and resources rather than merely checking hostnames;
3. a **supply-chain** boundary admits approved components and sources and attaches provenance to outputs; and
4. **identity and access** binds every action to an agent, the principal it acts for, a profile ceiling, a narrower task scope, and any still-narrower delegation.

The document explicitly gives the loops and boundaries different jobs: verification and validation decide whether an artifact is acceptable, while authorization and enforcement decide what the agent may do while producing it. Passing tests cannot retroactively justify excessive access, and staying within access scope does not establish that the resulting code is correct.

Its three autonomy levels change who selects the next step—a developer, a predefined workflow, or an orchestrator agent—but not the four boundaries. At the agent-orchestrated level, an orchestrator may propose profiles and task scopes, yet a separate authorization service decides access and the execution layer alone starts workers. The source summarizes the division as agent proposes, policy authorizes, and infrastructure enforces.

The architecture also makes observability part of enforcement rather than a generic transcript: each boundary records its own admissions, grants, execution, and reached effects under a shared run identifier, outside agent control. A run should fail closed if a required enforcement point or required security record is unavailable.

## Interpretation

The reusable design test is **autonomy monotonicity**: increasing an agent's freedom to choose work must not silently increase its power to authorize or execute that work. A useful autonomy-level label therefore needs independent evidence for:

- orchestration: who chose the next task;
- admission: which profile and exact task scope were approved, from which trusted context;
- mediation: which sandbox, protocol-aware proxy, supply-chain gate, and credential boundary enforced that decision;
- acceptance: which tests, reviews, evaluations, and rollout checks advanced the artifact; and
- effect: what actually executed or reached a downstream system.

This prevents two common collapses: treating a successful build as proof that the run was authorized, and treating an orchestrator's plan as a capability grant. It also makes a source-authenticated signal insufficient by itself: attacker-influenced content inside a genuine alert still cannot define its own access scope.

## Limits

This is an open-for-comment reference architecture authored by contributors from the named organizations. Scout inspected the complete repository Markdown at revision `d842a1bb34a42e9d7c0d54a1b12ead9e0e59e283`, the landing page, and the HN submission, but did not inspect or run a conforming factory, validate the linked incident accounts, test the controls, or establish that the named products implement the design. The HN item had no discussion at inspection.

The source itself leaves derivation of task scope from untrusted inputs as an open implementation question. It also places model-provider security, administrator abuse, and persistent memory stores outside scope. Its invariants are design requirements, not evidence that default-deny mediation, credential isolation, tamper-evident logs, fail-closed behavior, revocation, or complete coverage of equivalent effect paths has been achieved in a deployment.

## Evidence inspected

- [Secure Software Factory landing page](https://agentbaseline.org/reference-architecture)
- [Pinned version-1 reference architecture](https://github.com/agentbaseline/agentbaseline/blob/d842a1bb34a42e9d7c0d54a1b12ead9e0e59e283/software-factory/software-factory.md)
- [HN item 50109203](https://news.ycombinator.com/item?id=50109203)
