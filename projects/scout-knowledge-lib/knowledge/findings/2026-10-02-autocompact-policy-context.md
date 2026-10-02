<ai_context>
summary: "AutoCompact treats context compaction as a learned three-part policy—when to compact, what working state to retain, and how to continue afterward—rather than a token-limit callback. On two coding benchmarks, its authors report gains over the same base model even when 256K context never overflowed, but the evidence comes from one model/scaffold and judge-corrected training; omission checks were largely keyword-based. The practical evaluation unit is therefore the complete pre-compaction decision, retained state, and post-compaction continuation, not summary quality alone."
triggers: ["AutoCompact", "proactive context compaction", "coding agent context", "post-compaction continuation", "learned compaction policy", "SWE-bench context management"]
last_updated: "2026-10-02"
source_basis: "Complete arXiv HTML paper v1 and feed abstract/metadata for arXiv:2610.02163. Scout did not run the model, reproduce the benchmarks, inspect an implementation artifact, or independently validate the authors' results."
</ai_context>

# Proactive Compaction Is a Policy and Continuation Problem

**Date:** 2026-10-02  
**Source:** https://arxiv.org/abs/2610.02163v1  
**Primary text:** https://arxiv.org/html/2610.02163v1  
**Version reviewed:** arXiv v1, submitted 2026-10-01  
**Coverage:** complete HTML paper plus arXiv feed abstract and metadata

## Signal

*AutoCompact: Learning When to Compact Context in Long-Horizon Coding Agents* argues that coding-agent compaction has three coupled decisions:

1. **when** a task stage is resolved enough to replace its detailed history;
2. **what** conclusions, code/workspace state, and remaining actions the replacement state must carry; and
3. **how** the agent should act immediately afterward without repeating finished exploration or ignoring the recorded next step.

This is more precise than treating compaction as a callback near token overflow. AutoCompact adds a model-invoked `compact()` action. It retains the original task, replaces earlier interaction history with a generated working-state summary, and resumes from that state. A stage boundary—after localizing a bug and before editing, for example—is the intended trigger, not a fixed remaining-token threshold.

The authors report that prompting alone rarely induced the Qwen3-Coder-30B-A3B-Instruct base model to compact proactively. Their training pipeline instead collected 1,052 on-policy SWE-rebench trajectories while GPT-5.5-Codex judged and, before environment execution, corrected three output types: compaction timing, the working-state summary, and the first actions after compaction. Supervised fine-tuning on those corrected trajectories was followed by outcome-based reinforcement learning on SWE-Gym. The RL used binary final task success, without a separate compaction reward; all trajectory segments created by context rewrites shared the task outcome advantage.

## Reported evidence

With the same base model and scaffold, the paper reports these uncapped pass rates averaged over three runs:

| Method | SWE-bench Verified | SWE-PolyBench Verified |
|---|---:|---:|
| Base, full history | 30.4% | 19.5% |
| AutoCompact-SFT | 32.2% | 21.7% |
| AutoCompact, SFT then RL | 39.6% | 24.5% |

The final system therefore improved over Base by 9.2 and 5.0 absolute percentage points, respectively. More importantly for the architectural claim, the proactive variants were evaluated with a 256K context window in which no trajectory reached forced compaction. Their gains therefore cannot be explained only as recovery from overflow. The authors' interpretation is that stale hypotheses, failed attempts, and verbose tool output can distract the policy even while all of them still fit.

A separate 16K condition gave Base and AutoCompact the same length-triggered fallback; AutoCompact still led across the tested per-task budgets. The authors also skipped `compact()` calls while holding the trained checkpoint fixed. Following summaries beat ignoring them, with the reported advantage largest at the $0.10 budget (19.9%) and still positive at $4.00 (1.9%). This is useful evidence that some gain came from executing compaction rather than training producing a generally stronger coder.

After RL, proactive invocation rose from 44.3% to 58.5% of SWE-bench Verified tasks. Reported key-state omissions fell from 3.1% to 0.2%, and missing-next-action flags from 8.2% to 2.2%. These content statistics are weaker evidence than the task outcomes: they came from keyword screening across 500 tasks supplemented by random manual spot checks, not exhaustive semantic recall review.

## Interpretation for agent runtimes

The reusable design point is that a compact artifact and its consumer should be trained or evaluated together. A well-written summary can still fail if the successor repeats an old search, acts on a superseded hypothesis, or does not execute the stated next step. Conversely, testing only eventual task success can hide dangerous omission classes behind aggregate performance.

A runtime evaluation should therefore retain three linked receipts:

- the pre-compaction history and evidence that made this a safe stage boundary;
- the exact retained working state, scored for explicit obligations, workspace facts, validation evidence, unresolved uncertainty, and next actions; and
- the first post-compaction actions, scored for consistency with that state and for avoidance of already-completed work.

This complements [Session Compaction Needs Separate Selection, Assembly, Privacy, and Recall Claims](./2026-09-30-session-compaction-selection-privacy-boundaries.md), which separates handoff assembly from selection and privacy, and [Agent Steering Needs Compaction Safe Points](./2026-08-28-agent-steering-needs-compaction-safe-points.md), which covers control-plane ordering around an in-flight checkpoint. AutoCompact adds evidence that **continuation behavior itself** is a distinct optimization and test target.

For systems that cannot fine-tune their executor, the paper does not show that a prompt or heuristic can reproduce the result. A lower-cost investigation would first label natural task-stage boundaries and replay successors from compacted versus full histories, with obligation-recall and action-consistency checks, before adding proactive compaction to a production runtime.

## Limits

This is an author-reported arXiv v1 study, not an independent reproduction. It uses one base model and one scaffold; the paper itself describes AutoCompact as model–harness co-design. The online training labels came from a stronger judge model, so the result does not isolate whether equally useful corrections can be produced cheaply or locally. RL used 32K-token sequences although evaluation included a 256K context window. The benchmarks cover repository-level coding, not long-running operational tasks with permissions, external side effects, live human steering, or hard safety rules.

The paper reports aggregate task outcomes and limited summary diagnostics, but not exhaustive recall for late constraints, negative tool results, exact identifiers, safety obligations, or provenance of retained claims. No implementation or pinned model artifact was identified in the reviewed paper text, and Scout did not reproduce any run. These results support investigating proactive, stage-aware compaction; they do not justify replacing deterministic retention lanes or post-compaction safety checks.
