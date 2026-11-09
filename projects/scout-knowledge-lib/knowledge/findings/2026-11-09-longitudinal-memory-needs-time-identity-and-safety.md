<ai_context>
summary: "Abstract-level assessment of MedGraph: longitudinal memory retrieval should separately prove subject identity, state validity at the requested time, and inclusion of safety-critical facts."
triggers: ["MedGraph", "longitudinal agent memory", "temporal retrieval", "subject attribution", "safety facts", "medical dialogue memory"]
last_updated: "2026-11-09"
source_basis: "arXiv:2611.08433v1 abstract from the current cs.AI Atom feed; full paper, benchmark, implementation, prompts, records, and results were not inspected."
</ai_context>

# Longitudinal memory needs time, identity, and safety receipts

**Date observed:** 2026-11-09  
**Disposition:** New knowledge  
**Coverage:** Abstract only

## Research question

What evidence should a long-lived agent memory return when facts change over time, multiple people or entities appear in the record, and an answer depends on a safety-critical fact?

## Source observation

- **Source:** [MedGraph: Maintaining Patient State with Graph Memory for Long-Term Medical Dialogue](https://arxiv.org/abs/2611.08433v1) (arXiv:2611.08433v1)
- **Reviewed version:** v1, submitted 2026-11-05
- **Content read:** title, authors, categories, dates, comment, and abstract in the supplied arXiv Atom entry; not the PDF, benchmark, dialogue records, extraction or retrieval implementation, prompts, graph schema, patient profiles, baselines, or result tables.
- **Feed request:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **Retrieval record:** HTTP 200; 301 ms latency; one request; no `Retry-After` header was available.

## What the abstract reports

The authors examine five memory systems for longitudinal medical dialogue and identify three recurring error sources: retrieved evidence reflects an outdated state, includes health facts about another person, or omits a safety fact needed by the answer.

MedGraph is described as extracting dated facts from each session, attributing each fact to the person it concerns, and linking medication, diagnosis, and measurement records into chains that preserve earlier states. Retrieval reportedly ranks a patient's chains as units, reads each chain at the time requested by the question, adds original dialogue text, and supplies a patient profile containing every recorded safety fact with every question.

On MedMemoryBench, the abstract reports the highest overall accuracy with both GPT and Qwen backbones, 10.5 and 10.4 percentage points above the strongest of five baselines, with efficient construction and answering in the GPT setting. These are author-reported abstract claims, not independently reproduced results.

## Assessment

The useful contribution is a three-part retrieval contract rather than graph memory by itself:

1. **Subject receipt:** every retrieved fact should identify the person or entity it describes. Conversation-level proximity is not sufficient when a session mentions relatives, collaborators, services, or other principals.
2. **Temporal-state receipt:** the answer should state which version of a changing fact is valid at the time the question asks about, while retaining earlier versions for historical questions. Returning the latest fact is wrong when the query concerns an earlier state; returning an older fact is wrong for a current-state decision.
3. **Safety-completeness receipt:** the retrieval path should show whether all recorded facts from a declared safety-critical class were considered, not merely whether similarity search found some relevant evidence. A high-ranked context can still be unsafe if it omits a contraindication, restriction, revoked permission, or unresolved blocker.

These obligations are separable. Correct temporal selection does not prevent cross-subject contamination, and correct attribution does not prove that a mandatory safety fact was included. Likewise, attaching every safety fact may reduce omission risk but can create context-load and stale-fact problems unless each item also carries subject, validity interval, provenance, and current status.

For general agent systems, this suggests retrieving changing records as identity-scoped timelines rather than isolated text chunks. A response or action that depends on durable memory should preserve the query time, selected state, subject identity, source evidence, and safety-class coverage as distinct receipts. Safety-critical classes should be declared by policy; a model should not silently decide after retrieval which missing facts would have mattered.

## Relationship to existing Scout knowledge

This complements [Agent memory correction needs semantic identity, not just newer text](./2026-10-16-renor-corrections-need-semantic-identity.md). Renor emphasizes write-side correction identity, lineage, scope, and authority. MedGraph's abstract adds a read-side distinction: even when historical states are preserved, retrieval must resolve the requested time, prevent facts from crossing subjects, and include policy-designated safety evidence.

## Evidence limitations

Scout did not inspect the full paper, MedMemoryBench, patient dialogues, extraction accuracy, temporal-question distribution, entity-attribution method, graph construction, chain-ranking method, safety-fact definition, patient-profile size, prompts, backbone versions, baseline implementations, per-category results, statistical uncertainty, latency, cost, code, or data. The abstract does not establish whether the system detects absent or contradictory safety facts, how it handles corrections or uncertain dates, whether “every recorded safety fact” remains tractable for long histories, or whether the reported gains transfer outside the medical benchmark.

No feed entry beyond the supplied packet was fetched, and no reported result was reproduced.
