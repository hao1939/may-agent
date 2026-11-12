<ai_context>
summary: "A body-level XHS discussion proposes a dynamic Experience layer for proactive local agents: user preferences and procedures are retrieved before action and can be created or revised over time. The discussion also exposes the missing controls—importance scoring, provenance, admission, versioning, regression checks, and safe action routing—that determine whether accumulated experience adapts the agent or amplifies mistakes."
triggers: ["xhs", "proactive agents", "experience memory", "dynamic skills", "user preferences", "runbooks", "memory governance"]
last_updated: "2026-11-12"
source_basis: "Body-level read of XHS post 6ae03ce10000000003020e2b and visible author/community comments. The author explicitly describes the architecture as a development idea without a completed Experience implementation; Scout did not inspect code, runs, evaluations, or the commenters' claimed systems."
</ai_context>

# Proactive-agent experience needs admission and trigger controls

Date: 2026-11-12
Source: https://www.xiaohongshu.com/explore/6ae03ce10000000003020e2b
Tags: xhs, proactive-agents, experience-memory, dynamic-skills, runbooks, governance

## Observation

A body-level XHS post by HxH argues that static `SKILL.md` instructions are insufficient for a local agent that proactively intervenes in a user's work and life. The proposed **Experience** layer would accumulate user-specific preferences and procedures, retrieve relevant experience before action, and adapt as the agent observes more interactions.

The visible discussion makes the proposal more concrete while also narrowing its evidentiary status:

- The author describes Experience as combining memory with action guidance, organized as a tree rather than one linear skill file.
- Retrieval would use semantic similarity plus signal identifiers; the author says this part is still planned and has not been implemented.
- A commenter describes a deterministic engine that converts external observations into events and routes them to 30-plus runbooks. The author says the proposed Experience layer resembles those runbooks, but would add agent-created and continually updated entries.
- Another commenter proposes separating user preferences from procedures, summarizing them periodically, and asking the user before promoting important items into explicit memory or skills.
- When asked how to avoid attention dilution, the author proposes scoring environmental context and the user's historical acceptance to choose among direct execution, asking, or reminding.
- Several commenters challenge the new label, arguing that dynamic skills, long-term memory, or a changing `agents.md` can express the same mechanism.

The source therefore supports an emerging practitioner design discussion, not a validated new component category.

## Scout interpretation

The useful distinction is not whether the artifact is called **Experience**, **Skill**, **Memory**, or **Runbook**. It is whether the system governs two separate decisions:

1. **Retention:** which observations are allowed to become durable guidance?
2. **Activation:** under what current signal may that guidance influence or initiate an action?

A proactive agent makes both decisions higher risk. A mistaken preference or procedure can persist across sessions, while a weak trigger can turn that persistent error into unsolicited action. Semantic relevance alone is insufficient: it can find a similar record without proving that the record is correct, current, authorized for this context, or important enough to act on.

A governed Experience layer therefore needs at least:

- provenance linking each retained item to the observations, user statements, and outcomes that produced it;
- typed separation among facts, preferences, procedures, and action authority;
- an admission rule for promotion, with explicit user confirmation where the claim is subjective or the action is consequential;
- versioning, supersession, and rollback rather than silent in-place self-editing;
- negative evidence and rejection history, so repeated non-acceptance can reduce activation rather than merely adding more context;
- trigger receipts recording the signal, retrieved experience, chosen route, and whether the system executed, asked, reminded, or abstained;
- held-out or fresh-session checks before a generated procedure becomes generally active.

This aligns with the library's existing self-evolution taxonomy: experience memory, skill creation, skill admission, and activation routing are distinct jobs. Calling their combination Experience can be useful product language, but it does not remove their separate evidence and governance requirements.

## Evidence limitations

- The author explicitly describes the post as a development record and says the Experience retrieval design has not yet been implemented.
- No code, schema, repository, trace, benchmark, user study, or error analysis was inspected.
- Comments about production use, runbook counts, and other systems are participant claims and were not independently verified.
- The readable source does not establish how preferences are corrected, how conflicting experiences are resolved, how user acceptance is measured, or which actions require approval.
- The governance requirements above are Scout's interpretation, not measured results from the source.

## Related knowledge

- [Agent self-evolution and autonomy](../agent-self-evolution-and-autonomy.md) — separates experience memory, skill creation, admission, maintenance, and routing, and requires fresh-session and held-out evidence for durable adaptation.
- [The read-write attention inversion](../the-read-write-attention-inversion.md) — explains why deciding what enters persistent memory can be more consequential than retrieval alone.
