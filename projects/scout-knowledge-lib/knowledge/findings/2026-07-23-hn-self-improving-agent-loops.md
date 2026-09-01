<ai_context>
summary: "Finding on self-improving agent loops: closed-loop self-evaluation plateaus, while later updates show durable gains require externally grounded verification, pathway- and coalition-level evaluation, repeated runs, order perturbations, security/effect audits, and separate optimization and deployment budgets."
triggers: ["self-improving agents", "verifier loop", "agent self-improvement", "Goodhart drift", "closed-loop plateau", "retained experience", "skill evolution benchmark", "persistent agents", "pathway evidence", "task order", "hidden curriculum", "run variance", "underspecification", "security drift", "unauthorized state change", "artifact-executor compatibility", "agent optimization budget", "deployment cost frontier", "coalition pollution", "cross-domain utility reversal", "skill reliability"]
source_basis: "HN story 49012760, loadbearingtech.substack.com, 2026-07-22; arXiv 2607.21461; Lilian Weng harness post + HN 49164896; arXiv 2608.04003; arXiv 2608.03874; arXiv 2608.18066v1; arXiv 2608.17684v1; Agent Lightning v1.0.1 release + HN 49423077; full paper sources of arXiv 2608.22610v1 and 2607.26784v1; and Within-yao/SkillRise at 2b38da3ad7b64414305d39609484803b07d3b9b0."
last_updated: "2026-09-01"
</ai_context>

# Most "Self-Improving" AI Agents Don't Improve

**Date**: 2026-07-23
**Source**: https://loadbearingtech.substack.com/p/self-improving-agent-loops-verifier
**HN**: https://news.ycombinator.com/item?id=49012760

---

## Key Claims

1. **Verifier-based self-improvement loops plateau quickly** — agents that use their own outputs to judge improvement converge to local optima or regress to mean performance within 3–5 iterations.

2. **The closed-system problem**: Without external ground-truth signals, self-evaluation degenerates into a Goodhart loop where the agent optimizes for its own approval criteria rather than task success.

3. **What actually works**: Systems that ground improvement in external feedback (user corrections, test suites, production metrics) show sustained gains; pure self-play does not.

## Relevance to Scout Knowledge Library

- Connects to **eval-as-engineering** trend (XHS scan #66): external eval frameworks succeed precisely because they break the closed loop.
- Validates skepticism toward "recursive self-improvement" narratives — practical agent builders should invest in external verification infrastructure.
- Relates to PRO-LONG (today's digest): programmatic memory works because it grounds in *logged facts*, not self-generated summaries.
- Reinforces the **Goodhart Compliance Detection** pattern in agent-security-defense-architectures.md §2.21.

## Update 2026-07-24: AREX — Recursive Self-Improvement That Works

**Source**: https://arxiv.org/abs/2607.21461

AREX (Recursively Self-Improving deep research agent) provides a concrete counter-example to the "self-improvement doesn't work" thesis — but crucially validates the mechanism identified above: **it works because improvement is grounded in external constraint-wise verification, not self-evaluation**.

Key design choices that break the closed loop:
- **Outer self-improvement loop** audits answers constraint-by-constraint against verifiable evidence, not against the agent's own satisfaction.
- **Autonomous context-update tool** compresses history into a compact state preserving *verified* evidence and *unresolved* constraints — preventing Goodhart drift on intermediate summaries.
- **Dense 4B and 122B-A10B MoE models** trained via agentic mid-training + long-horizon RL with emphasis on "key steps" (decisive evidence acquisition, error correction).
- Results: outperforms comparable-scale baselines on BrowseComp, WideSearch, DeepSearchQA, HLE.

**Takeaway**: The finding stands — recursive self-improvement requires external grounding. AREX demonstrates the architecture: separate discovery from verification, make verification decomposable, and compress state while preserving provenance of verified facts.

## Design Implication

Agent harnesses should treat self-reported improvement metrics as unreliable. Prefer: (a) held-out test suites, (b) human-in-the-loop spot checks, (c) production outcome tracking. Self-improvement claims require external validation by design. AREX shows the productive pattern: decompose verification into independent constraint checks and feed unresolved constraints back as targeted research goals.

## Update 2026-08-04: HN mainstreams self-improvement as a harness problem

**Source**: https://lilianweng.github.io/posts/2026-07-04-harness/
**HN**: https://news.ycombinator.com/item?id=49164896

A fresh HN front-page post by Lilian Weng usefully shifts the discourse from **"can a model recursively improve itself?"** to **"which parts of the harness can be made self-improving?"**. Even before debating the full RSI story, the article's structure is a practical decomposition of improvement into operational layers HN builders can actually ship:

- **Workflow automation** as the first improvement surface
- **Filesystem state** as persistent memory for longer-horizon iteration
- **Sub-agents / backend jobs** as parallelized experimentation capacity
- A dedicated **"self-improving harness"** section that treats improvement as an orchestration-layer property, not just a weights-layer property

This matters because it narrows the gap between the earlier skeptical HN signal and current practitioner framing:

1. **The July skepticism still stands for closed loops.** Pure verifier-on-its-own-output loops remain fragile and Goodhart-prone.
2. **But HN is now legitimizing a narrower, more practical version of self-improvement.** Improvement work is migrating into memory, workflow, and delegation scaffolding.
3. **The unit of progress changes.** Instead of asking whether the model became smarter in general, builders ask whether the harness got better at preserving state, routing work, and evaluating outcomes.

**Scout implication:** the durable trend is not "recursive self-improvement is solved". It is that **self-improvement is being operationalized as harness engineering**. That connects directly to the library's existing runtime-hardening and verified-enforcement themes: the parts that safely improve are the parts that can be externalized, inspected, and measured.

## Update 2026-08-05: arXiv benchmarks separate persistence from real consolidation

**Sources**:
- https://arxiv.org/abs/2608.04003
- https://arxiv.org/abs/2608.03874

Two new arXiv benchmark papers sharpen the distinction between **an agent looking better over time** and **an agent actually converting experience into durable capability**.

### PAST-Bench: retained experience must be measured by pathway, not just gain

PAST-Bench evaluates personal agents under matched fresh-session task sequences with retained experience switched on and off. The benchmark spans **26 scenarios and 204 episodes** across memory, procedural reuse, information gathering, and state update. Across **seven base models and four agent frameworks**, the paper reports that retained experience can produce later-task gains, but the gains are **uneven across capabilities** and can look similar at the headline level even when only some systems show evidence of the intended **save → retrieve → update** pathway.

The most important move is methodological: the paper does not treat "performance went up later" as sufficient evidence of learning. It asks whether the improvement flowed through the mechanism the agent claimed to have — retained memory, reusable procedure, or state replacement. Hermes+ improves average retained-experience gain with its strongest effect on tasks where **outdated state must be replaced**, but the benefit remains model- and capability-dependent.

### ContinualSkillBench: much "skill evolution" is still context adaptation

ContinualSkillBench tests in-context continual skill learning over **five domains**, each with **100 interconnected subtasks** ordered for difficulty growth and cross-task reuse opportunities. Sequential execution generally improves performance, but the paper finds that **in-context learning performs comparably to explicit skill maintenance on average**. That implies a large share of observed improvement may come from adaptation to prior context and feedback, not from robust reusable skill abstraction.

Explicit skills still matter, but selectively: they help more on tasks that require **reusable procedures** or **precise outputs**. The paper also finds that weaker models tend to accumulate **larger, more fragmented task-specific skill collections**, suggesting current skill libraries often preserve residue from past tasks rather than consolidating transferable competence.

## Why this matters

These papers strengthen the original finding rather than overturning it:

1. **Self-improvement needs externalized evidence.** PAST-Bench explicitly checks whether gains follow the intended pathway; ContinualSkillBench separates durable skill artifacts from mere contextual carryover.
2. **Headline improvement is a weak metric.** Two agents can improve by the same amount while relying on very different mechanisms, only some of which are reusable.
3. **Persistence is not the same as consolidation.** Keeping memory or skills across sessions is necessary, but it does not prove the agent learned something portable.

**Scout implication:** the durable frontier is shifting from "can agents improve?" to **"can we tell whether the improvement came from persistent, reusable structure rather than transient context advantage?"** That is a verification and instrumentation problem first, and a learning problem second.

## Update 2026-08-19: task order can manufacture the appearance of improvement

**Source**: https://arxiv.org/abs/2608.18066v1

Salesforce AI Research's re-evaluation of two textual-memory methods, ReasoningBank and SCUBA, adds a second confound beyond transient context: the task stream itself can act as an undeclared training intervention. The authors reran web-agent experiments three times and perturbed task order across WebArena, VisualWebArena, and SCUBA rather than accepting the benchmarks' default sequence.

The stress tests materially change the interpretation of "self-improvement":

- Adding a memory loop increased run-to-run variance in **17 of 24 comparisons (about 71%)**; 11 comparisons increased variance by more than 50%. The paper attributes this to statefulness: early stochastic outcomes alter memory construction, then compound into different later memory states.
- In the default benchmark order, ReasoningBank averaged a **+1.5%** gain. Under shuffled orders it instead averaged **-4.5%**. Six of eight method/benchmark comparisons degraded significantly under shuffled order.
- The default WebArena sequences were not difficulty-neutral. Moving-average baseline success began near 75% and fell below 40% after task ID 150 in two domains, creating an implicit easy-to-hard curriculum that real user traffic cannot be assumed to provide.
- Manual memory inspection exposed specification failures, not merely weak retrieval. Agents learned plausible but impossible advice—for example, recommending APIs in a browser-only environment—and propagated misunderstandings from ambiguous task requests. Adding post-task rubrics, environment action feedback, and explicit memory-writing constraints recovered only **31%** of the shuffled-order degradation.

### Stronger claim protocol

This updates the earlier pathway-evidence requirement with two controls. A self-improvement result should report **multiple complete sequential runs**, because one random early trajectory can seed a favorable library, and it should test **multiple task permutations**, because a fixed sequence can quietly supply curriculum. Results should preserve the ordered task IDs, seeds, per-run memory snapshots, and benchmark/harness versions so an evaluator can distinguish learning from stream luck.

The paper does not show that textual memory is generally harmful: it studies two methods in web-agent settings, uses three runs per experiment, and the specification interventions recover part—but not most—of the order-induced loss. Its durable contribution is narrower: **a fixed sequential benchmark is simultaneously an evaluation set and a curriculum, so single-order gains are not sufficient evidence of robust self-improvement.**

## Update 2026-08-20: capability gain can widen the attack surface without raising conditional vulnerability

**Source**: https://arxiv.org/abs/2608.17684v1

An audit of SkillOpt, Agent Workflow Memory (AWM), and ReasoningBank in simulated e-banking adds a security dimension to pathway and task-order controls. The authors use matched benign acquisition trajectories, sealed evaluation endpoints, execution-grounded checks, and independent state replay. Their central result is that a learned artifact can make an agent more capable and more likely to reach hostile content, so security cannot be summarized by attack success *conditional on exposure*.

On Qwen 3.7 Flash, SkillOpt raises benign utility from **0.741 to 0.837** and exposure to injected content from **0.820 to 0.943**. Conditional attack success after exposure falls from **0.605 to 0.562**, yet overall attack success rises from **0.496 to 0.530** and unauthorized financial-state changes rise to **0.685**. Across three independently evolved lineages, utility, exposure, and unauthorized-state changes all increase, while aggregate attack success increases in only two. ReasoningBank reaches **0.859** utility without increasing aggregate attack success, although its unauthorized-state-change rate remains slightly above the static baseline.

AWM exposes a separate measurement confound. Its literal WebArena text-action envelope does not match the study's native function-calling executor. Removing only that envelope in a post-hoc sensitivity test changes utility from **0.319 to 0.756**, exposure from **0.299 to 0.909**, and attack success from **0.195 to 0.575**. An apparently safe or incapable learned workflow may therefore be an interface-incompatible artifact rather than a genuine behavioral result.

### Stronger audit contract

A self-evolution evaluation should report at least four separate quantities:

1. **Benign capability and regression**, on sealed endpoints rather than the acquisition tasks.
2. **Attack-surface contact**, because a more capable agent may encounter more adversarial content.
3. **Conditional compromise and realized unauthorized effects**, since a lower conditional rate can coexist with more total harm.
4. **Artifact–executor compatibility**, tested separately from artifact quality before comparing memory or workflow methods.

The evidence is deliberately bounded: it is one simulated banking environment on one named model, and the AWM correction is post-hoc. It does not rank these methods generally. It does show why post-evolution accuracy and one aggregate security score are insufficient: **learning can change reachability, susceptibility, and realized effects in different directions.**

## Update 2026-08-25: treat optimization spend and deployed-agent cost as separate budgets

**Sources**:
- https://news.ycombinator.com/item?id=49423077
- https://github.com/microsoft/agent-lightning/releases/tag/v1.0.1
- https://github.com/microsoft/agent-lightning/blob/v1.0.1/skills/agent-lightning/SKILL.md

Microsoft's Agent Lightning v1.0.1 release packages agent optimization as an installable coding-agent skill rather than claiming that a model improves itself autonomously. Given an editable agent and a benchmark, the skill directs the coding agent to vary grounding, output contracts, prompts, tools, models, reasoning effort, isolation, repair, routing, planning, retrieval, and critique. This is another concrete instance of the August shift already tracked here: practical "self-improvement" is becoming measured harness search over externally editable artifacts.

The most reusable part of the skill is its **two-budget distinction**. It tells the optimizer to read a development budget from `/artifacts/cost_budget.json`, continue measured iteration while meaningful search budget remains, and separately evaluate the resulting agent's per-run cost. Extra optimization spend is therefore allowed to discover a deployment configuration that may itself be cheaper. Accuracy, completion, downside, latency, cost, and variance are treated as separate coordinates rather than one scalar notion of improvement.

Its evaluation guidance also aligns with this note's stronger claim protocol: hold checkpoint, cases, model, effort, concurrency, scorer, and execution path constant except for the tested variable; use validation splits and repeated runs when the budget supports them; freeze primary outputs; do not expose held-out labels or training-only fields to deployment; and treat unavailable measurements as unknown rather than as evidence of success.

### Boundary: a good optimization protocol is not evidence that the optimizer improves agents

The release announcement says the skill guides systematic improvements and strengthens benchmark reporting, but it publishes no controlled result for the skill itself. The HN thread had 51 points and five comments at retrieval; its technical discussion was minimal and mostly questioned presentation. The skill also says to keep iterating while substantial budget remains, but it does not prescribe confidence intervals, minimum repetitions, a baseline-admission test, or an explicit multiple-comparison correction. Searching more configurations can increase the chance of selecting noise unless validation is protected from repeated optimizer access.

**Reusable rule:** maintain three ledgers during agent optimization: search spend, candidate deployment cost, and protected validation evidence. Stop when the remaining search budget cannot resolve a decision-relevant frontier uncertainty—not merely when budget is exhausted—and do not promote a candidate unless its deployment-visible path beats an admitted baseline on predeclared metrics.

## Update 2026-09-01: skill reliability belongs to the coalition and deployment domain

**Source**: https://arxiv.org/abs/2608.22610v1

*Coalition-Aware Skill Reliability for Self-Evolving Agents* tests a narrower
version of the evaluation-authority problem: an outcome gate can observe that a
whole skill bank improved without establishing which skill caused the gain or
whether that skill remains useful beside different skills or in a new domain.
The paper calls the two resulting failures **coalition pollution** and
**cross-domain utility reversal**.

The full-paper evidence is stronger than the abstract alone:

- In one audited transition, the baseline admitted a candidate on a `+0.006`
  online margin, but a paired 314-query knockout audit measured that candidate
  at `-0.005`; an incumbent skill carried the bank at `+0.084`.
- Across 12 proposals and three seeds, Coalition-Aware Skill Selection (CASS)
  accepted 1 candidate while the MemSkill outcome gate accepted 6. Holding the
  earlier bank size fixed, the baseline's admitted additions were collectively
  `-1.38` percentage points on average across LoCoMo, LongMemEval, and
  HotpotQA-50, despite passing when admitted.
- The same `insert` skill was significantly helpful on LoCoMo (`+0.084`, 95%
  confidence interval excluding zero) but had a negative HotpotQA-50 point
  estimate (`-0.035`) whose interval still included zero. This supports a
  **directional reversal**, not a statistically established harmful effect.
- A label-free 20-query target probe masked utility-reversing skills before
  deployment and improved all six tested banks. The average improvement was
  `7.17` points for baseline banks and `3.59` for CASS banks, consistent with
  CASS preventing some pollution earlier rather than repairing it later.

### Stronger admission rule

A self-evolving system should not assign a permanent reliability score to an
individual skill. Admission evidence must bind the skill to the tested bank
composition and domain; deployment into a new domain should trigger a new,
target-conditioned audit. Aggregate improvement is an endpoint observation,
not attribution proof.

This is a promising but bounded result. The experiments use one MemSkill-based
framework, Llama-3.3-70B-Instruct for skill extraction, eight H20 GPUs, three
seeds, and a fixed judge. The target masking result uses only 20 unlabeled
queries, the clearest target reversal is directional rather than significant,
and the paper says its audit toolkit, method code, and checkpoints **will be
released**. Independent reproduction and broader skill types remain open.

## Update 2026-09-01: SkillRise makes later tasks the curation evaluator

**Sources**:

- Xiaohongshu collection seed `6a6ab006000000001c00c932`, observed readable at
  `2026-09-01T11:29:49Z–11:30:14Z`
- https://arxiv.org/abs/2607.26784v1
- https://github.com/Within-yao/SkillRise/commit/2b38da3ad7b64414305d39609484803b07d3b9b0

The now-readable human-collected post nominates SkillRise as a direct test of
cross-task skill transfer. Its useful mechanism is not unconstrained reflection:
one policy alternates between solving an ordered task and rewriting a single
sequence-local skill document. Current-task outcome supervises solving; the
discounted outcomes of later tasks supervise curation. The document is the sole
information channel across tasks, so a later task is an external behavioral
test of whether the prior rewrite transferred.

The full `2607.26784v1` source reports Qwen3-1.7B and Qwen3-4B experiments on
128 held-out instances from each of ALFWorld, WebShop, and ScienceWorld. With
Qwen3-4B, Pass@1 is 85.9%, 84.4%, and 54.6%, beating the strongest listed
baseline by 2.3, 7.1, and 8.5 percentage points. On the same 128 ALFWorld tasks,
increasing related sequence length from two to six raises success from 83.6%
to 87.5% while each task is attempted once; the strongest-baseline margin grows
from 3.9 to 8.6 points. A no-curation ablation trails by roughly three points at
the end of training. In the authors' same-GPU pipeline comparison, SkillRise
matches RetroAgent at 85.9%, beats their SkillRL reproduction by 12.5 points,
and uses 1/6 and about 1/4.3 of those systems' respective running times.

### Why this does not settle robust self-improvement

The result is controlled evidence for later-task outcome credit, not proof that
the learned document transfers under open-ended task streams. Sequence
construction assumes environment-provided task-family metadata and an explicit
simple-to-complex order; this is exactly where the earlier task-order finding
warns that a hidden curriculum can manufacture improvement. The paper reports
one family/order protocol, models no larger than 4B, three text environments,
and readily verifiable rewards. It does not report shuffled-order or
mis-grouped-task stress tests, persistent cross-session governance, hostile
content, or multi-principal skill ownership.

GitHub gives attributable implementation provenance rather than an independent
replication. The paper source links `Within-yao/SkillRise`; public `main` resolved
to `2b38da3ad7b64414305d39609484803b07d3b9b0`. Its recursive tree was complete
(`truncated=false`), with 839 blobs and exact environment managers, a
solve/curate rollout loop, K=3 group data for all three benchmarks, and runnable
scripts. The repository has no GitHub Actions runs or project-level test suite.
One commit message says ALFWorld validation plus one GRPO step succeeded, which
is maintainer provenance, not Scout execution or reproduction. The large GPU,
model, environment, and external-data requirements make a full independent run
outside this bounded checkpoint.

**Reusable rule:** make a skill rewrite earn credit from held-out downstream
behavior, but perturb grouping and order before calling the gain transferable.
The next test should hold tasks and budget fixed while comparing easy-to-hard,
shuffled, reversed, and deliberately mis-grouped sequences across repeated
seeds, preserving every evolved document for pathway audit.
