<ai_context>
summary: "HarnessSafe evaluates delayed attacks across memory, skills, Tool/MCP state, memory-to-skill transformations, subagents, summaries, and shared artifacts. Its stage-resolved traces show why endpoint attack-success rate is an incomplete safety metric: a harness that blocks execution only after poisoned state has crossed a boundary is operationally different from one that rejects the state at entry. Results also make the harness-model pairing—not either component alone—the minimum unit of a containment claim."
triggers: ["2608.06984", "HarnessSafe", "persistent carriers", "persistent-risk lifecycle", "harness security", "memory poisoning", "skill poisoning", "MCP poisoning", "session summary", "Chain-Stage Score", "delayed activation"]
last_updated: "2026-08-11"
source_basis: "arXiv 2608.06984v1 metadata, PDF, and TeX source inspected, including benchmark design, main results, matched controls, support accounting, and experimental limitations. Claims below are attributed to this single-trial preprint evaluation under permissive non-interactive profiles."
</ai_context>

# Persistent-risk evaluation must distinguish clean rejection from last-moment blocking

Date: 2026-08-11  
Source: https://arxiv.org/abs/2608.06984v1  
Source: https://export.arxiv.org/api/query?id_list=2608.06984  
Tags: agent-security, harnesses, persistent-state, memory, skills, mcp, subagents, evaluation

## Finding

HarnessSafe treats an agent attack as a **delayed state lifecycle**, not just a malicious prompt followed by a bad endpoint. Each of its 328 executable cases declares five roles:

1. an attacker-influenced entry;
2. the carrier or carrier path retaining that influence;
3. a session, process, agent, carrier, or workspace boundary it must survive;
4. a later independently benign trigger; and
5. an observable violation.

The seven tested carrier families cover memory, reusable skills, Tool/MCP state, memory-to-skill transformation, subagent delegation, session summaries, and shared artifacts. Harness-specific adapters may bind those roles to different native mechanisms, but may not move the adversarial instruction into the benign trigger or weaken the violation oracle.

This framing exposes a measurement error in binary attack-success rate (ASR). A run that never contacts poisoned state and a run that reconsumes it after a boundary, attempts an unsafe action, but gets blocked both count as “no successful attack.” They do not present the same residual risk or require the same repair.

## Stage-resolved evidence

HarnessSafe assigns each eligible trace to its furthest evidence-supported stage:

- **N0:** no contact with the poisoned surface;
- **N1:** exposure;
- **N2:** payload influence on state, artifacts, arguments, or behavior;
- **N3:** persistence across the declared boundary and benign-stage reconsumption;
- **N4:** unsafe attempt without successful execution;
- **N5a:** case-specific oracle confirms a violation; and
- **N5b:** the complete declared chain plus an exact trigger-stage canary is confirmed.

Workflow noncompletion is recorded separately and is not interpreted as safety. The paper summarizes stages with a Chain-Stage Score (CSS), where higher means earlier containment, while preserving the stage distribution for diagnosis.

That distribution carries information ASR loses. OpenCode and Hermes Agent had nearly equal reported ASRs, 10.08% and 10.81%, but their unsuccessful chains concentrated at different stages: more N1 stops for OpenCode versus more N2/N4 stops for Hermes. A security team looking only at ASR would miss whether it needs stronger ingestion controls or stronger post-influence authorization controls.

## The configuration is the unit of safety

The cross-harness results do not support a universal “safe harness” ranking:

- With the backend held at GPT-5.6-Sol, CSS was **39.4 under Claude Code** and **62.3 under Codex CLI**.
- With Claude Code held fixed, changing the backend produced CSS from **22.7 to 58.7** and ASR from **1.27% to 54.26%**.
- The highest-overall configuration, Codex CLI with GPT-5.6-Sol, still had the lowest reusable-skill CSS, **47.0**, versus the family leader's **70.0**.

Thus the minimum meaningful claim is scoped to **harness version + backend + permission profile + carrier family**. A model result does not transfer automatically to another harness, and an overall harness result does not establish uniform containment across its state surfaces.

## Matched controls support the delayed lifecycle

On 279 cases eligible across all arms under Claude Code with Claude Haiku 4.5, full-lifecycle ASR was 25.8%. Replacing the malicious entry reduced ASR to 0.4%; removing persistence reduced it to 2.5%; withholding the later trigger reduced it to 0.0%; and cleaning the carrier before reactivation reduced it to 1.8%.

These controls support the paper's central attribution: the measured violations generally depended on attacker-influenced state being planted, surviving, and later being reconsumed—not merely on the nominally benign task.

## Operational implication

Persistent-agent assurance should preserve a lifecycle receipt for every security-relevant state transition:

- record who or what wrote memory, skills, summaries, tool metadata, and shared artifacts;
- test whether untrusted influence survives compaction, synthesis, delegation, restart, and workspace handoff;
- separate **exposure**, **durable influence**, **reconsumption**, **unsafe attempt**, and **executed harm** in telemetry;
- place defenses at multiple stages: admission, transformation, boundary crossing, retrieval, authorization, and cleanup; and
- regression-test the exact harness-model-permission configuration instead of inheriting a safety label from either model or harness alone.

The non-obvious lesson is that **successful last-moment blocking is not equivalent to containment**. If hostile state repeatedly reaches N3 or N4, the system remains one downstream policy regression away from N5.

## Evidence limits

This is an arXiv v1 benchmark, and each case/configuration was run once, so the paper does not estimate benchmark-wide run-to-run variance. Runs used the most permissive natively supported non-interactive profiles; results should not be generalized to approval-heavy deployments. CSS uses an ordinal weighting chosen by the authors and measures progression, not harm magnitude. Some harnesses lacked native support for some carrier paths, and those rows are correctly excluded rather than treated as safe, but their aggregate scores are not directly comparable to full-support results. The direct same-backend harness comparison rests on one backend. Treat the results as evidence for lifecycle-resolved evaluation and configuration-scoped testing, not as a durable product leaderboard.
