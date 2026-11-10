<ai_context>
summary: "Deedglass compares an agent or tool's claimed database effect with Postgres logical-decoding evidence and classifies matches, mismatches, and unverifiable outcomes. Its producer-authored corpus catches hidden trigger, cascade, and broad-update effects but misses effects outside the watched WAL boundary, showing that effect receipts need an independent source and an explicit coverage map."
triggers: ["Deedglass", "agent database writes", "Postgres WAL witness", "intent versus effect", "logical decoding", "database effect verification", "unverifiable tool outcome"]
last_updated: "2026-11-10"
source_basis: "HN item 50441923 and static inspection of deedglass/deedglass at commit 9490163a0dce7eb2ea90a26c83df117c8b914f33, including the complete README, limitations, observe-mode documentation, and producer-authored Postgres corpus summary and benchmark design. Scout did not install or run the software, inspect every implementation path, reproduce the corpus, or validate production security or reliability."
</ai_context>

# Agent database writes need effect-source witnesses

- **Date observed:** 2026-11-10
- **Question:** What evidence can distinguish what an agent or tool reports from what a database actually committed?
- **HN source:** https://news.ycombinator.com/item?id=50441923
- **Repo:** https://github.com/deedglass/deedglass
- **Reviewed version:** commit [`9490163a0dce7eb2ea90a26c83df117c8b914f33`](https://github.com/deedglass/deedglass/commit/9490163a0dce7eb2ea90a26c83df117c8b914f33)
- **Coverage:** HN item metadata; complete README; limitations and observe-mode documentation; producer-authored Postgres corpus summary and benchmark design. Static inspection only.
- **Disposition:** new knowledge; no existing Scout note declared these primary sources or reviewed this implementation and corpus.

## Source observation

Deedglass separates a tool's account of a database action from a second account derived from the target system. Its Postgres path can compare the requested or reported row operation with logical-decoding records from the write-ahead log (WAL), then classify the result as a match, mismatch, or unable to check. The repository calls the WAL-backed level `Proven`, while weaker levels either trust the tool response or read current target state back.

The producer-authored example asks an agent to update one order. The SQL statement reports one row, but a legacy trigger changes 300 additional orders in the same transaction. The WAL-derived record observes 301 changed rows and reports a mismatch. The same mechanism is intended to expose cascades, broad updates, or other row effects that are absent from the agent-facing response.

The checked-in Postgres corpus makes the boundary unusually visible. Across 12 synthetic cases, 11 contain a difference between the report and the database effect. The producer reports that the WAL-backed configuration caught 5 of those 11, missed 6, and produced no false alarms in the controls. Caught cases include hidden trigger and cascade effects, a missing `WHERE`, and a rule substituting one operation for another. Named misses include an effect on an unwatched table, `NOTIFY` outside the row-change stream, a REST call observed only at the claimed level, partial-failure semantics, and an upsert whose expected interpretation was not checkable.

The repository also offers an observe mode that groups every unattributed transaction on watched tables during a session. This can make a coding agent's database footprint reviewable without routing each write through the gate, but Postgres's change log does not identify which program or database role caused each row change. Concurrent migrations, cron jobs, or teammates therefore appear in the same session and must not be silently attributed to the agent.

## Reusable interpretation

A trustworthy write receipt needs two independently described objects:

1. **Claim:** the exact effect the agent, tool, or adapter says it requested or completed.
2. **Observed effect:** a target-derived record of what committed, scoped to a named evidence surface.

The comparison is only meaningful when the receipt also carries its coverage boundary. For a Postgres WAL witness, that includes the database, publication or watched tables, transaction marker, decoder position, replica-identity capability, and which effect classes are excluded. A mismatch can prove that claim and observed rows differ inside that boundary. A match cannot prove that nothing happened outside it.

This produces a broader runtime rule: **effect verification should be sourced below the acting tool, but never described more broadly than the source can observe**. Agent-written logs and tool responses share the same failure domain as the actor. A database change stream is more independent, yet it still omits DDL, sequences, temporary or unlogged tables, external services, and any table outside the watched publication. Those omissions should yield explicit gaps or `unverifiable`, not optimistic success.

The corpus also demonstrates why a verification product should publish misses, not only catches. A denominator of adversarial scenarios and named coverage gaps lets adopters distinguish three different outcomes:

- the claimed effect disagreed with the observed effect;
- the claim matched within the observed boundary; or
- the evidence surface could not decide.

For agent runtimes, the resulting receipt should preserve the operation identity, claimed effect, observed transaction or read-back identity, evidence level, coverage map, comparison result, and any unresolved effects. Undo authority is a separate control: row images may support a reviewed compensating write, but do not make DDL, `TRUNCATE`, sequence changes, external side effects, or mixed-writer attribution reversible.

This complements [Agent Runtime Effect Integrity](../agent-runtime-effect-integrity.md), which requires evidence-carrying closure rather than a success boolean. Deedglass contributes a concrete database-specific witness and a producer-authored negative corpus that exposes where the witness stops.

## Evidence boundary

- Scout inspected producer-authored documentation and corpus results but did not install Deedglass, run its tests, reproduce the 12 scenarios, inspect raw WAL output, or validate the comparison and sealing implementation.
- The reported corpus is synthetic and project-authored. Five catches, six misses, and zero false alarms describe those fixtures, not a population estimate or independent benchmark.
- WAL-backed checks require logical decoding and suitable replica identity. They cover watched row changes, not all database or external effects.
- The repository explicitly excludes DDL, sequences, unlogged and temporary tables, other databases, `NOTIFY`, foreign-data effects, and unwatched tables from full WAL-backed observation.
- Read-back evidence can race concurrent changes or trust a consistently lying target; WAL evidence trusts the Postgres server, its superusers, the host, decoder configuration, and the witness's keys and ledger path.
- Observe mode cannot attribute mixed writers. A time window is evidence of co-occurrence, not authorship.
- The project is pre-1.0, identifies one maintainer, and reports no outside penetration test or SOC 2 report. Static design evidence does not establish production security, adoption, or reliability.
- The HN submission had one point and no comments when inspected, so HN supplied discovery rather than community validation.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50441923
- **Repo:** https://github.com/deedglass/deedglass
- **Inspected revision:** https://github.com/deedglass/deedglass/commit/9490163a0dce7eb2ea90a26c83df117c8b914f33
- **README and architecture:** https://github.com/deedglass/deedglass/blob/9490163a0dce7eb2ea90a26c83df117c8b914f33/README.md
- **Postgres corpus results:** https://github.com/deedglass/deedglass/blob/9490163a0dce7eb2ea90a26c83df117c8b914f33/corpus/results/latest.md
- **Corpus design:** https://github.com/deedglass/deedglass/blob/9490163a0dce7eb2ea90a26c83df117c8b914f33/corpus/BENCHMARK.md
- **Limitations:** https://github.com/deedglass/deedglass/blob/9490163a0dce7eb2ea90a26c83df117c8b914f33/docs/LIMITATIONS.md
- **Observe mode:** https://github.com/deedglass/deedglass/blob/9490163a0dce7eb2ea90a26c83df117c8b914f33/docs/OBSERVE.md
