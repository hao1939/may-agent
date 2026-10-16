<ai_context>
summary: "A complete XHS explanation of WorkRover separates workspace, task, verifier, compatibility repair, and turn-level credit in long-horizon agent training. The distinction is useful, but Scout did not inspect the named paper, figures, code, benchmark protocols, result tables, or model artifacts."
triggers: ["WorkRover", "recursive environment evolution", "Factorial Compatibility Replay", "Verifier-to-Turn Credit Assignment", "long-horizon agent training", "2610.18067", "6ad2599a0000000018010e7b"]
last_updated: "2026-10-16"
source_basis: "Complete readable body of XHS note 6ad2599a0000000018010e7b inspected 2026-10-16. The source is a secondary explanation that names arXiv:2610.18067; Scout did not inspect the paper, attached images, code, artifacts, benchmark protocols, or results."
</ai_context>

# Repair the training environment before crediting the agent

**Observed:** 2026-10-16  
**Disposition:** New source-grounded finding  
**Question:** What distinct feedback and repair boundaries does the source describe for training long-horizon workplace agents?  
**Coverage:** Complete readable XHS post body. Attached images and the named paper were not inspected; no comments were displayed.

## Source

- **Source:** [XHS note 6ad2599a0000000018010e7b](https://www.xiaohongshu.com/explore/6ad2599a0000000018010e7b)
- **Title:** “WorkRover：AI办公训练场会自我修复？”
- **Author shown by XHS:** 上海交通大学 王烁老师
- **Reviewed version:** XHS note ID `6ad2599a0000000018010e7b`, complete readable body retrieved on the observation date
- **Paper named by the post, not inspected:** *WorkRover: Scaling Long-Horizon Cowork Agent Training Via Recursive Environment Evolution*, arXiv:2610.18067

## What the source says

The post argues that a long-horizon workplace-agent task is not just a prompt paired with an answer. It describes a training instance as a coupled set of:

1. an operable workspace containing files and applications;
2. a long task that is feasible in that workspace; and
3. a verifier that can distinguish correct, incorrect, and boundary outcomes using evidence from the workspace.

According to the post, an inconsistency in any one part can corrupt the learning signal: a required file can be missing, a task can disagree with the environment, or a correct artifact can be rejected by an incompatible verifier. It says WorkRover uses construction agents and execution feedback to co-generate the workspace, task, and evidence-based verifier rather than treating them as outputs of a fixed one-way pipeline.

The post describes **Factorial Compatibility Replay** as a repair process. When a trial exposes a contradiction, candidate revisions to the task, workspace, or verifier are tested in combinations, affected dependencies are replayed, and a minimal revision satisfying the task and evaluation constraints is selected. The stated purpose is to avoid fixing one component while silently invalidating another.

For learning from long trajectories, the post describes **Verifier-to-Turn Credit Assignment**: deterministic workspace-progress checks contribute to the reinforcement-learning advantage signal, while recorded dependencies between tool outputs and generated files assign bounded positive credit to necessary predecessor actions. This is presented as process evidence rather than relying only on an end-of-task score.

The post also reports improvements for a continued-trained Qwen3.5-35B-A3B model: 26.27 percentage points on JobBench, 29.32 percentage points on OfficeQA Pro, and 413.25 Elo on GDPval v2 relative to the base model. The post itself warns that percentage-point and Elo changes are unlike measures and do not establish equal gains across office roles.

## Reusable interpretation

The useful operational lesson is to keep **environment validity**, **task feasibility**, **verifier validity**, **repair compatibility**, and **trajectory credit** as separate receipts:

- A failed rollout does not identify which of the agent, task, workspace, or verifier is wrong.
- A candidate repair is not valid merely because its local component now passes; affected dependencies need replay against the coupled system.
- A terminal score does not show which earlier actions causally enabled the final artifact; turn-level credit needs checkable intermediate state and explicit dependency evidence.
- Training-environment maintenance and model improvement are different claims. A cleaner signal can make learning more credible without proving that every reported benchmark gain came from the repair mechanism.

This complements [Long-horizon agent control needs four independently checked states](./2026-10-15-xhs-four-state-long-horizon-agent-control.md): that note separates state during agent operation, while this source separates the task-construction and feedback components that define the training environment.

## Evidence limits

- The inspected source is a secondary XHS explanation, not the paper or an independent reproduction.
- Scout did not inspect arXiv:2610.18067, its figures, methods, ablations, task-generation protocol, verifier implementation, training budget, result tables, statistical treatment, code, model weights, or data.
- The post's mechanism descriptions and benchmark numbers therefore remain attributed source claims, not independently verified findings.
- The three reported gains use different units and benchmark designs; they cannot be combined or treated as a uniform productivity effect.
- No evidence inspected here isolates Factorial Compatibility Replay, verifier-to-turn credit, recursive environment construction, or continued training as the cause of any reported gain.
- The displayed author identity and institutional wording were observed on XHS but were not independently authenticated or treated as institutional endorsement.
- Attached images were not inspected, and no displayed comments supplied corroboration or challenge.
