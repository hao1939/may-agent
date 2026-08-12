<ai_context>
summary: "Two August 2026 studies converge on treating an evolving skill bank as a governed dependency system rather than append-only memory. A Terminal-Bench 2 study reports that unconditional accumulation peaked at 62% pass@1 with 105 skills and fell to 50% at 179, while pre-commit gates reached 72% with 37 skills. GSE separately models dependency, co-usage, and conflict edges, consolidates related updates, and replays affected historical cases before acceptance; its held-out-project results and ablations support relationship-aware evolution, though both studies remain narrow and do not establish universal thresholds."
triggers: ["2608.05810", "2608.06153", "skill contamination", "skill admission", "pre-commit gating", "Verifier-as-Gatekeeper", "skill lineage", "Skill Relation Graph", "globalized skill evolution", "self-evolving agents", "post-hoc rollback"]
last_updated: "2026-08-08"
source_basis: "arXiv 2608.05810v1 and 2608.06153v1 metadata, abstracts, and full HTML inspected; quantitative claims are attributed to the papers' Terminal-Bench 2 and held-out-project coding-agent experiments."
</ai_context>

# Admit agent skills before activation, not after contamination

**Date:** 2026-08-08  
**Source:** https://arxiv.org/abs/2608.05810v1  
**Source:** https://arxiv.org/html/2608.05810v1  
**Source:** https://export.arxiv.org/api/query?id_list=2608.05810  
**Source:** https://arxiv.org/abs/2608.06153v1  
**Source:** https://arxiv.org/html/2608.06153v1  
**Source:** https://export.arxiv.org/api/query?id_list=2608.06153  
**Tags:** agent-skills, self-evolution, admission-control, verification, provenance, rollback, dependency-graph, replay

## Finding

*When Self-Evolution Backfires* tests a failure mode in agents that distill execution trajectories into reusable natural-language skills and inject the growing pool into later runs. A defective skill can hurt twice: directly when retrieved and indirectly when later skills are distilled with it in context. Deleting the original entry then leaves descendants that inherited its flawed reasoning.

The paper's **Verifier-as-Gatekeeper (VaG)** keeps candidates out of the active, or “Hot,” pool until they pass layered admission checks:

1. schema/structural validation;
2. holdout replay for behavioral harmlessness;
3. semantic review for fabricated or self-contradictory advice; and
4. marginal-gain selection over the surviving bundle, because individually acceptable skills can conflict when activated together.

This separates **candidate generation** from **runtime activation**. It also makes skill lineage operationally important: provenance is needed to identify descendants during rollback, although the experiment suggests lineage-aware cleanup still cannot fully reconstruct an earlier pool state.

## Reported evidence

The controlled experiment used five evolution rounds on a 50-task Terminal-Bench 2 split, three rollouts per task, one primary Hy3 backbone, and the benchmark's deterministic verifier:

- The ungated pool rose from **48% pass@1 / 35 skills** at round 1 to a **62% / 105-skill** peak at round 3, then fell to **50% / 179 skills** at round 5.
- VaG rose from **52% / 5 active skills** to **72% / 37 skills** over the same five rounds. At round 5 it used about one-fifth as many active skills as the ungated pool.
- On the paper's more precise rollback calculation, the ungated decline was **12.3 percentage points**. Removing eight harmful source skills recovered **1.7 points**; an oracle that also removed their full lineage recovered **6.7 points total**, leaving **5.6 points** unrecovered.
- Ablations reduced round-5 pass@1 from 72% to **62% without holdout replay**, **68% without semantic review**, and **64% without bundle-level marginal-gain selection**. The last result is the key interaction signal: admitting every individually cleared survivor expanded the active pool from 37 to 58 skills while lowering performance.
- A frozen gated pool improved Test-25 results by **8–16 points** across five reported backbones. On InterCode NL2Bash it scored **69.0%**, versus **65.5%** for the ungated pool and **57.5%** for the seed.

## Operational implication

A self-updating skill registry should behave more like a package release system than an append-only memory:

- write new skills into quarantine, never directly into runtime context;
- run deterministic structure checks and task-level replay before admission;
- evaluate the proposed active set, not only each skill in isolation;
- preserve parent/derivation links, admission evidence, evaluator versions, and the exact active-set revision;
- activate atomically and retain the previous known-good set; and
- monitor performance against pool growth, especially on long multi-step tasks.

The combination with recent Scout findings is useful: deterministic skill self-tests establish a cheap package boundary, while this paper shows why **activation also needs behavioral and bundle-level evidence**. A skill can be well-formed and pass its own tests yet still damage a particular agent configuration or conflict with another skill.

## Complementary evidence: evolve the relationship graph, not only skill text

*Learning Globally Reusable Skills for Coding Agents* (GSE) independently addresses what happens after candidate generation. It represents the bank as a directed **Skill Relation Graph** with three typed edges:

- **dependency**, when one skill consumes assumptions or outputs from another;
- **co-usage**, when skills work better together or in sequence; and
- **conflict**, when two instructions should not be active together.

A proposed edit is first applied to a temporary bank and replayed on its originating failure. GSE then clusters locally effective proposals, removes case-specific detail, propagates changes to related skills and edges, and replays relevant historical cases before accepting the candidate bank. Existing-skill edits replay cases where those skills were previously activated; new skills replay the cases that generated their proposal cluster. The implementation persists traces and update state in SQLite and versions skill-bank candidates with Git worktrees.

The paper evaluates one-project-held-out transfer on 108 triggerable Java bugs from nine projects and 500 developer-labeled Go bug reports from eight proprietary repositories. With the same DeepSeek-V4-Flash model and harness per comparison, reported F1 was:

- bug-revealing test generation: **0.31 vs 0.22** for the strongest OpenHands baseline, and **0.38 vs 0.29** for the strongest mini-SWE-agent baseline;
- false-positive filtering: **0.70 vs 0.43** on OpenHands, and **0.46 vs 0.39** on mini-SWE-agent;
- an internal bug-triage agent: **0.71 with GSE vs 0.44 with human-written skills**.

The ablations are more useful than the headline relative gains. On OpenHands, removing the relation graph reduced F1 from **0.31 to 0.27** for test generation and **0.70 to 0.59** for filtering. Removing consolidation plus replay-driven generalization produced **0.27** and **0.54**, respectively. This supports two distinct controls: relationship integrity and cross-case replay.

## Combined operational implication

The papers together suggest a staged registry protocol:

1. quarantine a concrete candidate revision;
2. validate it on the failure that produced it;
3. compute affected dependency, co-usage, conflict, and derivation edges;
4. consolidate related local updates into a reusable capability;
5. replay cases selected from the affected subgraph;
6. test the proposed active bundle on held-out tasks; and
7. atomically activate the version while retaining its graph, evidence, and predecessor.

Admission gating answers **whether a candidate may enter runtime**; relationship-aware evolution answers **what else must be reconsidered when it changes**. A flat source-to-descendant lineage is therefore necessary but insufficient: rollback and regression selection also need semantic interaction edges.

## Evidence limits

The admission study is an arXiv v1 with a small primary split: the paper itself reports overlapping, roughly 30-point-wide 95% Wilson intervals at intermediate rounds. Its assertion that the observed direction-of-trend difference “cannot” occur by chance is stronger than the presented uncertainty analysis establishes. The primary trajectory uses one backbone, one shell-heavy benchmark subset, five rounds, and a specific distillation/injection design. Transfer tests are only 25 tasks per backbone, and InterCode remains shell-adjacent.

GSE is also an arXiv v1. It evaluates two specialized software-quality tasks, one public Java-derived dataset and one private Go dataset, with one evolution model at temperature zero. The private labels and proprietary deployment cannot be independently audited from the paper, and the reported percentage improvements are relative changes from some low baselines. Its ablations remove large subsystems rather than isolating graph-edge quality, replay-set selection, and consolidation independently.

Together, the evidence supports a **mechanism and safety pattern**—gate before activation, model interactions, and replay the affected bundle—rather than a universal pool-size threshold, guaranteed irreversibility, or proof that every growing skill library needs GSE's exact graph and pipeline.
