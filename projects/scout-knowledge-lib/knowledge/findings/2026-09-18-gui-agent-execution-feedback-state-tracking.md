---
summary: "A current XHS paper explainer describes CES as a long-horizon GUI-agent architecture that separates high-level coordination, compressed task-state tracking, and frozen low-level execution, then trains the two hard-to-score upstream modules through downstream execution feedback."
triggers: ["CES", "GUI agent", "long-horizon agent", "state tracker", "execution-feedback reinforcement learning", "coordinator executor", "GUI-R1-7B"]
last_updated: "2026-09-18"
source_basis: "Body-level XHS post by 数策智合 (note 6aac0d4c000000002b003670), including its description of the attached CVPR 2026 paper. The paper itself was not independently reviewed in this source-specific run."
---

# Long-horizon GUI agents: explicit task state can make intermediate modules trainable

<ai_context>
Use this finding as a source-grounded architecture signal, not as primary-paper verification. The durable idea is to keep planning, task-state compression, and low-level action execution distinct, and to evaluate otherwise hard-to-score intermediate outputs through their downstream execution effect. All reported benchmark values below are attributed to the XHS explainer and require primary-paper confirmation.
</ai_context>

**Observed:** 2026-09-18  
**Disposition:** New source-grounded finding  
**Coverage:** Full XHS post body. The attached paper was visible by filename, but Scout did not independently read the PDF or reproduce its experiments.

## Source

- **XHS body:** [长程GUI Agent为什么总忘记自己做到哪了？](https://www.xiaohongshu.com/explore/6aac0d4c000000002b003670) — 数策智合, note ID `6aac0d4c000000002b003670`
- **Paper named by the post attachment:** *Training High-Level Schedulers with Execution-Feedback Reinforcement Learning for Long-Horizon GUI...* (displayed as a CVPR 2026 PDF; complete bibliographic identity was not established in this run)

## What the post claims

The post describes **CES**, a three-part architecture:

1. a **Coordinator** produces an atomic high-level instruction;
2. a **State Tracker** compresses a long screenshot/action history into a continuously updated semantic task state; and
3. a frozen **Executor** performs only the current low-level GUI action.

Its motivating diagnosis is that a monolithic agent must plan, remember progress, and execute actions at once, while raw screenshot and action histories do not explicitly represent what has already been completed. CES therefore treats task progress as its own maintained object rather than expecting the next model call to reconstruct it from the full trace.

The post's more reusable training claim is **execution-feedback reinforcement learning**. Coordinator plans and State Tracker summaries are difficult to score directly, so they are reinserted into the execution chain and trained in stages using whether the frozen Executor's eventual action is correct as the verifiable reward. This turns an intermediate-representation problem into an end-effect evaluation problem, while preserving module boundaries.

The XHS author reports that, with GUI-R1-7B as Executor, CES improves average Type accuracy by 10.38% across AITZ, AMEX, and GUI-Odyssey, and reports GUI-Odyssey values of Type 79.24, GR 63.82, and SR 53.69. The post also says ablations removing the Coordinator, State Tracker, or RL reduce performance, and that planning errors and state loss decline more than perception or generalization errors. These numbers and interpretations are secondary-source claims here, not independently confirmed results.

## Interpretation

The architectural signal is stronger than the benchmark headline: **explicit task state creates both an operational boundary and a learning boundary**. A Coordinator can ask what remains, a State Tracker can be judged by whether its compressed state supports the next action, and a frozen Executor makes attribution more legible than joint end-to-end changes.

This yields a practical pattern for long-running agents beyond GUI control:

- maintain a compact, inspectable statement of completed and remaining work;
- issue bounded next-step instructions instead of repeatedly regenerating an entire plan;
- score intermediate planning or memory artifacts by controlled downstream effects when direct labels are ambiguous; and
- keep the executor fixed during diagnosis so improvements are not mistakenly attributed across modules.

The same decomposition also exposes the residual bottleneck: if perception or low-level action selection is weak, better scheduling and state tracking cannot repair it. Modular gains should therefore be reported separately by failure class rather than collapsed into one end score.

## Limitations

- The XHS post is a secondary explainer, not the primary paper or an independent replication.
- The displayed attachment filename identifies the paper title only partially; author list, canonical URL, reviewed version, and exact metric definitions were not established.
- “Average improvement” may mean percentage points or relative percent; the post does not disambiguate it, so this finding preserves the author's wording rather than converting units.
- A frozen Executor helps attribute scheduler/state-tracker changes, but it also caps the system and does not establish that staged training beats a matched jointly trained alternative.
- Plug-and-play behavior across several named executors, as reported by the post, does not by itself prove transfer across unseen applications, visual distributions, or longer real-world tasks.
