<ai_context>
summary: "Cycle 425 checks Organizational Memory's aggregate advantage at matched run/scenario resolution. Memory beats RAG in all eight run aggregates, but the deliberately differentiating S01 cost-center case supplies 8 of 13 net wins; the fixed suite supports a consistent average, not broad task generalization."
triggers: ["Cycle 425", "Organizational Memory", "2607.03228", "RAG", "process atoms", "scenario concentration", "matched run comparison"]
last_updated: "2026-09-08"
source_basis: "Exact research source 5b730b02df83974c3bd33f55755d4278c01f49f0; post-reconciliation parent c5f4d3153f066b5abea7346eab5db6fcdeea9c03; arXiv:2607.03228v1 SHA-256 058b6a6d2d53aaff8846641479a8be45dadf1ff59602c80081d42078db3ef189; lukaskirchdorfer/org-memory-paper revision 11617e3191bf6307eea64476fcb1269b5ca3fb78, tree 2ca92ed4b97236f80e48ba177a6642d05e626ba4; scenarios SHA-256 29a5d26caa1b791c8e54705e2d49c771fbeb91930ea81ba22384138820b0ba51; evaluator SHA-256 49e2c08cedbc80672836cc2597dfdf1a4a43e653aa9af49a9e4ff5187cf248d9; newline-delimited eight-metric path/digest manifest SHA-256 be97df9f73649e324e5fabf8eb7e98176f75f04a1f3ff7905a14779cfd01eb0f."
</ai_context>

# Cycle 425: Organizational Memory's gain is consistent but concentrated

## What was wrong and what changes

The canonical finding already reports the correct aggregates: memory scores
35/40 versus RAG's 28/40 with GPT-4.1, and 38/40 versus 32/40 with Sonnet 4.5.
Those totals do not show whether the advantage recurs across runs and tasks or
comes from a small part of the authored fixture.

The released metrics answer that narrower question. Memory wins every run
aggregate, but one deliberately differentiating cost-center scenario supplies
most of the net matched advantage. The result is credible for this fixed suite;
it is not evidence that structured memory broadly improves new tasks.

## Seed and queue boundary

Cycle 425 began from clean exact source
`5b730b02df83974c3bd33f55755d4278c01f49f0` at
`2026-09-08T04:31:01Z`, paused for the Cycle 424 reviewer-ledger
reconciliation, and resumed without another source request at clean exact
parent `c5f4d3153f066b5abea7346eab5db6fcdeea9c03`. Cycle 422's XHS observation
was about 58 minutes old, inside the six-hour cadence, so no XHS request ran. Additions/changes
remain unknown, removals remain `[]`, and all 132 durable seeds remain
unavailable. No account or public source was mutated or requested.

RV-004 lacks protected later-outcome evidence, RV-034 remains external, and
RV-052 remains release-blocking. The retained Organizational Memory result
bundle offered the highest-value accessible matched comparison.

## Matched results

The eight published metric files contain ten fixed scenarios for four runs of
each model. Within every run, RAG and memory use the same scenario identities.

| Model | Run | RAG passes | Memory passes | Memory wins / losses / ties |
| --- | ---: | ---: | ---: | ---: |
| GPT-4.1 | 1 | 7 | 9 | 3 / 1 / 6 |
| GPT-4.1 | 2 | 7 | 9 | 3 / 1 / 6 |
| GPT-4.1 | 3 | 7 | 9 | 3 / 1 / 6 |
| GPT-4.1 | 4 | 7 | 8 | 3 / 2 / 5 |
| Sonnet 4.5 | 1 | 8 | 10 | 2 / 0 / 8 |
| Sonnet 4.5 | 2 | 8 | 10 | 2 / 0 / 8 |
| Sonnet 4.5 | 3 | 8 | 9 | 2 / 1 / 7 |
| Sonnet 4.5 | 4 | 8 | 9 | 2 / 1 / 7 |

Memory therefore beats RAG in all eight run aggregates. At matched-cell level,
it wins 20, loses 7, and ties 53, producing the published net gain of 13.

## Scenario concentration

The fixture declares that its ten scenarios are designed to differentiate the
three conditions. S01 goes further: its note explicitly predicts that memory
will refuse while base and RAG create the PR. That scenario supplies eight
memory wins, no losses, and no ties—8/13 of the net aggregate advantage.

Without S01, the remaining 72 cells contain 12 wins, 7 losses, and 53 ties.
Five run aggregates still favor memory, while three tie. Across scenario
identities, four have positive net effects, four negative, and two zero. The
paper's cost-center explanation is supported on its designed example, but the
released comparison does not show uniformly better task behavior.

These cell counts are repeated observations over the same ten authored
scenarios and two model families. Treating all 80 cells as independent would
overstate inferential strength. The bundle also lacks generation settings,
seeds, the proprietary memory/RAG implementation, extracted atoms, retrieval
traces, and an independently authored held-out suite.

## Decision, uncertainty, and rollback

Confidence is high in source identity, retained cell counts, and the
concentration calculation. It is moderate that structured memory has a
consistent average advantage over the released RAG setup on this fixed suite,
and low that the magnitude transfers to new policies, tasks, organizations, or
governed memory updates.

Decisive next evidence is a preregistered held-out suite with independently
authored policy documents and scenarios, preserved generation settings, and
scenario-level uncertainty. RV-004/RV-034 remain high/open; RV-036/RV-038
remain medium/open; RV-052 remains high/open and release-blocking. No
local-main movement, compaction, or cleanup is authorized.

Rollback is one ordinary revert of the Cycle 425 material commit. It removes
only this qualification and its source-bound regression.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
