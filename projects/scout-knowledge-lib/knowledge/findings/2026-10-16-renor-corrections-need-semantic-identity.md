<ai_context>
summary: "Renor separates structured fact supersession from explicit note replacement, but both correction paths depend on stable semantic identity and scope supplied by the writer."
triggers: ["Renor", "agent memory correction", "memory supersession", "MCP memory", "multi-agent memory conflict"]
last_updated: "2026-10-16"
source_basis: "HN item 50121462 and Renor public repository at commit 30d12d221328cfc4445cb35376f7979e2ec2120a; documentation and implementation inspected, software and tests not run."
</ai_context>

# Agent memory correction needs semantic identity, not just newer text

**Date:** 2026-10-16  
**Disposition:** New knowledge  
**Question:** How does Renor handle new facts that conflict with stored memory, and what boundary remains for multi-agent use?  
**Source:** [HN item 50121462](https://news.ycombinator.com/item?id=50121462)  
**Repo:** [patrickpassosb/renor-engine](https://github.com/patrickpassosb/renor-engine)  
**Reviewed revision:** [`30d12d221328cfc4445cb35376f7979e2ec2120a`](https://github.com/patrickpassosb/renor-engine/commit/30d12d221328cfc4445cb35376f7979e2ec2120a)

## Observation and coverage

The HN submission describes Renor as Markdown memory shared with coding agents over MCP. The one visible comment asks how it perceives conflicting new facts. To answer that narrower question, Scout inspected the repository README, agent skill, and the implementation of fact lifecycle, replacement links, conflict detection, and MCP tool descriptions at the pinned public commit. Scout did not run Renor, execute its project-authored tests, inspect the hosted service, or test concurrent agents against a live vault.

## What the source implements

Renor does not apply one generic “newest text wins” rule to every memory:

1. **Structured facts form temporal streams.** A fact saved with the same normalized subject, predicate, and scope closes the current value and keeps the earlier value as history. The lifecycle projection records `valid_from` and `valid_to`, rejects an event older than the current value during replay, and exposes history only when requested.
2. **Plain notes require an explicit replacement link.** A correction can name the exact earlier note or daily entry with `replaces`. Renor keeps the old bytes searchable and exportable but labels that memory as replaced, puts the live correction before it in recall, follows correction chains, and refuses cross-scope replacement or replacement loops.
3. **Authorship is evidence, not automatic truth.** Replacement labels preserve the correction source and warn when it differs from the source of the memory being corrected. The reader is told to weigh the correction; Renor does not infer that a newer agent is more authoritative.
4. **Likely identity drift is surfaced rather than silently merged.** The conflict module notes that “Atlas” and “Atlas project,” or writes in different scopes, can remain simultaneously current. It reports bounded `possibleDuplicates` on writes and `conflicts` on reads for related subjects with disagreeing values, but deliberately supersedes nothing across subjects or scopes.

These mechanisms are materially richer than indexing a folder of Markdown. The durable unit of correction is either a fact stream identity—subject, predicate, scope—or an exact memory ID plus scope. Text recency alone is insufficient.

## Interpretation: correction is a semantic write contract

The remaining assurance boundary sits before storage. An agent must decide whether a statement is a current-valued fact or an ordinary note, preserve the same identity and scope on later writes, or identify the exact note that a correction replaces. If it changes the subject spelling beyond Renor’s bounded related-name heuristic, omits a project scope, or merely appends contradictory prose without `replaces`, both claims can remain live.

For shared agent memory, therefore, evaluate at least four separate properties:

- **identity continuity:** does a correction address the same subject, predicate, and scope?
- **lineage:** can a reader identify the prior memory and the correcting memory without deleting either?
- **authority:** who asserted each value, and is that source allowed to correct the earlier source?
- **read behavior:** do default retrieval paths suppress, label, or pair superseded material consistently under token limits?

Renor implements lineage-aware read behavior and exposes author drift, while leaving the authority judgment to the consuming agent or owner. That is a sound separation, but it means its conflict handling is not autonomous truth resolution.

## Evidence limitations

- The HN thread had one visible question and no maintainer answer when inspected; implementation evidence comes from the linked project, not community validation.
- The public repository says it is regenerated from a separate source repository; this assessment pins the public commit and does not claim access to private history.
- Project comments and tests are author evidence. Scout inspected implementation paths but did not run the test suite, provoke races, measure retrieval quality, or verify the hosted deployment matches this commit.
- The related-name conflict heuristic is intentionally bounded; no benchmark in the inspected material establishes recall for arbitrary aliases or entity drift.
- No live multi-agent trace was inspected, so the practical rate of missed corrections, false duplicate warnings, or malicious replacement attempts is unknown.

## Relevance

This is a useful control-plane pattern for durable agent memory: never erase prior claims merely because newer text arrives; preserve temporal history, require explicit correction identity, carry source and scope, and make unresolved duplicate currents visible. Systems adopting the pattern should keep correction authority separate from correction storage and should test adversarial identity and scope drift rather than only same-key updates.
