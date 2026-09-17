<ai_context>
summary: "Five August 2026 studies converge on treating evolving agent state as a governed release system rather than append-only memory. Skill-level evidence supports quarantine, relationship-aware replay, bundle admission, and source-disjoint scanner evaluation; Harness Continual Learning generalizes the pattern to jointly version prompts, memory, capabilities, and routing. Another study adds evaluator qualification. An OWASP public-review draft independently turns the pattern into a deployable control stack: signed and pinned identity, least-privilege manifests, isolated behavioral testing, runtime enforcement, inventory, and outcome receipts must work together because no install-time verdict establishes safe execution. A September HN launch makes the remaining product boundary concrete: a catalog can provide useful static findings and content hashes while still treating high risk as advisory, allowing confirmation bypass, and making a linked install change immediately when its source is synchronized."
triggers: ["2608.05810", "2608.06153", "2608.19013", "2608.18719", "2608.19901", "skill contamination", "skill admission", "pre-commit gating", "Verifier-as-Gatekeeper", "skill lineage", "Skill Relation Graph", "globalized skill evolution", "self-evolving agents", "harness continual learning", "harness-level forgetting", "guarded harness evolution", "reference-free judge gate", "judge competence", "within-question AUC", "post-hoc rollback", "MaliciousSkillBench", "source-disjoint skill detection", "benign false-positive rate", "OWASP Agentic Skills Top 10", "AST10", "behavior layer", "skill permission manifest", "outcome receipt", "ai-community-skills", "linked skill activation", "advisory risk verdict"]
last_updated: "2026-09-14"
source_basis: "arXiv 2608.05810v1, 2608.06153v1, 2608.19013v1, 2608.18719v1, and 2608.19901v1 metadata, abstracts, and full HTML inspected; quantitative claims are attributed to the papers' experiments. OWASP Agentic Skills Top 10 public-review v1 project page, repository README, AST03, AST05-AST09, and Universal Skill Format inspected via HN item 49393145; OWASP's incident figures remain attributed claims rather than independently revalidated measurements. HN item 49698971 and ai-community-skills README plus pinned revision 73d6383 risk, install, and sync paths inspected; product behavior is bounded to that revision."
</ai_context>

# Admit agent skills before activation, not after contamination

**Date:** 2026-08-08  
**Source:** https://arxiv.org/abs/2608.05810v1  
**Source:** https://arxiv.org/html/2608.05810v1  
**Source:** https://export.arxiv.org/api/query?id_list=2608.05810  
**Source:** https://arxiv.org/abs/2608.06153v1  
**Source:** https://arxiv.org/html/2608.06153v1  
**Source:** https://export.arxiv.org/api/query?id_list=2608.06153  
**Source:** https://arxiv.org/abs/2608.19013v1  
**Source:** https://arxiv.org/html/2608.19013v1  
**Source:** https://export.arxiv.org/api/query?id_list=2608.19013  
**Source:** https://arxiv.org/abs/2608.18719v1  
**Source:** https://arxiv.org/html/2608.18719v1  
**Source:** https://export.arxiv.org/api/query?id_list=2608.18719  
**Source:** https://arxiv.org/abs/2608.19901v1  
**Source:** https://arxiv.org/html/2608.19901v1  
**Source:** https://export.arxiv.org/api/query?id_list=2608.19901  
**Source:** https://news.ycombinator.com/item?id=49393145  
**Source:** https://owasp.org/www-project-agentic-skills-top-10/  
**Repo:** https://github.com/OWASP/www-project-agentic-skills-top-10  
**Source:** https://news.ycombinator.com/item?id=49698971
**Repo:** https://github.com/xm1k3/ai-community-skills
**Tags:** agent-skills, self-evolution, admission-control, verification, provenance, rollback, dependency-graph, replay, harness-continual-learning, regression-anchors, judge-gates, evaluator-qualification, skill-security, runtime-enforcement, security-inventory

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

## Harness-level generalization: version the whole execution state

*Harness Continual Learning* (HCL) extends the same admission problem beyond skills. It treats four mutable components—task interface, experience memory, capability map, and adaptive router—as one jointly versioned harness around a frozen foundation model. A candidate stays isolated until a continual evaluator verifies current-task improvement, output validity, and historical retention under matched model, decoding, tool, environment, and seed conditions. Rejection leaves the deployed harness unchanged.

The key new concept is **harness-level forgetting**: changing retrieval evidence, prompts, a tool procedure, or routing can break a previously correct answer or action trajectory even when model weights never move. HCL checks this with a compact anchor set of earlier cases. A loss budget controls admission: zero rejects a candidate if any currently solved anchor regresses; an infinite budget permits adaptation without a historical gate.

The paper's controlled results show why the gate is not merely conservative release hygiene:

- On ALFWorld with frozen Qwen3.5-9B, stability-oriented HCL reported **61.74%** final average and **2.64** average forgetting; unrestricted HCL reached **62.98%** but forgetting rose to **10.94**.
- In a separate textual-reasoning retention sweep, average forgetting rose from **0.39** at zero tolerated anchor losses to **3.45** with no retention bound. Yet final performance did not rise monotonically: the best average, **63.46%**, occurred with a moderate budget of one loss, versus **60.13%** when unrestricted.
- The paper explicitly reports residual forgetting even with a zero-loss gate because finite anchors do not cover all historical test behavior. “All replay checks passed” is therefore bounded evidence, not proof of behavioral preservation.
- Minecraft uses retained skill tests rather than systematic full-task replay, making its reported completion of a 50-task curriculum evidence for skill-level progression, not comprehensive task-level retention.

This broadens the release unit from an individual skill or relation graph to the **complete interacting harness revision**. Component-by-component checks are useful while searching for a candidate, but deployment should be atomic because memory, instructions, capabilities, and routing can alter one another's runtime meaning.

## Qualify a reference-free judge before letting it gate admission

*Competence, Not Accuracy* examines a tempting extension of this release process: replacing deterministic task verifiers with an LLM judge so that skill optimization can cover tasks without an automatic reward. Its core warning is that a reference-free judge effectively has to re-solve the item it grades. Under the paper's model, the judge's competence must exceed random-answer probability (`c > 1/k`) for above-chance discrimination to be possible, but that threshold is only **necessary**, not sufficient.

The paper also identifies a measurement trap. A marginal ROC-AUC can look useful when a judge merely recognizes question difficulty: easy questions tend to produce both correct answers and high scores. Its proposed shadow probe therefore records judge scores on genuine optimization episodes without giving the judge control, labels those episodes with an available verifier, and compares correct and incorrect candidates **within the same question**. On the primary Sonnet runs, marginal AUC was 0.855 for factual QA but fell to 0.735 after within-question stratification; research mathematics remained at chance (0.489), while GPQA-Diamond had no repeated-question strata and therefore only an optimistic marginal estimate.

A small closed-loop pilot shows why evaluator qualification belongs before candidate admission. The math judge that failed the screen produced a held-out final score of **0.238**, below both the random gate's **0.350** and verifier gate's **0.363**, with a 0.50 false-accept rate. The factual-QA judge that passed had no harmful accepts in three seeds but rejected 44% of improving candidates. This is evidence for a screening step, not proof that a passing judge is safe.

The operational addition is an **evaluator-admission gate** in front of the skill-admission gate:

- shadow-score representative candidate episodes before granting a judge decision authority;
- use same-item positive/negative comparisons where possible, not pooled accuracy or marginal AUC alone;
- measure task-specific self-solve competence, counting timeouts and non-convergent episodes as failures rather than censoring them;
- reject judge control when competence is near the answer-space floor or discrimination is statistically indistinguishable from chance; and
- continue verifier-backed spot audits after deployment because competence can drift and optimization can Goodhart the judge.

The procedure does not eliminate the need for ground truth: its pre-deployment audit still needs verifier-labeled episodes. It instead uses a bounded labeled audit set to decide whether a judge may later govern a broader stream where deterministic verification is unavailable.

## Combined operational implication

The papers together suggest a staged registry protocol:

1. quarantine a concrete candidate revision;
2. validate it on the failure that produced it;
3. compute affected dependency, co-usage, conflict, and derivation edges;
4. consolidate related local updates into a reusable capability;
5. replay cases selected from the affected subgraph;
6. qualify every evaluator that will control admission, including its task-specific competence and discrimination boundary;
7. test the complete proposed harness revision—not only the edited component—on held-out tasks;
8. record the anchor set, loss budget, evaluator configuration, and uncovered retention surface; and
9. atomically activate the version while retaining its graph, evidence, and predecessor.

Admission gating answers **whether a candidate may enter runtime**; evaluator qualification asks **whether the gate has signal to decide**; relationship-aware evolution answers **what else must be reconsidered when the candidate changes**; harness-level evaluation asks **whether the interacting deployed state still preserves prior behavior**. A flat source-to-descendant lineage is therefore necessary but insufficient: rollback and regression selection also need semantic interaction edges, while every clean judge or replay verdict needs an explicit coverage boundary.

## HN update — admission is a stack, not a verdict (2026-08-22)

An HN submission surfaced the **OWASP Agentic Skills Top 10 (AST10)** public-review v1 draft, which treats skills as the behavioral layer between model/tool connectivity and real-world execution. Its taxonomy spans malicious or compromised skills, excessive privilege, unsafe metadata and external instructions, weak isolation, update drift, poor scanning, missing governance, and cross-platform semantic loss. The important contribution is not another list of threats; it is the way those threats defeat any single admission signal.

The draft's controls form a staged stack:

1. establish artifact identity with publisher provenance, content hashes, signatures, dependency pins, and pinned external instruction content;
2. declare minimum authority in a machine-readable permission manifest;
3. compare declarations with observed behavior in an isolated sandbox;
4. enforce permissions and network boundaries at runtime rather than trusting the manifest;
5. inventory the exact installed version, hash, installer, scanner version, and policy decision; and
6. join the authorization record to a distinct terminal outcome receipt.

This sharpens the release-system model above. A signature says **which bytes were admitted**, not what those bytes will cause an agent to do. A scan says **what one analyzer observed under one coverage boundary**, not that later external content, updates, composition, or runtime conditions are safe. A permission manifest says **what authority was requested**, not that the runtime enforced it. An authorization receipt says **an attempt was permitted**, not that it committed successfully. Each record answers a different question and should not be promoted into a universal “trusted skill” badge.

AST05 is particularly useful for admission design: documentation fetched at runtime is executable behavioral input even when the signed skill itself never changes. Such prose needs the equivalent of a lockfile—snapshot or hash it, reject drift, and route changes back through review. AST08 similarly warns that natural-language payloads, truncation, archives, and prompt injection against an LLM scanner make scanning advisory; isolated execution and narrow runtime authority remain necessary after a clean scan.

**Operational delta:** store admission as a tuple—`artifact revision + transitive content set + declared authority + evaluator revision + sandbox evidence + runtime policy`—rather than a boolean attached to a skill name. Re-admit when any tuple element changes, and preserve separate authorization and outcome receipts for each consequential execution.

The source is still an OWASP **Incubator** project in public review, and its Universal Skill Format labels its validation rules as `SHOULD`, not a finalized mandatory standard. Its incident counts and ecosystem percentages are compiled from cited third-party reports and were not independently reproduced in this HN run. The useful signal is therefore the control decomposition and emerging standardization pressure, not certification status or a newly validated prevalence estimate.

## ArXiv update — scanners need source-disjoint admission tests (2026-08-22)

*MaliciousSkillBench* tests a neglected boundary in skill admission: a detector can look strong when train and test examples share source conventions, yet fail on artifacts from unseen ecosystems. The authors normalize 8,414 raw malicious records from 13 public sources into 7,539 unique malicious identities and construct a primary static-text benchmark of **9,740 skills** (7,505 malicious and 2,235 benign). They explicitly separate random, structural-family-disjoint, and source-disjoint protocols.

The strongest sparse text baseline, a word TF-IDF SVM, falls from **0.932 Macro-F1 on the random split to 0.665 source-disjoint**. It still recalls **95.6%** of malicious skills, but incorrectly flags **62.4%** of benign held-out-source skills. The error is operationally asymmetric: 340 benign false positives versus 37 malicious false negatives. Class balancing improves source-disjoint Macro-F1 to 0.710 and benign false-positive rate to 43.3%, while removing seven audited construction-wrapper classes leaves the broader gap intact. These controls establish source sensitivity, not a unique cause; provenance, documentation style, label policy, and source composition remain entangled.

Three off-the-shelf scanners also occupy poor trade-off regimes on the full benchmark. Two keep benign false positives below 1% but detect only **6.4%** and **3.3%** of malicious skills; the more sensitive scanner reaches **56.6% recall** with **45.1% benign false positives**. The comparison covers isolated `SKILL.md` text only, not package code or runtime behavior, so it is not an upper bound on behavioral detection.

**Operational delta:** qualify a skill scanner on held-out publishers, registries, or provenance families before it can control admission. Report malicious recall and benign false-positive rate separately, preserve technical abstentions as a third state, and route novel-source or low-confidence artifacts to sandbox replay and human review. A random-split score should not become a universal “safe to install” badge. This strengthens the staged registry model above: static scanning is one fallible evidence producer inside quarantine, not the gate by itself.

## HN update — a risk report is not an activation gate (2026-09-14)

HN item 49698971 launched **ai-community-skills**, a local catalog that syncs community repositories, indexes more than 3,000 skills, exposes line-level risk findings, and installs selected skills into several agent harnesses. Revision `73d63830e4b8793bbd92ab3742a4c33af65e47ec` makes a useful distinction visible: the tool has meaningful inspection and provenance features, but those features do not constitute admission control.

The static analyzer records scripts, network calls, destructive operations, same-block confirmation language, prompt-injection patterns, secret references, and pipe-to-interpreter patterns. It derives `low`, `medium`, or `high` risk and preserves finding excerpts plus content hashes. The installer then prints that report and warns on `high`, but high risk is not a blocker; `--yes` skips the only installation confirmation. This is not hidden—the README calls the analysis heuristic and warns about false positives and misses—but it means the label is **decision support**, not an enforced policy verdict.

The sharper boundary appears in linked installs. A normal copied install is intentionally held at its recorded content hash until the user reinstalls. With `--link`, however, the active harness path is a symlink into the synchronized source clone. `acs sync` can pull changed upstream content and explicitly reports that the new content is “already active at the install path.” The same command later prints a general statement that installed copies are never updated automatically, which is true for copies but not links. A confirmation at first install therefore does not authorize future linked revisions.

**Operational delta:** catalog, scan, admission, and activation need separate receipts. For each installed skill, record:

1. the exact source and content hash that was inspected;
2. the analyzer revision and bounded findings;
3. the policy decision for that exact hash; and
4. the active target revision after copying or linking.

If synchronization can mutate a linked target, either pin the link to an immutable revision or make every hash change re-enter quarantine before the target is exposed to an agent. A UI warning after activation is drift detection, not pre-activation admission. The project is new (six GitHub stars when checked) and the HN item had no comments, so this is implementation evidence for a product boundary—not evidence of adoption, scanner accuracy, or an observed compromise.

## Evidence limits

*MaliciousSkillBench* is an arXiv v1 assembled from heterogeneous public datasets whose labels and source mixtures differ. Its source-disjoint split measures the selected held-out sources, not a universal future ecosystem, and its scanners use frozen static configurations rather than matched-capacity architectures. Structural families are reuse controls, not attack-mechanism or campaign labels. The benchmark is suitable for comparative static detection research, not malicious-skill prevalence estimates or claims about runtime protection.

The admission study is an arXiv v1 with a small primary split: the paper itself reports overlapping, roughly 30-point-wide 95% Wilson intervals at intermediate rounds. Its assertion that the observed direction-of-trend difference “cannot” occur by chance is stronger than the presented uncertainty analysis establishes. The primary trajectory uses one backbone, one shell-heavy benchmark subset, five rounds, and a specific distillation/injection design. Transfer tests are only 25 tasks per backbone, and InterCode remains shell-adjacent.

GSE is also an arXiv v1. It evaluates two specialized software-quality tasks, one public Java-derived dataset and one private Go dataset, with one evolution model at temperature zero. The private labels and proprietary deployment cannot be independently audited from the paper, and the reported percentage improvements are relative changes from some low baselines. Its ablations remove large subsystems rather than isolating graph-edge quality, replay-set selection, and consolidation independently.

HCL is likewise an arXiv v1. Its baselines were reimplemented inside the authors' harness rather than run from official repositories, task streams are short and fixed-order, and the study identifies efficient retention evaluation, content consolidation, and longer interaction streams as open problems. Anchor preservation is explicitly not a guarantee on unseen historical cases, and the Minecraft setting does not systematically replay completed tasks after every update.

The judge-gate study is also an arXiv v1. Its main probe uses one optimizer, one target model, one primary judge, and three tasks; the cross-provider replication reports confounded marginal rather than within-question AUC because per-episode scores were not retained. The closed-loop pilot averages only three seeds for factual QA and two for mathematics. Most importantly, the paper derives and tests a necessary screen, not a sufficient safety condition: it does not establish robustness under sustained optimization, distribution drift, or Goodhart pressure.

Together, the evidence supports a **mechanism and safety pattern**—qualify the evaluator, gate before activation, model interactions, and replay the affected bundle or harness—rather than a universal pool-size threshold, guaranteed non-regression, or proof that every evolving agent needs these papers' exact architecture.
