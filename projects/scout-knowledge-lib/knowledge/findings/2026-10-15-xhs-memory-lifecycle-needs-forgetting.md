<ai_context>
summary: "A complete XHS post extends the familiar working/episodic/semantic memory split with procedural memory and explicit forgetting. The useful signal is lifecycle separation, not validation: the post provides examples but no primary PDF link, implementation, experiment, or measured result."
triggers: ["agent memory", "working memory", "episodic memory", "semantic memory", "procedural memory", "forgetting", "memory lifecycle", "6ac6d48b000000000a025158"]
last_updated: "2026-10-15"
source_basis: "Complete readable body and six displayed comments from XHS note 6ac6d48b000000000a025158, inspected 2026-10-15. Attached images and the named PDF were not inspected; no primary-source link, implementation, trace, experiment, or quantitative evaluation was supplied."
</ai_context>

# Agent memory needs lifecycle boundaries, including forgetting

**Observed:** 2026-10-15  
**Disposition:** New source-grounded finding  
**Question:** What does this current XHS explanation add to the library's existing three-tier memory taxonomy?  
**Coverage:** Complete readable post body and six displayed comments. Attached images and the named PDF were not inspected.

## Source

- **Source:** [XHS note 6ac6d48b000000000a025158](https://www.xiaohongshu.com/explore/6ac6d48b000000000a025158)
- **Title:** “AI笔记 | Agent Memory 5层智能体记忆架构”
- **Author shown by XHS:** HHermess
- **Reviewed version:** XHS note ID `6ac6d48b000000000a025158`, readable body as retrieved on the observation date

## What the source says

The post describes five layers:

1. **Working memory:** the context window containing instructions, current conversation, tool results, retrieved documents, and injected state; older material is truncated or compressed when capacity is exhausted.
2. **Episodic memory:** a record of attempted tasks, methods, successes, failures, and explanations, intended to reduce repeated mistakes and rediscovery.
3. **Semantic memory:** persistent facts such as user preferences, API endpoints, and deployment locations, described as knowledge distilled from experience into a queryable store.
4. **Procedural memory:** a successful method promoted into a named reusable skill with steps, tools, prerequisites, and success criteria.
5. **Forgetting:** deletion or retirement of stale material so changed user locations, API versions, or deployment procedures do not compete with current facts and methods.

One displayed comment summarized the scheme as managing information with different lifecycles; the author agreed. The remaining displayed comments expressed interest but supplied no technical corroboration.

## Comparison with existing Scout knowledge

Scout's earlier [three-tier XHS memory note](../agent-patterns-xhs-2024.md#2-agent-memory-architectures-the-three-tier-model) already separates working, episodic, and semantic memory. The current post is therefore not evidence that those three categories are new. Its incremental value is to make two transitions explicit:

- a successful episode can be **promoted into a reusable procedure** rather than remaining only a retrieved history;
- a once-valid fact or procedure can become **eligible for retirement** rather than remaining indefinitely retrievable.

The broader library already records real memory-lifecycle implementations and their limits in [Agent Architectures](../agent-architectures.md#agent-memory-infrastructure-june-2026--exploding-category). This XHS post does not strengthen that implementation evidence. It is useful instead as a concise community-facing taxonomy that places skill extraction and forgetting alongside storage and retrieval.

## Reusable interpretation

Treat the five labels as different lifecycle contracts, not as five interchangeable storage backends:

- working memory needs admission and compaction rules;
- episodic memory needs event provenance and outcome labeling;
- semantic memory needs revision and contradiction handling;
- procedural memory needs promotion criteria, versioning, and executable success checks;
- forgetting needs supersession, expiry, or retirement rules that preserve enough lineage for audit and recovery.

The post's examples sharpen one operational warning: retrieval quality cannot fix a store that does not represent validity over time. An agent may correctly retrieve both `/v1` and `/v2`, or both an old and new deployment procedure, yet still act incorrectly unless the memory layer records which item supersedes the other. That is an interpretation consistent with the examples, not a measured result from the source.

## Evidence limits

- This is an explanatory XHS post, not a paper, implementation report, benchmark, or independently audited production case.
- The post calls the material an “Anthropic / Claude Code” PDF note and names “Agent Memory — The 5-Layer Playbook.pdf,” but supplies no inspected primary-source URL or version. Scout did not verify that attribution.
- Attached images and the named 13-page PDF were not inspected, so this record covers the readable post body only.
- The source supplies no schema, lifecycle algorithm, implementation, trace, workload, comparison group, error analysis, or quantitative result.
- The displayed comments do not provide independent technical evidence.
- The taxonomy is not shown to be complete, mutually exclusive, or superior to other memory models; it should be used as a design checklist, not a validated architecture.
