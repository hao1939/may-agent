<ai_context>
summary: "A controlled autonomous-ML-engineering study reports that exposing a strong model to files, a shell, and execution produced the largest performance gain, while search policies and tested orchestration layers did not significantly improve a single long-running coding-agent baseline under matched model, hardware, and wall-clock budgets. The result supports treating a minimal coding session as a required baseline before adding harness machinery, not removing control-plane safety or assuming minimal harnesses are cheaper: the study is benchmark-specific, tests only narrow coordination primitives, and its long session had much higher modeled cache-read cost than shorter-thread harnesses."
triggers: ["minimal harness", "autonomous ML engineering", "MLE-bench", "Malena", "harness ablation", "multi-agent orchestration", "2609.40303"]
last_updated: "2026-10-01"
source_basis: "arXiv 2609.40303v1 API metadata plus relevant full-HTML experiment, ablation, statistical-protocol, contamination, and limitation sections inspected 2026-10-01. Results are author-reported; Scout did not inspect code or experiment artifacts, reproduce evaluations, or assess later revisions."
</ai_context>

# A minimal coding session is a necessary harness baseline, not a universal architecture

**Date:** 2026-10-01  
**Disposition:** New source-grounded finding  
**Coverage:** arXiv v1 metadata and relevant full-HTML experiment, ablation, statistical-protocol, contamination, and limitation sections; no code repository was identified in the inspected paper, and experiments were not independently reproduced.

## Source

- **Source:** [How Much of a Harness Does a Strong Agent Need for Autonomous ML Engineering?, arXiv:2609.40303v1](https://arxiv.org/abs/2609.40303v1)
- **Full HTML:** https://arxiv.org/html/2609.40303v1
- **Authors:** Kirill Brilliantov, Alejandro Hernández-Cano, and Emmanuel Abbé
- **Submitted:** 2026-09-30

## Question

When model, hardware, task set, and wall-clock budget are held fixed, do explicit search policies, multiple workers, or production MLE harnesses outperform one long-running coding-agent session with a small tool set?

## What the paper compares

The study builds an intervention ladder in one OpenCode-based implementation and then compares its minimal baseline against released autonomous machine-learning-engineering harnesses. The key stages are:

1. **Chat:** one text-only completion produces a solution, with a retry after execution failure.
2. **Oneshot:** one six-hour coding-agent session can inspect files, run code, and debug.
3. **Search policies:** 24-hour chains of Oneshot sessions use chain, greedy, UCB1, or independent best-of-N selection.
4. **Malena:** one coding-agent session spans the full 24-hour budget and controls its own exploration. Its extra tools register submissions, report resources and remaining time, and manage background jobs.
5. **Orchestration ablations:** delegation, three parallel Malena workers, and peer broadcast are added to the baseline.
6. **External harnesses:** Malena is compared with MLEvolve, AiScientist, Arbor, and ScienceFlow under matched backbone, hardware, and time budgets.

The primary MLE-bench setting assigns one A100 80GB GPU, 12 CPU cores, and 144GB RAM per run. Performance is macro-averaged over a fixed task set; paired-by-task bootstrap confidence intervals are used for intervention comparisons.

## Reported evidence

The largest observed intervention is not an orchestration strategy but the change in primitive: frontier models improve sharply when moved from a chat interface into an environment where they can read files, execute code, and debug. After that transition, the four explicit search policies have largely overlapping confidence intervals, with no statistically significant pairwise advantage in percentile or medal rate.

A single 24-hour Malena session has the highest average medal rate among those search variants. The reported medal-rate advantage over each manually orchestrated strategy is statistically significant, while some percentile comparisons remain statistically indistinguishable. This supports the narrower conclusion that explicit outer-loop search did not beat model-directed exploration in this setting; it does not show that every workflow or memory mechanism is redundant.

The multi-agent ablation is similarly bounded. Base Malena is not significantly worse than delegation, three parallel workers, or parallel workers with broadcast on the 14-task split. Parallel workers increase the oracle-selected ceiling but widen the gap between the best available submission and the workers' self-selected final submission. Broadcast plus parallelism has a notably lower point estimate than the base. These results identify selection and coordination as unresolved costs rather than proving that multi-agent systems cannot help.

Across the paper's tested MLE-bench and NatureBench harness/backbone pairs, Malena reportedly matches or beats each external harness. The exception in the broader pattern is the weaker Gemma 4 31B backbone, where MLEvolve leads by mean percentile and the detailed paired analysis reports a significant percentile regression for Malena, while medal-rate confidence intervals overlap. This backbone dependence matters: hand-designed workflow priors may retain value when the model is less capable at autonomous tool use.

## Cost and systems implications

“Minimal harness” does not mean “minimal cost.” At GLM 5.2, the authors model the single growing Malena session at **$12.12** in inference cost versus **$1.95** for AiScientist—about **6.2×**—largely because every turn resends an expanding context and accumulates cache-read charges. The authors note that A100 cost still dominates their overall setup, but an API-hosted or context-heavy deployment could see a different cost balance.

The reusable engineering implication is therefore an evaluation rule, not an architectural mandate:

- establish a strong single-session, direct-tool-use baseline before attributing gains to planners, search trees, retrieval workers, or agent teams;
- compare at the same model, resources, wall-clock budget, task set, and selection policy;
- report both self-selected and oracle-best outcomes so parallelism does not hide a selection failure;
- include cache reads, context growth, coordination, and failed runs in lifecycle cost; and
- retain orchestration only where it demonstrates a task-relevant gain or supplies a separately required operational property.

That last distinction is essential. This paper measures benchmark performance, not authorization, effect settlement, isolation, durable recovery, auditability, or governance. A control plane can remain necessary even when it does not raise leaderboard scores. Likewise, a minimal coding loop with shell access can reduce hidden performance machinery while increasing the importance of external capability boundaries.

## Limits

- Results are author-reported from arXiv v1 and were not independently reproduced by Scout.
- Most evidence comes from 30 public Kaggle-derived MLE-bench tasks. The authors fixed known preparation problems and ran two contamination checks, but public-task pretraining contamination cannot be ruled out.
- NatureBench adds 40 newer scientific tasks, but covers fewer models and methods.
- Full 24-hour experiments use only 3–4 seeds per task; some confidence intervals are too wide for strong effect-size claims.
- The coordination study covers only delegation, three-way parallelism, and broadcast on a 14-task split. It does not evaluate richer protocols, heterogeneous specialists, durable handoffs, or externally constrained workflows.
- External harness comparisons may have asymmetric tuning effort. The authors report compatibility fixes and targeted configuration ablations, but Malena remains their own system.
- One long session can overflow context and incurs high cache-read cost; benchmark quality alone does not establish operational efficiency.
- The inspected paper did not provide a dedicated implementation repository link. Code, run traces, benchmark patches, prompts, raw results, and later revisions were not inspected.
- Security, authorization, sandboxing, external side effects, and governance invariants are outside the evaluation.

## Related library context

[Pi: Minimal Harness, Externalized Stack](2026-08-05-hn-pi-minimal-harness-extension-stack.md) describes practitioner evidence that a small coding-agent core can improve context discipline while externalizing safety and sandboxing. The arXiv study adds a controlled performance comparison: direct tool access and a strong backbone can dominate extra MLE scaffolding, but neither source supports deleting the external control boundary.