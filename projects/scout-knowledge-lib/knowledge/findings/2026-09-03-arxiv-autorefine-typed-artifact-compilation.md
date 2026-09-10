<ai_context>
summary: "AutoRefine compiles contrastive trajectory evidence into the least powerful adequate Rule, Skill, or bounded Subagent, then gates activation with type-specific contracts and paired correction/preservation replay. This is a distinct and useful representation-selection mechanism, but its guarantees are only as complete as the model-generated intervention specification and linked replay cases."
triggers: ["AutoRefine", "typed agent artifacts", "Rule Skill Subagent selection", "trajectory learning", "artifact admission", "preservation replay"]
last_updated: "2026-09-03"
source_basis: "Full text of arXiv:2601.22758v2, pinned official repository AutoRefine/Autorefine@58ebf902f8a1f7f9bdcce3a34856f5a4e6e9bb79, repository/API inspection, and the released deterministic lifecycle example. Benchmark outcomes remain author-reported."
</ai_context>

# AutoRefine: The Lesson's Execution Boundary Is Part of What Must Be Learned

## Why this lead matters

A Xiaohongshu card titled “阿里AutoRefine：自动提取技能远超人工设计” was
initially metadata-only and unresolved. A primary-source search identified
[AutoRefine: Compiling Trajectories into Validated Typed Agent Artifacts](https://arxiv.org/abs/2601.22758),
whose authors list Alibaba Group and Tongji University affiliations.

The card's wording is incomplete. AutoRefine does not merely extract better
skills. Its central idea is that a useful lesson may not be a skill at all. It
may be:

- a **Rule** for one locally observable and externally checkable decision;
- a **Skill** for a reusable multi-step procedure that remains inside the
  parent agent's context and control loop; or
- a bounded **Subagent** for a delegated objective that needs private state,
  scoped tools, an explicit interface, and independent termination.

This makes representation choice part of learning rather than fixing every
trajectory lesson into one textual-memory schema.

## Mechanism

```text
failed + successful trajectories
  -> contrastive, evidence-linked intervention specification
  -> try Rule, then Skill, then bounded Subagent
  -> select the first boundary that closes every declared obligation
  -> stage candidate
  -> execute type-specific contract tests
  -> replay active versus staged repository on correction cases
  -> reject on no improvement or any observed preservation regression
  -> activate versioned artifact or leave repository unchanged
```

The intervention specification names activation conditions, corrective
objective, required observations, state variables, dependent decisions,
completion condition, and correction/preservation evidence spans. Closure is
tested across four dimensions: observation, state, decision, and completion.

The “least boundary” order is runtime-relative, not a claim that Rules are
universally simpler than Skills or Subagents. A Rule cannot retain private
state. A Skill can coordinate a parent-owned procedure but does not own an
independent loop. A Subagent is justified only when the evidence requires its
additional ownership.

## What is genuinely novel

The literature already contains trajectory reflection, executable memories,
skill generation, subagent factories, harness rewriting, and held-out
admission. AutoRefine's distinctive combination is:

1. derive a type-neutral intervention before choosing its representation;
2. define representation by runtime ownership rather than prompt length or
   semantic labels;
3. mechanically require evidence references for each claimed boundary;
4. validate the representation contract separately from behavioral utility;
5. compare active and staged repositories on both correction and preservation
   cases before activation.

This is more than renaming skills. The selected type changes execution,
isolation, termination, testing, and rollback semantics.

It is not fully automatic formal synthesis. A language model proposes the
intervention specification and semantic candidate. Mechanical closure can
detect missing coverage relative to that specification, but it cannot detect a
requirement the analyzer omitted from the specification itself.

## Evidence

### Author-reported outcomes

All methods use the same GPT-5.6-terra backbone in the reported experiments.
The clearest non-saturated result is TravelPlanner:

| Result | Reported value |
|---|---:|
| AutoRefine all-constraint success | 80.56% (145/180) |
| strongest compared baseline | 50.0% |
| without Skills | 60.56% |
| without Subagents | 72.22% |
| without all artifacts | 34.30% |
| without boundary closure | 65.56% |
| without replay gate | 64.45% |
| without preservation cases | 70.00% |

The longitudinal TravelPlanner stream starts at 34.44%, reaches 65% after 20
learning tasks, and reports 89–91% held-out success from task 60 onward with
12–16 artifacts. AgentFactory ends at 14% with 55% signed degradation;
SkillOpt reaches 77% and later falls to 69%. High artifact invocation does not
predict utility: both useful and harmful repositories are frequently used.

Frozen source repositories reportedly improve all 25 SkillFlow source–target
pairs by 1.4–16.0 points, averaging 14.20 points for matched domains and 6.99
across domains. This supports conditional transfer rather than domain-neutral
equivalence.

On SpreadsheetBench, validation-gated heterogeneous updates report 73.57%
versus 67.50% for the SkillOpt control under a shared candidate stream. Offline
construction costs rise from 3.34M to 9.43M tokens. The supplement reports
2.82× optimizer tokens and 3.05× wall time, so the method shifts cost from
online recovery into offline admission rather than making learning universally
cheaper.

### Direct repository evidence

The official repository was inspected at
[`58ebf90`](https://github.com/AutoRefine/Autorefine/tree/58ebf902f8a1f7f9bdcce3a34856f5a4e6e9bb79).
It contains about 7,547 Python lines, no required runtime dependencies, and one
commit at the observed revision. GitHub API showed zero stars, one fork, no
issues, and no declared license metadata, while `pyproject.toml` declares MIT.
Those facts describe a paper artifact, not an established ecosystem.

The released deterministic example passed:

```text
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src \
  python3 examples/run_lifecycle.py

OK: extraction, both gates, revision, and every ablation seam hold
```

Source inspection confirmed that:

- candidate activation is impossible before contract and replay decisions;
- replay executes active and staged bundles on identical case IDs;
- any staged execution error rejects admission;
- correction improvement must be positive;
- any observed correction or preservation regression rejects by default;
- revisions inherit predecessor-linked replay cases; and
- accepted snapshots preserve case bindings and version lineage.

The example deliberately uses stub data, agent, evaluator, and model. The
repository does not ship the benchmark datasets, traces, or complete reported
campaign. It validates lifecycle implementation, not the paper's performance.

## Comparison

| Alternative | What it fixes | Advantage over AutoRefine | AutoRefine advantage |
|---|---|---|---|
| Reflection/ReasoningBank | stores lessons as text or demonstrations | simpler and cheaper | distinguishes execution ownership and tests activation |
| Memento-Skills / Trace2Skill | creates reusable procedures from trajectories | richer skill-specific synthesis | does not force local guards or delegated objectives into Skill form |
| SkillOpt | optimizes one skill or skill package | smaller search surface | heterogeneous artifacts and preservation-aware replay |
| AgentFactory | preserves solutions as executable subagents | direct isolation for delegated programs | refuses delegation when a Rule or parent Skill closes the evidence |
| SkillOps | repairs library schemas and redundancy | broader maintenance lifecycle | behavioral correction/preservation admission is first-class |
| Self-Harness / Meta-Harness | edits heterogeneous harness files | can change broader runtime machinery | narrower typed ownership makes tests and rollback easier |
| LoopX | governs goals, evidence, authority, and settlement across harnesses | cross-worker concurrency and authority correctness | chooses the runtime artifact that should embody one learned intervention |

AutoRefine and LoopX are complementary. AutoRefine decides what artifact a
lesson should become and whether linked cases justify activation. LoopX decides
which actor may propose or settle work and how evidence remains durable across
harnesses. Neither replaces an independent evaluator or a broad regression
program.

## Failure modes and limits

1. **Specification omission:** if the model omits required state or a negative
   boundary case, mechanical closure can approve an artificially narrow type.
2. **Evidence-local overfit:** replay proves only linked correction and
   preservation cases, not the whole task distribution.
3. **Artifact interaction:** artifacts are admitted one at a time; two
   independently safe artifacts can interfere when combined.
4. **Runtime dependence:** a host must actually enforce Rule injection, parent
   Skill execution, Subagent isolation, scoped tools, and termination.
5. **Single-run uncertainty:** reported experiments use paired case-level tests
   and Wilson intervals but do not estimate repeated-run variance.
6. **Benchmark saturation:** ALFWorld is nearly saturated and SkillCraft hits a
   100% ceiling, weakening discrimination.
7. **Construction cost:** validation is valuable only if reuse offsets roughly
   threefold offline cost; the paper does not establish a universal break-even.
8. **Security and privacy:** utility gates do not prevent trajectory leakage,
   malicious capability accumulation, or harmful but effective strategies.

## Value judgment

| Dimension | Score | Reason |
|---|---:|---|
| mechanism novelty | 4/4 | representation is selected by evidence-supported runtime ownership |
| decision value | 4/4 | changes how Scout should encode rules, methods, and delegated research |
| evidence strength | 3/4 | strong ablations and frozen splits; no independent replication or repeat variance |
| operational readiness | 2/4 | substantial reference implementation; one-commit artifact without benchmark campaign |

The idea is unique enough to retain. Its most transferable insight is not the
reported 80.56% score; it is the rule that **the smallest artifact that can own
the evidence-supported observation, state, decisions, and completion should be
preferred, then behaviorally admitted**.

## Scout implications

Scout should not compile every research lesson into another broad knowledge
note or skill. Before writing, classify the required ownership:

- use a local rule for a stable, externally checkable constraint;
- use a reusable method/skill for a parent-owned multi-step research procedure;
- use a durable delegated goal only when it needs private state, independent
  completion, or a separately governed evidence frontier.

Each candidate should cite the inducing failure and neighboring successful
behavior, state what must remain unchanged, and pass a scoped replay or review
before becoming canonical. High-impact activation still requires provenance,
access control, broader regression evidence, and human authority.

## Sources

- [AutoRefine paper, arXiv:2601.22758v2](https://arxiv.org/abs/2601.22758)
- [Official repository at the inspected revision](https://github.com/AutoRefine/Autorefine/tree/58ebf902f8a1f7f9bdcce3a34856f5a4e6e9bb79)
- [Repository metadata API](https://api.github.com/repos/AutoRefine/Autorefine)

## Supervision

- Goal: Produce a lead-complete, evidence-backed Scout Knowledge Library deep investigation of agent self-evolution and autonomy: treat every potentially useful lead from the human's collections, existing Scout material, primary sources, repositories, citations, discussions, and discovered related work as a research thread; trace, challenge, and compare it; assess its novelty, value, credibility, tradeoffs, and limits; and synthesize careful, actionable conclusions without silently dropping leads or trusting claims at face value.
- Goal ID: "g_8c56b7d5-efb2-4ad5-b029-3d4752910e83"
- Worker: "goal-acc95da7db5accd83a5930497b6"
- Codex session: "01a05ce0-0d2b-7ab2-89ec-47b6d4f3bf62"
- Pane: "w1:p6D"
