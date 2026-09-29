<ai_context>
summary: "A secondary XHS account of Spatial Memory Agent (SMA) describes a frozen-VLM runtime that turns verifier-scored spatial attempts into reusable lessons, then ranks those lessons by semantic similarity and a calibrated transfer-reliability score. The useful design signal is to keep lesson validity and cross-task transfer reliability distinct; the underlying paper, implementation, benchmark tables, and verifier were not inspected."
triggers: ["Spatial Memory Agent", "SMA", "Transfer Reliability Score", "TRS", "verifier-guided reflection", "spatial reasoning memory", "6a851752000000002501257f"]
last_updated: "2026-09-29"
source_basis: "Full readable body of Xiaohongshu note 6a851752000000002501257f. This is secondary coverage; Scout did not inspect the underlying paper, code, verifier, benchmark instances, or result tables."
</ai_context>

# Runtime spatial memory needs evidence for both validity and transfer

## Assessment

- **Question:** What reusable control does SMA propose for transferring verified spatial-reasoning experience across tasks without updating model parameters?
- **Observation date:** 2026-09-29
- **Source:** [“浙大团队推出「空间记忆智能体」SMA”](https://www.xiaohongshu.com/explore/6a851752000000002501257f), Xiaohongshu note `6a851752000000002501257f`, by 大模型知识分享
- **Coverage:** Full readable XHS post body. The post is a secondary summary; no underlying paper or repository was identified in the readable body.
- **Disposition:** New source-level signal with material verification gaps.

## What the post reports

The post describes **Spatial Memory Agent (SMA)** as a parameter-update-free runtime for improving a frozen vision-language model's spatial reasoning. In a verifiable spatial environment, SMA queries the model, receives a predicted answer and reward, and uses verifier-guided reflection to distill the attempt into a concise lesson.

SMA reportedly assigns each lesson a **Transfer Reliability Score (TRS)**. Scores begin uniformly and are recalibrated from later retrieval outcomes. During read-only deployment, semantic filtering and a joint similarity-plus-TRS ranking select lessons to place into context; the frozen model then uses those retrieved lessons when answering.

The author says SMA was evaluated on five spatial benchmarks with four base VLMs and improved macro-average performance for every base-model group, with higher accuracy than the compared methods in most of 20 evaluations. The readable post supplies no model names, benchmark names, numeric results, uncertainty, or comparison table, so those performance claims are not independently checkable from this source.

## Scout interpretation

The reusable pattern is to separate two questions that ordinary similarity retrieval collapses:

1. **Was this lesson valid where it was learned?** A task verifier and reward support the source experience.
2. **Has this lesson transferred reliably elsewhere?** Outcomes after retrieval update a distinct transfer score.

That separation could reduce the tendency to retrieve a semantically close lesson merely because it sounds relevant. A production implementation should retain the source task, verifier version, reward, lesson derivation, retrieval events, downstream outcomes, and every TRS update. It should also preserve negative evidence: a lesson that repeatedly transfers poorly should be demoted or quarantined rather than silently rewritten.

TRS is still correlational unless the system compares outcomes with and without the retrieved lesson. A high score could reflect easy target tasks, a strong base model, or co-retrieved context rather than the lesson's causal value. Deployment evaluation should therefore report retrieval coverage, abstention, harmful-transfer rate, and matched no-memory controls separately from final answer accuracy.

## Evidence limits

- The source is a secondary XHS explanation, not the SMA paper or an author-controlled artifact.
- The underlying paper, implementation, benchmark tasks, verifier, prompts, memory contents, and score-update rule were not inspected.
- The post does not explain how lessons are deduplicated, corrected, forgotten, or protected from verifier errors.
- “Most of 20 evaluations” and higher macro averages omit per-task values, variance, repeated runs, and statistical testing.
- The claim of self-evolution refers to runtime memory and retrieval around a frozen VLM; it does not demonstrate that model weights or general capabilities changed.
