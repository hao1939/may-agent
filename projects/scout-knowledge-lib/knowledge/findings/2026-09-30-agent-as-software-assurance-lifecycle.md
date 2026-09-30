<ai_context>
summary: "A current XHS paper explainer argues that agent correctness cannot be inferred from individually valid tool calls because the effective program spans prompts, tools, memory, and execution traces. Its reusable assurance split is pre-execution checks, runtime monitoring, and post-failure rule discovery, with business invariants such as evidence freshness, authorization, and budgets checked across events rather than only at tool boundaries. The underlying Onward! 2026 paper and refund example were not independently verified."
triggers: ["Agent as Software", "agent assurance lifecycle", "agent static checks", "agent runtime monitoring", "evidence freshness", "6abcd7e6000000001501017d"]
last_updated: "2026-09-30"
source_basis: "Full visible body of XHS note 6abcd7e6000000001501017d, inspected 2026-09-30. This is a secondary video description; Scout did not inspect the video transcript, cited paper, authors' artifacts, or evaluation and did not reproduce the described refund scenario."
</ai_context>

# Treat an agent run as a distributed program, not a sequence of valid calls

**Observed:** 2026-09-30  
**Disposition:** New source-grounded finding  
**Coverage:** Full visible XHS post body; no comments were returned. The video transcript, cited paper, and primary artifacts were not inspected.

## Source

- **Source:** [XHS note 6abcd7e6000000001501017d](https://www.xiaohongshu.com/explore/6abcd7e6000000001501017d)
- **Title:** “Agent as Software 把Agent当软件一样检查”
- **Author:** VistrendAI

## What the source says

The post describes a failure in which an agent allegedly issued a $127 refund even though the item had not been returned. Each tool call was syntactically valid and no individual call produced an error, but the end-to-end action violated the business condition for a refund.

The author attributes an “Agent as Software” approach to a Microsoft Research and University of Wisconsin Onward! 2026 paper. In the post's framing, an agent's effective program is distributed across prompts, tools, memory, and execution traces, so assurance should span three stages:

1. **before execution:** statically inspect the agent's available instructions and capabilities;
2. **during execution:** monitor events and enforce runtime conditions; and
3. **after failure:** derive candidate rules from violations and feed them back into later checks.

The post names event records, capability permissions, freshness of evidence, and budgets as relevant controls. These are claims in a secondary social-media explanation. Scout did not identify or inspect the cited paper, verify its title or publication status, or reproduce the refund example.

## Reusable implication

The strongest reusable point is that **tool-call validity and workflow validity are different claims**. A refund API can accept a well-formed request while the surrounding agent run lacks a recent return receipt, exceeds delegated authority, or violates a spending limit. Checks attached only to function schemas or HTTP success codes cannot establish those cross-event conditions.

A practical assurance record should therefore make each business-critical action inspectable against at least:

- the capability and authority granted to the actor;
- the prerequisite evidence and the event that produced it;
- the evidence's age or state version at decision time;
- cumulative budgets and prior effects in the run; and
- the policy revision that evaluated the action.

The three-stage lifecycle should not collapse into one undifferentiated “safe” label. Static inspection can expose missing declarations or excessive capability, runtime monitoring can evaluate facts that only exist during a run, and post-failure analysis can propose a new invariant. A proposed invariant is not yet an effective control: it still needs review, implementation at an actual enforcement point, and regression tests for both blocked violations and allowed behavior.

This also suggests an evaluation pattern for business-process agents: include trajectories where every individual tool invocation is schema-valid but the sequence violates a temporal or evidentiary invariant. Score tool validity separately from prerequisite satisfaction, authority, budget compliance, and final business outcome.

## Evidence limits

- The inspected artifact is the text description attached to an XHS video; Scout did not obtain or transcribe the video's spoken or visual content.
- The post does not provide a paper URL, title beyond “Agent as Software,” author list, artifact revision, experiment table, or implementation details.
- Scout did not verify the claimed Microsoft Research/University of Wisconsin affiliation, Onward! 2026 venue status, refund amount, or scenario provenance.
- No claim is made here about the proposed approach's effectiveness, completeness, overhead, or production readiness.
- The post had no returned visible comments, so it provides no independent corroboration or critique.

## Related library context

This finding complements [Keep red-team evidence, policy, and enforcement separate in a test-to-guardrail loop](2026-09-30-agent-red-team-findings-to-guardrails.md): that note separates a discovered failure from a derived defense and its validation, while this source highlights why end-to-end temporal and evidentiary invariants can fail even when each tool call is locally valid.
