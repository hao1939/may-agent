<ai_context>
summary: "A Fossil SCM fork prototypes a local-first knowledge layer that separates pooled notes, retrieval/review metadata, and durable Fossil-native artifacts; the separation improves inspectability but makes promotion and lineage explicit contracts rather than automatic consequences of version control."
triggers: ["Fossil SCM", "agentic workflow", "local-first agent memory", "knowledge commons", "durable artifacts", "provenance-aware retrieval"]
last_updated: "2026-09-20"
</ai_context>

# Fossil fork puts agent memory beside the software forge

## Observation

A current Hacker News search surfaced **“Adapting Fossil-scm as a platform for AI agentic workflow”**. The HN item had 3 points and no comments when inspected, so it is a discovery lead rather than evidence of adoption or community validation.

At pinned repository revision `e1317fb22093611b5630ec41dd2492b518beaede`, the fork describes an “Open Knowledge Commons” built into Fossil. Its design separates:

- working and indexed notes in SQLite (`ai_note`);
- retrieval history and review metadata in related tables;
- promoted text in Fossil-native wiki or versioned-file artifacts; and
- explicit artifact states such as `draft`, `materialized`, `stale`, and `superseded`.

This is more concrete than a generic “memory in Git” claim. The checked source contains a `/knowledge-browser` implementation that queries `ai_note` and links indexed records to repository artifacts. Repository-authored Tcl tests cover note creation, semantic retrieval, retrieval-history records, filtering, artifact links, and a promotion transition from tier 1 to tier 2. The README also documents independent chat and embedding backends through Fossil settings.

## Why it matters

The useful architecture signal is **co-location without conflation**. Keeping memory metadata in the forge's SQLite repository and durable text in native versioned artifacts can make provenance, review, and self-hosting easier to inspect. But repository durability does not by itself prove knowledge lineage: the design still needs explicit links between source notes, retrieval events, review decisions, and the materialized artifact.

The project documents that boundary correctly by assigning origin to provenance fields and publication targets to separate artifact fields. For agent systems adopting the pattern, promotion should therefore yield a receipt that binds the source-note set, review decision, resulting artifact identity, and artifact state. Retrieval count can inform curation, but it is a reuse signal—not authority or correctness.

## Evidence and limitations

- **Read:** the HN item metadata; repository README; product summary; implementation plan; provenance model; test plan; selected `agent_web.c` query paths; and selected assertions in `tst/agent.test`.
- **Not established:** production use, independent reliability, semantic-retrieval quality, atomicity of note-to-artifact promotion, or correctness under concurrent writers.
- The product summary is marked **Draft**. The repository is a two-star fork whose checked default-branch revision was last pushed on 2026-07-15. Repository tests were inspected but not executed in this assessment.
- The implementation plan distinguishes current foundations from planned milestones, so roadmap statements should not be treated as shipped behavior without source-level confirmation.

## Sources

- **HN:** https://news.ycombinator.com/item?id=49772474
- **Repository:** https://github.com/BenSiv/fossil-scm/tree/e1317fb22093611b5630ec41dd2492b518beaede
- **Product summary:** https://github.com/BenSiv/fossil-scm/blob/e1317fb22093611b5630ec41dd2492b518beaede/doc/specs/ai-management-system.md
- **Implementation plan:** https://github.com/BenSiv/fossil-scm/blob/e1317fb22093611b5630ec41dd2492b518beaede/doc/ai/IMPLEMENTATION_PLAN.md
- **Provenance model:** https://github.com/BenSiv/fossil-scm/blob/e1317fb22093611b5630ec41dd2492b518beaede/doc/ai/PROVENANCE.md
- **Implementation and tests:** https://github.com/BenSiv/fossil-scm/blob/e1317fb22093611b5630ec41dd2492b518beaede/src/agent_web.c and https://github.com/BenSiv/fossil-scm/blob/e1317fb22093611b5630ec41dd2492b518beaede/tst/agent.test

**Disposition:** useful new source-grounded finding; no prior library file contained the HN item or repository URL.
