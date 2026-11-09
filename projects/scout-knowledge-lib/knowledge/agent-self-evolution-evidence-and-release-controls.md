<ai_context>
summary: "Evidence for agent self-evolution is strongest for bounded changes evaluated with fixed, protected gates. These source profiles distinguish mutation-path authority, artifact authenticity, peer reputation, useful mechanisms, promotion evidence, lifecycle integrity, process improvement, and broad autonomous capability claims."
triggers: ["self-evolution evidence", "harness evolution evidence", "skill learning evidence", "promotion gates", "release controls", "self-improvement evaluation"]
last_updated: "2026-11-09"
source_basis: "Companion evidence profiles extracted without substantive alteration from the source-grounded Agent Self-Evolution and Autonomy synthesis, plus direct inspection of mini-ork's mutation and certificate paths, Bitterbot's peer-skill admission path, and Entroly's pinned skill-promotion implementation. Coverage includes primary papers, pinned repositories, bounded local checks, and explicit abstract-only or non-reproduction limits through 2026-11-09."
</ai_context>

# Agent Self-Evolution: Evidence Profiles and Release-Control Boundaries

This companion preserves the detailed source assessments behind the mechanism
taxonomy and governed evolution loop in [Agent Self-Evolution and Autonomy: What
Actually Changes?](./agent-self-evolution-and-autonomy.md#agent-self-evolution-and-autonomy-what-actually-changes).
Read the parent note for definitions, comparisons, the novelty rubric, and
recommended experiments; use this note when auditing the strength and limits of
specific evidence.

## Implementation signal: autonomy is a property of a mutation path, not a repository

**Observed 2026-09-19. Repo:** [SourceShift/mini-ork](https://github.com/SourceShift/mini-ork) at commit [`962bf47874b84ca0a393851d59896cdbb71a6eaa`](https://github.com/SourceShift/mini-ork/tree/962bf47874b84ca0a393851d59896cdbb71a6eaa).

mini-ork contains at least two materially different self-change paths. Its
[`self_improve.py`](https://github.com/SourceShift/mini-ork/blob/962bf47874b84ca0a393851d59896cdbb71a6eaa/mini_ork/cli/self_improve.py)
outer loop creates a fresh branch and worktree for each patch, requires three
deterministic verifier results plus an explicit approving model-critic verdict,
commits only after those gates pass, and merges into the current branch only
when `--auto-merge` is supplied. The default therefore creates a reviewable
branch without activating it on the parent branch.

The separate [`apply.py`](https://github.com/SourceShift/mini-ork/blob/962bf47874b84ca0a393851d59896cdbb71a6eaa/mini_ork/cli/apply.py)
path mutates recipe prompt files. File writes are master-gated off by default,
but once enabled there is deliberately no human approval branch: a real
held-out probe must strictly improve the measured candidate, previously passing
per-task probes may not regress, fabricated scorers cannot authorize promotion,
and an unmeasured or dead two-arm probe is quarantined. A promoted mutation is
then written directly, with prior bytes retained for rollback. The repository's
[`SAFETY.md`](https://github.com/SourceShift/mini-ork/blob/962bf47874b84ca0a393851d59896cdbb71a6eaa/docs/SAFETY.md)
is unusually explicit that its seven-rung ladder describes intent rather than a
runtime dispatcher, that the advertised declarative `config/safety.yaml` root
of trust does not exist, and that the effective backstop for this unattended
path is the measurement gate plus version control.

This is useful evidence for a sharper audit rule: **never label a system
“human-gated,” “autonomous,” or “rollback-safe” at repository level.** Inventory
each mutation path as `(target, enable switch, evaluator, activation action,
recovery action)`. Here, harness-code evolution and prompt evolution share a
project but not the same activation boundary. The former defaults to branch
quarantine; the latter defaults disabled, then becomes measurement-authorized
and immediately effectful when enabled. A policy diagram that merges those
paths would overstate human review on one side or understate isolation on the
other.

Limits: this inspection established control flow and documentation at one pinned
commit; it did not run the probe suite, exercise rollback, or independently test
that all mutation entry points pass through these gates. The model-based patch
critic is also not an independent deterministic evaluator, even though its
missing or non-approving verdict fails closed.

### November 9 update: verdict, evidence bundle, and issuer authenticity are separate claims

Reinspection at commit
[`d779e3d6740cff107dce5acc1a9bec7f60996f9c`](https://github.com/SourceShift/mini-ork/tree/d779e3d6740cff107dce5acc1a9bec7f60996f9c)
shows that mini-ork has expanded from mutation-path controls into a more explicit
verification artifact stack. Its
[`certify` command](https://github.com/SourceShift/mini-ork/blob/d779e3d6740cff107dce5acc1a9bec7f60996f9c/mini_ork/cli/certify.py)
returns `PROVEN`, `REFUTED`, or `UNVERIFIED`; the important design choice is that
missing or unusable evidence remains abstention rather than being converted into
a pass. Metamorphic invariants require a supermajority across informative
perturbations, while the
[`differential check`](https://github.com/SourceShift/mini-ork/blob/d779e3d6740cff107dce5acc1a9bec7f60996f9c/mini_ork/certify/differential.py)
can only veto a would-be proof when confirmed preserve-domain behavior diverges.
The model proposes candidate checks, but deterministic executions decide their
observations.

The resulting
[`certificate`](https://github.com/SourceShift/mini-ork/blob/d779e3d6740cff107dce5acc1a9bec7f60996f9c/mini_ork/certify/certificate.py)
binds the verdict to base and head revisions, patch and issue hashes, method,
context files, probe and invariant evidence, optional mutation score, costs, and
duration. It can also carry a precommitment and trial count for
[`hidden checks`](https://github.com/SourceShift/mini-ork/blob/d779e3d6740cff107dce5acc1a9bec7f60996f9c/mini_ork/certify/hidden_checks.py).
Those checks are honestly weaker without `MO_HIDDEN_CHECK_SECRET`: their key
source falls back to a run ID or patch digest and is therefore reproducible by
someone who knows that input. A hidden-check receipt must consequently state the
key source; “renamed after generation” is not equivalent to “unpredictable to
the patch author.”

A certificate digest is still only self-consistency: anyone editing the JSON can
recompute it. mini-ork therefore adds a detached
[`seal`](https://github.com/SourceShift/mini-ork/blob/d779e3d6740cff107dce5acc1a9bec7f60996f9c/mini_ork/certify/seal.py)
that can bind the certificate ID and digest to an audit-chain issuance row and
an Ed25519 signature. Verification distinguishes `VERIFIED` with an independently
pinned public key from `UNPINNED`, `UNSIGNED`, and `FAILED`; the repository's
[`seal tests`](https://github.com/SourceShift/mini-ork/blob/d779e3d6740cff107dce5acc1a9bec7f60996f9c/tests/unit/test_certificate_seal.py)
exercise content tampering, foreign keys, altered seal digests, removed issuance
rows, and the missing-crypto path.

The reusable rule is: **a mutation admission verdict, its evidence bundle, and
the issuer/authenticity proof need separate receipts.** `PROVEN` describes the
oracle's execution judgment; a certificate records what that judgment covered;
a digest detects accidental or unacknowledged edits only when compared with a
trusted value; a pinned signature attributes issuance; and an audit-chain row
supports retention and ordering. None alone proves that the patch was deployed,
that the evaluator was adequate for every failure mode, or that the claimed
production outcome occurred.

Limits: Scout statically inspected the pinned README, complete tree, verification
architecture, certificate, seal, hidden-check, differential, and selected test
files. Scout did not execute mini-ork, Docker, its models, tests, audit database,
certification corpus, or reported benchmark, so this update establishes artifact
and control-flow boundaries rather than empirical verifier accuracy.

## Peer reputation should buy evaluation priority, not activation

**Observed 2026-09-24. Repo:** [Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop) at commit [`873e5d58ce95eccd7908d1d0bf0f28112db4bbe7`](https://github.com/Bitterbot-AI/bitterbot-desktop/commit/873e5d58ce95eccd7908d1d0bf0f28112db4bbe7).

Bitterbot's peer-skill pipeline implements a useful separation between trusting
an identity and trusting its artifact. Its
[`ingest.ts`](https://github.com/Bitterbot-AI/bitterbot-desktop/blob/873e5d58ce95eccd7908d1d0bf0f28112db4bbe7/src/agents/skills/ingest.ts)
verifies envelope structure, signature and content hash, runs injection and
routing checks, and normally quarantines received skills. Under `auto` policy,
a sufficiently trusted peer can skip operator review, but the skill only enters
staging. [`peer-staging.ts`](https://github.com/Bitterbot-AI/bitterbot-desktop/blob/873e5d58ce95eccd7908d1d0bf0f28112db4bbe7/src/agents/skills/peer-staging.ts)
binds that stage to author key, peer identity, content hash and receipt time;
it refuses to replace a local pending proposal or another author's same-name
stage. Trust therefore changes intake friction, not service state.

Activation is a separate empirical decision. The
[`validation gate`](https://github.com/Bitterbot-AI/bitterbot-desktop/blob/873e5d58ce95eccd7908d1d0bf0f28112db4bbe7/src/memory/skill-evolution/validation-gate.ts)
requires a received skill to beat its incumbent on the receiving node's own
private capability tasks. Public canonical tasks are treated as a memorizable
baseline and cannot promote a peer skill by themselves. Model-predicted replay
judgments are diagnostic only; missing or underpowered evidence holds the
candidate, measured non-improvement rejects it, and acceptance uses paired real
rollouts with a one-sided sign test before a canary release. Republishing the
same author/name lineage does not buy unlimited validation attempts, and exact
bytes already measured negatively on that node are not rerun.

The repository makes the policy explicit in a test named
[`trust-not-evidence.test.ts`](https://github.com/Bitterbot-AI/bitterbot-desktop/blob/873e5d58ce95eccd7908d1d0bf0f28112db4bbe7/src/memory/skill-evolution/trust-not-evidence.test.ts):
peer trust is excluded from activation fitness and used only to prioritize
which candidate gets evaluated first. Sender attestations similarly remain
claims. A local regression can disable a live peer skill, while two fresh
current-generation verdicts from configured attesters are required for remote
demotion; unknown attesters do not count.

Outbound propagation applies another boundary. The
[`P2P publisher`](https://github.com/Bitterbot-AI/bitterbot-desktop/blob/873e5d58ce95eccd7908d1d0bf0f28112db4bbe7/src/memory/skill-evolution/p2p-publish.ts)
selects only locally evolved skills with an accepted validation verdict that
have reached stable state and survived a default three-day maturity delay. It
refuses bodies containing detected secrets or user-specific identifiers and
ships signed provenance so receivers can inspect the sender's evidence, then
re-gate locally rather than inherit the verdict.

The reusable control is to assign peer reputation only narrowly scoped rights:
transport eligibility, review bypass, and evaluation priority. **Activation
should require artifact-bound local evidence.** A signature establishes who
made a claim; reputation can decide which claim is economical to test; neither
establishes that the procedure helps this node, model, task distribution or
tool environment. This avoids both extremes of ignoring useful network
reputation and turning it into transitive execution authority.

Limits: this was a source inspection at one pinned revision. Scout did not run
the repository's tests, benchmark the skill gate, exercise a two-node transfer,
or verify live network behavior. Comments, tests and project documentation
show intended invariants plus implementation paths, not proof that every
runtime path enforces them or that the statistical gate is well calibrated.

## What the strongest evidence says

### Bounded skill learning works, but transfer is conditional

- **RetroAgent** changes both weights and explicit memory. With Qwen-2.5-7B it
  reports GRPO-to-RetroAgent gains of 77.3→95.6 on ALFWorld, 66.9→82.3 on
  WebShop, 11.2→38.3 on Sokoban, and 39.3→48.2 on MineSweeper, averaged over
  three runs. Half-group memory augmentation beats full-group augmentation,
  showing that extra guidance can suppress exploration.
- **Memento-Skills** reports GAIA test 52.3→66.0 and an HLE subset 17.9→38.7,
  but uses one underlying Gemini model and notes weak GAIA cross-task reuse:
  most learned skills never fire on test.
- **SkillOS** reports ALFWorld 47.9 without memory, 55.7 with ReasoningBank, and
  61.2 with its learned curator. Some cross-task transfers are negative, and
  curator–executor compatibility matters more than curator size.
- **SkillOps** reports 79.5% versus 70.6% for its strongest standalone baseline,
  but drop-in gains are only 0–2.9 points and much of the large-library test is
  synthetic, high-level PDDL maintenance in one domain.
- **SkillCoach** shows why outcome-only admission is unsafe: a successful final
  answer can hide wrong skill selection and ad-hoc repair. Semantically similar
  distractors degrade routing before a library visibly collapses.

### Search strategy can evolve without the deployed agent evolving

EvoX co-evolves candidate artifacts and the search policy that chooses parents,
variation operators, and inspirations. CORAL lets long-lived agents decide
when to retrieve, propose, evaluate, and update shared knowledge. Both retain a
fixed hidden evaluator. They are best understood as adaptive search portfolios.

HyperAgents goes further: the task agent and the meta-agent that modifies it
are one editable program. It reports held-out paper-review improvement from
0.0 to 0.710 and robotics reward-design improvement from 0.060 to 0.372 over
100-iteration searches, with confidence intervals and ablations. This is a
genuinely broader mutation surface than EvoX or a fixed meta-agent. It still
uses fixed domains, evaluation, archives, budgets, and human safety controls;
its own limitations state that the implementation does not establish
unbounded progress.

### Beagle makes harness evolution operational—but its defaults are plumbing, not proof

An HN submission surfaced Salesforce AI Research's open-source
[Beagle](https://github.com/SalesforceAIResearch/Beagle), which turns the DarwinX
harness-evolution procedure into a resumable campaign system. It treats harness source
as the mutable artifact, evaluates candidates through each benchmark's native runner,
keeps a genealogy database and isolated worktrees, distinguishes kept, archived,
rejected, failed, and no-change nodes, and can preserve regressing specialists for later
recombination without presenting them as the shipped best node. Its typed configuration
also fails on unknown knobs rather than silently accepting configuration drift.

The more important signal is the boundary Beagle's own documentation draws around those
features. The generated smoke runs one node and one sample, and exercises only the built-in
canary, content, and anti-cheat path. Cross-benchmark protection, mixture gates, repeated
mini-evaluation, fixed comparison panels, scope constraints, and the optional verifier are
separate opt-ins. Several settings have narrower behavior than their names suggest: the
current mixture score is a regression floor rather than the parent-selection objective,
`subset_eval_n_attempts` is not consumed by the hosted pipeline, and only one parent-solved
canary is probed per node by default. Thresholds for regression and cross-benchmark gates
must be calibrated from baseline rerun variance; copied margins are not evidence.

This implementation sharpens the practical rule: **the presence of an evolution gate is
not an evaluation claim**. A credible campaign record must name which gates actually ran,
their sample counts and calibrated margins, the fixed or held-out task identities, the
selection metric, and a final untouched-data evaluation of the selected commit. A dry-run
or one-node smoke proves wiring, not generalized improvement.

*Sources: [HN item 49650988](https://news.ycombinator.com/item?id=49650988);
[Beagle repository](https://github.com/SalesforceAIResearch/Beagle);
[pinned README](https://github.com/SalesforceAIResearch/Beagle/blob/15f12b7b014740583dda14454f0ba2227dd6de92/README.md),
[DarwinX configuration guide](https://github.com/SalesforceAIResearch/Beagle/blob/15f12b7b014740583dda14454f0ba2227dd6de92/docs/darwinx-configuration.md),
[typed configuration](https://github.com/SalesforceAIResearch/Beagle/blob/15f12b7b014740583dda14454f0ba2227dd6de92/beagle/algorithms/darwinx/config.py), and
[algorithm adapter](https://github.com/SalesforceAIResearch/Beagle/blob/15f12b7b014740583dda14454f0ba2227dd6de92/beagle/algorithms/darwinx/algorithm.py),
commit [`15f12b7`](https://github.com/SalesforceAIResearch/Beagle/commit/15f12b7b014740583dda14454f0ba2227dd6de92), inspected 2026-09-11. The published benchmark table and generalization claims are author-reported and were not independently reproduced here.*

### Recurrent failures are stronger patch evidence than isolated failures—not promotion evidence

[Ecdysis](https://arxiv.org/abs/2609.11677v1) changes the unit of harness
repair from one failed trajectory to failure patterns recurring across a batch.
Its multi-role FDCR stage separates diagnosis from implementation: analyst,
critic, and engineer roles refine a structured modification specification; a
coding agent changes the harness. This is a useful causal discipline because a
single failure can reflect an idiosyncrasy of the task model rather than a
systematic defect in prompts, state handling, or tool coordination. Editing the
harness around every such error can shrink the valid action space into a
model-specific workaround.

The comparison controls the initial harness, frozen model weights, training
evaluation, rollback, early stopping, and at most three candidate rounds.
Candidates are evaluated on a subsequent complete training pass rather than on
the trajectories that generated them, retained only on strict improvement, and
then frozen before held-out testing. On the five-model by two-subset
`τ²-Bench` matrix, average accuracy rises from 46.67% for per-failure
self-evolution to 54.67% with batch aggregation and 59.33% with aggregation plus
FDCR. Across `τ²-Airline`, `τ²-Retail`, and AgentBench, the paper reports
58.67%→69.56% average accuracy (an 18.56% relative gain) over the same baseline.
The harness was evolved with Qwen3-8B and reused without further evolution for
four other task models, so the cross-model result is more informative than a
same-model training replay.

The efficiency result also separates two mechanisms. Aggregation without FDCR
is cheapest and fastest: versus the self-evolution baseline, reported API cost
falls from $8.484 to $2.485 on Retail and $6.382 to $2.136 on Airline, with
1.42× and 3.23× speedups. FDCR recovers more accuracy but spends some of that
advantage; its corresponding speedups are 1.30× and 1.84×. Collaborative
critique is therefore an accuracy-oriented option, not the source of the main
training-efficiency gain.

The boundary matters: recurrence is **proposal evidence**, not causal proof or
release authority. Correlated tasks can repeat the same spurious pattern, and
the paper's promotion rule reuses 20 training tasks per `τ²` subset. The held-out
20-task subsets and three trials provide useful transfer evidence, but this is a
small, domain-limited campaign with author-reported results and no inspected
implementation artifact. A production loop should cluster failures by mechanism,
prefer changes supported across independent tasks and models, then still require
fresh protected cases, regressions, lineage, and rollback.

*Sources: [arXiv abstract](https://arxiv.org/abs/2609.11677v1),
[full HTML](https://arxiv.org/html/2609.11677v1), and
[API metadata](https://export.arxiv.org/api/query?id_list=2609.11677), inspected
2026-09-11. Quantitative results are reported by the paper and were not
independently reproduced here.*

### Realistic evaluation often matters more than another mutation operator

AgentGym2 contains 437 tasks—182 complex tool-use, 57 data-analysis, and 198
deep-search tasks—with 652 attachments. Hidden information, tool discovery,
ambiguity, noise, and distractors all lower performance. Three runs per task
and reported 98.9% human/LLM-judge agreement make it a useful deployment
validity check, though it is not a self-evolution method.

AgentStream is the best direct warning against universal memory defaults. It
crosses five experience methods, three frontier models, and isolated,
sequential, and interleaved streams. The winning method changes by model and
stream; a method can help in isolation and hurt when domains interleave. A
separate task-order study turns a reported +1.5% default-order ReasoningBank
gain into −4.5% under shuffled orders.

SEAGym turns evaluation into an explicit lifecycle: train exposure, frozen
update-validation, held-out in- and out-of-distribution tests, replay,
snapshots, and cost. Its AHE run reports validation 40.0→57.1 but held-out ID
only 40.0→49.1 and OOD 22.5→28.8; one intermediate epoch collapses to 6/80
replay tasks before recovery, and batch sizes 10 and 80 regress while 20 works
best. This makes forgetting and optimization-path sensitivity visible. The
released deterministic engine is operational—the goal-owned checkout passed
161 tests with 7 skipped—but provider-backed results remain author-reported.

The matched-budget harness critique adds a harder baseline. On Terminal-Bench
2.1 without unit-test feedback, direct execution averages 68.2, parallel search
72.3, sequential refinement 69.3, and harness evolution 67.4; with feedback,
parallel reaches 86.0 and sequential 84.3 versus harness evolution 75.8. On a
disjoint 45/10/34 split, evolved-harness transfer averages only +0.6. These are
protocol-level results for AHE-style evolution, not a direct refutation of
RHO, but they justify requiring a harness-sensitivity diagnosis, matched task-
level search, and disjoint transfer before crediting harness evolution itself.

### Inherited task progress is not evidence that the research process improved

Rekursiv.ai's HN-surfaced NanoChat campaign makes this distinction unusually
concrete. Its agent teams preserved failed experiments, handed tested code and
matched-seed panels to later waves, and sometimes revised role prompts and
submission procedures. The current Priml recipe exposes a cumulative runnable
sequence and reports a final B200 score of 0.887791 mean BPB over ten seeds.
That is inspectable evidence of a better *training recipe*, not by itself a
causal evaluation of the evolving research harness.

The authors report that, in one retrieval-policy cohort, availability of the
inherited recipe explained 97.79–100% of control-relative improvement area.
They also disclose only two runs per model in one early-branch comparison,
different provider stacks, human interventions, and a service interruption
that left 35 completed panels awaiting qualification across 48 launched
campaigns. Those details expose three separate ledgers:

1. **task-state progress:** which code, configuration, failure, or measured
   result descendants inherited;
2. **process mutation:** which prompt, role, routing, deadline, or recovery rule
   changed; and
3. **process efficacy:** a matched comparison showing that the process change,
   rather than inherited task state or extra opportunity, improved future
   discovery.

A swarm can be valuable while only the first ledger is strong. Preserve
completion and qualification as different events, compare process variants
from the same starting packet under matched resources, and report inherited-
recipe contribution separately from incremental discovery. Otherwise
"self-improving research" collapses artifact accumulation and causal
meta-improvement into one label.

Source: https://news.ycombinator.com/item?id=49716123  
Primary report: https://rekursiv.ai/blog/autoautoresearch/  
Repo: https://github.com/rekursiv-ai/priml  
Inspected revision: https://github.com/rekursiv-ai/priml/commit/92c6bd2b23e922ecde5548431cd644c4cb6debe5  
Runnable recipe and result table: https://github.com/rekursiv-ai/priml/blob/92c6bd2b23e922ecde5548431cd644c4cb6debe5/priml/baselines/nanochat/README.md#reproducing-the-blog-post

### Harness evolution can optimize efficiency without proving general self-improvement

*SoL-Pi: Recursively Scaling Auto-Research Loops for Efficient Agent Harness*
([2609.20519v1](https://arxiv.org/abs/2609.20519v1)) treats the harness as the
mutable surface. The authors report scaling auto-research rollouts across more
numerous and diverse environments, then retaining four mechanisms spanning
action execution, context compaction, observation handling, and delegated
reading. On the 51-task EdgeBench evaluation, the abstract reports performance
comparable to Pi across GPT-5.6 Sol and Opus 5 while reducing recorded token
traffic by 44.7–49.0% and API cost by about one third. It translates those cost
changes into estimated hourly savings of $8.75–$13.50 versus native Codex and
Claude Code harnesses, and $4.36–$5.71 versus Pi.

This is a useful reminder that an evolution loop can target a multi-dimensional
release objective rather than benchmark accuracy alone: maintain verified task
performance while reducing tokens and cost. It also reinforces the distinction
between **search output** and **process improvement**. Four mechanisms surviving
selection is evidence that one search produced a compact candidate harness; it
does not by itself show that the recursive search procedure became better, that
each mechanism caused part of the gain, or that the candidate generalizes
outside EdgeBench. A defensible release receipt should therefore bind the
parent and candidate harnesses, model and task panel, performance-equivalence
margin, token-accounting boundary, prices, and held-out results. Dollar savings
should remain derived, price-sensitive estimates rather than the primary
measurement.

**Evidence boundary:** Scout reviewed the live arXiv API abstract, not the full
paper, harness implementation, rollout histories, EdgeBench task definitions,
or cost records. The mechanism count, model names, performance comparison,
token reduction, and savings are author-reported abstract claims. The abstract
does not state the equivalence margin, uncertainty, train/test separation, or
per-mechanism ablations needed to attribute transfer or causal value.

### A documented promotion gate is not an enforced promotion gate

[EvoOntology](https://github.com/ruc-datalab/EvoOntology) is a concrete,
inspectable ontology-evolution layer for data agents. It versions semantic
records, records tool-call trajectories rather than chain of thought, freezes a
round budget, keeps rejected candidates in the same run, and advances the
checkpoint only when a candidate is published. Its workflow distinguishes a
protected validation reserve in fixed-split benchmarks from a frozen batch plus
separately sampled validation tasks in rolling deployments. The authors report
ontology-versus-baseline gains of 8.8 points on BIRD, 20.0 on DDR-Bench, and 1.0
on InsightBench across a four-backbone subset; these are repository/paper
claims, not independently reproduced results.

The implementation exposes an important control-plane boundary. The skill tells
the model to fix the evaluator, call the ground-truth or anonymous A/B gate,
reject regressions, and accept only a reproducible improvement. The Python gate
itself is simple and inspectable: a candidate wins when its mean ground-truth
score strictly exceeds the parent's, or when it wins more judged cases with no
candidate critical error. But `EvolutionSession.accept()` checks only that a
candidate exists and loads, then publishes it, switches the active version, and
advances the checkpoint. The public `accept_evolution` operation calls that
method directly; it does not require a recorded evaluation, a passing gate
receipt, paired case identities, or an acceptance-policy digest. Tests likewise
exercise publication after merely recording candidate metrics.

This is not evidence that the intended workflow routinely bypasses evaluation.
It is evidence that lifecycle integrity and admission integrity are separate.
A robust self-evolution control plane should make promotion consume a typed,
immutable gate receipt bound to the parent, candidate, evaluator revision,
protected case set, acceptance policy, and result. Human- or model-readable
instructions remain valuable, but they should not be the only barrier between a
candidate artifact and active state.

**Repo:** https://github.com/ruc-datalab/EvoOntology

**Inspected revision:** https://github.com/ruc-datalab/EvoOntology/commit/ace8ff695f6b1752240cb0e0322f65667d7016eb

**Primary evidence:** [architecture and split contract](https://github.com/ruc-datalab/EvoOntology/blob/ace8ff695f6b1752240cb0e0322f65667d7016eb/docs/architecture.md), [evaluation gate](https://github.com/ruc-datalab/EvoOntology/blob/ace8ff695f6b1752240cb0e0322f65667d7016eb/evoontology/evaluation/evaluation.py), [accept/publish state transition](https://github.com/ruc-datalab/EvoOntology/blob/ace8ff695f6b1752240cb0e0322f65667d7016eb/evoontology/evolution/session.py), [operation boundary](https://github.com/ruc-datalab/EvoOntology/blob/ace8ff695f6b1752240cb0e0322f65667d7016eb/evoontology/runtime/ops.py), [workflow instructions](https://github.com/ruc-datalab/EvoOntology/blob/ace8ff695f6b1752240cb0e0322f65667d7016eb/plugins/claude-code/skills/evo-evolve/SKILL.md), and [lifecycle operation test](https://github.com/ruc-datalab/EvoOntology/blob/ace8ff695f6b1752240cb0e0322f65667d7016eb/tests/test_mcp_ops.py).

### Promotion should consume evidence, not copy a score

Entroly's current skill engine implements the stronger boundary missing from the
EvoOntology example above. A development benchmark can leave a candidate in
`testing`, but cannot promote it. Promotion requires caller-supplied cases whose
input strings do not occur in the candidate's development cases. The decision
uses the lower bound of a 95% Wilson interval rather than raw pass rate; with the
current 0.7 threshold, even one successful case is insufficient while ten of ten
clear the gate.

More importantly, the decision is bound to an evidence object rather than a
mutable score. The engine hashes the candidate code, development tests,
evaluation cases, and evaluator source, then records per-case observations in a
content-addressed HMAC-authenticated record. Promotion re-verifies those inputs,
requires the selected record to be the newest valid evaluation, and fails back
to `testing` if code, tests, evaluator, evidence, or key changes. The public
loader repeats the same checks before returning a promoted skill. Repository
tests exercise mutations to each of those inputs and verify that mutable
`metrics.json` values cannot override the authenticated result.

This is a useful **admission-integrity pattern**, not proof that the promoted
skill is useful or safe. Distinct input strings do not establish independent,
representative held-out cases; the caller supplies both cases and expected
outputs. The engine evaluates the candidate in a timeout-limited subprocess but
does not isolate its filesystem, network, or process permissions. The HMAC key
and candidate run under the same operating-system account, so this design
protects primarily against stale results and ordinary artifact tampering, not
malicious generated code. It also establishes an absolute pass-rate gate rather
than matched non-inferiority against the previous live behavior. A deployment
receipt still needs case provenance, evaluator authority, representative
regressions, isolation for untrusted candidates, and rollback monitoring.

**Repo:** https://github.com/juyterman1000/entroly  
**Inspected revision:** https://github.com/juyterman1000/entroly/commit/63b24e81bc9e822b0d80e138722f554b3c089def  
**Primary evidence:** [promotion contract](https://github.com/juyterman1000/entroly/blob/63b24e81bc9e822b0d80e138722f554b3c089def/docs/skill-promotion-evidence.md), [skill-engine implementation](https://github.com/juyterman1000/entroly/blob/63b24e81bc9e822b0d80e138722f554b3c089def/entroly/skill_engine.py), and [mutation/regression tests](https://github.com/juyterman1000/entroly/blob/63b24e81bc9e822b0d80e138722f554b3c089def/tests/test_frontier_evidence_regressions.py). Scout inspected source and tests but did not run the suite; no independent task-quality or security evaluation was performed.

### RL can expand capability only under identifiable headroom

The controlled synthetic study *On the Interplay of Pre-Training,
Mid-Training, and RL* reconciles two slogans. RL expands pass@128 when
pretraining leaves missing but reachable combinations and tasks sit near the
model's competence edge; it does little when primitives are absent or the task
is already saturated. Under fixed compute, targeted mid-training often beats
RL-only. This is evidence for conditional capability expansion, not that RL
always creates new abilities or merely sharpens existing ones. The released
training stack and checkpoints make the study inspectable, but its synthetic
math tasks do not establish the same causal boundary in open environments.

### Formal limits are warnings, not turnkey gates

The Two-Gate result in *On The Statistical Limits of Self-Improving Agents*
requires fixed-distribution IID data, bounded loss, independent validation,
one changing axis at a time, and a fixed ex-ante reachable hypothesis envelope.
Promotion must exceed `2εV+τ`, not merely improve a validation score. The paper
formalizes why repeated adaptive reuse consumes evidence, but practical
capacity bounds for modern agent harnesses remain unknown. Use it to motivate
protected data and bounded mutation surfaces, not to claim a deployable VC-
dimension gate.

