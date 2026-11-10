<ai_context>
summary: "The pizza-delivery design models a human reply to an agent assumption, question, or risk as one successor job linked to an immutable parent rather than a mutation or resume of the completed run. This preserves what the earlier agent actually knew and did, but the repository is a design-phase specification with no implementation or tests."
triggers: ["human feedback lineage", "follow-up agent job", "immutable agent run", "agent correction provenance", "pizza-delivery"]
last_updated: "2026-11-10"
source_basis: "Static inspection of EllianCarlos/pizza-delivery README, glossary, repository tree, and complete design specification at commit f37717670382b12d82edf8c0e1296bdc43716599. The repository explicitly reports design-phase status and contains no implementation or tests."
</ai_context>

# Human feedback should fork successor work, not rewrite an agent run

**Date:** 2026-11-10  
**Disposition:** new knowledge  
**Question:** How can an autonomous coding pipeline incorporate later human corrections without obscuring what the original run knew, assumed, and produced?  
**Repo:** https://github.com/EllianCarlos/pizza-delivery  
**Reviewed version:** commit [`f37717670382b12d82edf8c0e1296bdc43716599`](https://github.com/EllianCarlos/pizza-delivery/commit/f37717670382b12d82edf8c0e1296bdc43716599)  
**Coverage:** repository metadata and recursive tree; complete `README.md`; complete `GLOSSARY.md`; and complete `docs/designs/pizza-delivery.md`. The repository is a design specification, not an implemented runtime.

## Source observation

The `pizza-delivery` design proposes a local daemon that sends one prompt through triage, specification, implementation, review, and draft-PR stages. Its distinctive feedback rule is that agents do not pause to interview the human. Instead, they continue under explicit assumptions and record assumptions, unanswered questions, and risks as typed feedback entries.

A human reply targets one or more entries from one parent job and creates exactly one follow-up job. The successor receives the parent job, selected entries, and reply text as context; if the parent produced commits, the successor branches from the parent's tip. The original job is not edited. Its entries are marked as answered by the successor, while dismissal is a separate event that creates no new work.

This proposal sits on an append-only event ledger. Job and stage state are rebuildable projections, artifacts carry hashes, prompts record template versions and rendered-prompt hashes, and code changes are referenced by commit. The design also says confirmed human corrections may enter memory only from replies on follow-up jobs; an agent's own unconfirmed assumption must not be promoted into durable user preference.

## Reusable interpretation

Human correction is better represented as a **causal successor** than as a retroactive edit or an ambiguous resume.

A useful correction record should preserve at least:

1. the immutable parent run and its exact artifact or code revision;
2. the specific assumptions, questions, or risks the person answered;
3. the authenticated reply as a new input, with its own identity and time;
4. the successor work item that consumed that reply; and
5. the resulting artifact or effect, separately from the reply itself.

This structure preserves two truths at once: the earlier agent acted under incomplete information, and later work used a human correction. Rewriting the old run can make the final state look cleaner while destroying evidence needed to audit the original decision, evaluate assumption quality, distinguish correction from retry, or reproduce why a change was made.

The successor model also limits accidental fan-out. “One reply creates exactly one follow-up job” gives the scheduler an idempotency target: repeated delivery of the same reply should resolve to the same successor identity rather than spawning several correction runs. The inspected design states this cardinality but does not specify the transactional uniqueness key or delivery protocol required to enforce it.

This complements [Background agent loops need typed continuation channels](./2026-11-09-agent-autoloop-typed-continuations.md). That finding distinguishes human decisions, retries, deferred observations, derived events, and unknown liveness. `pizza-delivery` adds a narrower provenance rule: when human input changes the work after an autonomous run, preserve the old run and express the change as linked successor work.

## Limits

- The README labels the repository “Status: design phase.” The pinned tree contains documentation and licenses only: no Rust crates, daemon, database schema, API, tests, migration, or running example.
- The append-only ledger, database triggers, transactional projections, follow-up cardinality, branch inheritance, feedback UI, and memory-admission behavior are specified but not implemented or exercised.
- A new job does not by itself guarantee semantic isolation. If the successor can mutate the parent's branch, artifacts, database rows, or external effects in place, the claimed lineage boundary could still be lost.
- “Exactly one follow-up” needs an idempotency and concurrency mechanism binding the reply identity to the created successor. The design does not provide executable evidence for duplicate delivery, concurrent replies, partial database commits, or crash recovery at this boundary.
- The proposal says remote replies would use Cloudflare Access identity, but there is no deployed authentication path or evidence that local replies are attributable to a particular person.
- Continuing autonomously under assumptions can accelerate reversible drafting, but it can also compound a wrong premise before the human responds. The design's draft-PR boundary reduces release risk; it does not establish that intermediate code, local memory, resource use, or repository writes are harmless.
- Repository metadata and a detailed specification are evidence of an intended architecture, not reliability, safety, productivity, adoption, or implementation quality. The discovery Search API response reported `incomplete_results: false` only for the bounded query, not for GitHub as a whole.

## Sources

- **Repo:** https://github.com/EllianCarlos/pizza-delivery
- **Inspected revision:** https://github.com/EllianCarlos/pizza-delivery/commit/f37717670382b12d82edf8c0e1296bdc43716599
- **Primary artifact:** https://github.com/EllianCarlos/pizza-delivery/blob/f37717670382b12d82edf8c0e1296bdc43716599/docs/designs/pizza-delivery.md
- **README:** https://github.com/EllianCarlos/pizza-delivery/blob/f37717670382b12d82edf8c0e1296bdc43716599/README.md
- **Glossary:** https://github.com/EllianCarlos/pizza-delivery/blob/f37717670382b12d82edf8c0e1296bdc43716599/GLOSSARY.md
