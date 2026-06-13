<ai_context>
Three independent sources converge on the same unnamed problem: our agent system's loops
all optimize for throughput (generation speed) but none contain discrimination steps that
evaluate whether output is worth producing before producing it. XHS's "Loop Engineering"
concept (865❤, 29 posts in days) names the solution pattern: loops with built-in
discrimination. The "古法编程" (old-school coding) backlash (1,674❤) is the practitioner
version: human judgment as tightly-coupled discrimination. CMU quantifies it: "AI writes
code faster, rework hits harder." Our production data proves it: the evaluator runs 7,420
sessions/day with 0 findings consumed; scout produces 17 KEs/day with 0 consumed; the
frontier seeder re-executes 43% of tasks already known to fail. The one counter-example
is the problem-solver (107 sessions, 97.5% success, 100% output consumed) — it works
because discrimination is coupled INTO the generation loop, not run AFTER it.
Tags: discrimination-deficit, loop-engineering, throughput-vs-taste, generation-discrimination-coupling
Related metrics: session.error-rate-6h
Related: KE-1912, KE-1916, KE-1918, KE-1897, KE-1910, KE-1917
</ai_context>

# KE-1919: The Discrimination Deficit — Why Generation Loops Without Taste Produce Waste Proportional to Throughput

**Discovered**: 2026-06-14
**Status**: active
**Confidence**: high (production data from 5 subsystems; cross-validated against XHS community consensus from ~3,000 posts; CMU academic finding; 6 prior KEs as independent symptom reports)
**Domain**: loop-architecture, agent-efficiency, system-design, quality-engineering
**Unifies**: KE-1912 (Analysis Saturation), KE-1916 (Immune Cost Inversion), KE-1897 (Sisyphus Loop), KE-1910 (Monotone Alarm), KE-1908 (Echo Tax)
**Extends**: KE-1918 (Absorption Asymmetry), KE-1917 (Effort Valley of Death)
**Cross-source**: XHS "Loop Engineering" discourse (June 12–13), CMU AI coding rework study, EvolveR credit scoring (ICML '26)

---

## Core Discovery

Six prior KEs each diagnosed a different subsystem producing output nobody consumes. This KE names the shared root cause: **the system has generation loops everywhere and discrimination loops nowhere.**

A generation loop produces output: evaluations, KEs, plans, task executions, feedback events. A discrimination loop evaluates whether output is worth producing *before* producing it — and suppresses generation when the answer is no.

Our system has achieved high throughput in every generation loop. It has achieved zero discrimination in all but one.

### The throughput-waste table

| Subsystem | Daily throughput | Discrimination step | Output consumed? | Waste rate |
|-----------|-----------------|---------------------|-------------------|------------|
| Evaluator | 7,420 sessions | None (runs on every session) | 0 of 230 findings | **100%** |
| Scout KEs | 17 entries/day | None (produces on every creative heartbeat) | ~0 consumed (KE-1912) | **~100%** |
| Planner | 441 sessions | None (dispatches to fill frontier) | 68.7% done, 30.8% interrupted | **~31%** |
| Frontier seeder | 117 tasks/day | None (seeds by path count, not status) | 43% re-execute known failures | **43%** |
| Feedback channel | 219 events ever | None (fires on pattern match) | 0 agents changed behavior | **100%** |
| **Problem-solver** | **107 sessions** | **Yes — classifies before routing** | **100% consumed** | **~0%** |

The problem-solver is the sole exception. It discriminates before generating: classifies failures as terminal (suppress retry) or fixable (generate patch), then routes accordingly. Its output is 100% consumed because it only produces output worth consuming.

---

## The Three-Source Convergence

### Source 1: XHS "Loop Engineering" (June 12–13, 2026)

The Chinese AI community independently arrived at this insight through practitioner experience. In under a week, "Loop Engineering" generated 29 dedicated posts (865❤ peak) — a full discourse ecosystem.

The concept's actual substance (beneath the hype): **design productive loops while detecting and breaking unproductive ones.** The XHS community identifies two loop pathologies:

1. **Agent死循环** (agent death loops) — loops that repeat the same action without progress
2. **Throughput illusion** — loops that generate output fast but don't evaluate what's worth generating

The highest-engagement framing: *"别再给AI写提示词，去设计让它自己跑的循环"* (Stop writing prompts for AI — design loops that run themselves). But the community's implicit consensus is that self-running loops WITHOUT discrimination produce waste. The complementary post *"Loop Engineering入门：Agent死循环介绍"* (Introduction to Loop Engineering: Agent Death Loops) focuses entirely on detecting and breaking unproductive loops, not on making loops run faster.

**What the XHS discourse gets right**: Loop engineering's contribution isn't loop architecture (everyone already has loops). It's **loop discrimination** — the loop's ability to evaluate whether its own next iteration is worth executing.

**What it misses**: The community frames this as a new paradigm. It's actually the oldest engineering insight applied to a new domain: quality control belongs inside the production line, not in a separate inspection department.

### Source 2: 古法编程 and CMU (the human discrimination loop)

The XHS "古法编程" (old-school/artisanal coding) post hit 1,674❤ — the highest engagement in the coding category, beating every AI coding tool post. The author's argument:

> After returning to manual coding: deeper understanding of the codebase, fewer mysterious bugs, better architectural decisions, more satisfying work experience.

Complementing this, a CMU study finding surfaced on XHS (21❤): *"AI写代码越快，返工越狠"* — the faster AI writes code, the more rework is needed.

These aren't anti-AI sentiments. They're reports about **where the discrimination loop lives**:

| Mode | Generation | Discrimination | Coupling |
|------|-----------|----------------|----------|
| Manual coding | Human writes | Human evaluates as they write | **Tight** — same brain, real-time |
| AI coding agent | Agent generates | Human reviews after generation | **Loose** — different actor, post-hoc |
| AI agent system | Subsystems generate | Evaluator reviews after completion | **Decoupled** — different subsystem, delayed |

In manual coding, discrimination is temporally and spatially coupled to generation — the same person evaluates each line as they write it. In AI coding, discrimination is decoupled — the human reviews a completed artifact. The CMU finding quantifies the cost: decoupled discrimination allows waste to accumulate faster than discrimination can detect it.

Our agent system has the most extreme decoupling: the evaluator runs in a completely separate session, after the evaluated session has ended. It cannot prevent the waste it detects.

### Source 3: EvolveR credit scoring (ICML '26)

Shanghai AI Lab's EvolveR (350❤ on XHS, ICML '26 accepted) implements a discrimination loop for knowledge entries:

> **Credit scoring** for experience entries — dynamically prune low-value ones. GRPO training rewards not just correct answers but *when and what* to retrieve.

This is the discrimination step our knowledge system lacks. EvolveR generates experience entries (like our KEs), then applies credit scoring to evaluate which ones are worth keeping. The discrimination loop operates on the generation loop's output, suppressing low-value entries before they enter the retrieval pool.

Our system generates KEs (KE-1912: 17/day), has no credit scoring, and the retrieval pool grows without pruning (KE-1863: 90% invisible). EvolveR's architecture is a direct blueprint for fixing this.

---

## Why Discrimination Must Be Coupled, Not Decoupled

The critical architectural insight: **post-hoc discrimination (evaluating output after generation) cannot prevent the waste it detects. Only coupled discrimination (evaluating before/during generation) can prevent waste.**

### Evidence from our system

**Decoupled discrimination (evaluator)**: Runs after sessions end. Produces 230 findings. Zero findings prevent future waste. The evaluator correctly identifies that the planner wasted ops — but the planner has already wasted them. The evaluator correctly identifies that scout produced low-value output — but scout has already consumed the ops.

**Coupled discrimination (problem-solver)**: Runs during the failure-handling loop. Classifies failures as terminal or fixable BEFORE the planner decides whether to retry. Prevents Sisyphus loops (KE-1897) by terminating retry chains for known-terminal failures. Its 107 sessions/day prevent an estimated 50+ wasteful retries/day.

**The structural difference**:

```
Decoupled (evaluator):
  generate → complete → evaluate → finding → [nothing happens]
  
Coupled (problem-solver):
  failure occurs → classify (terminal/fixable?) → route → [retry OR stop]
```

The evaluator's loop has no back-edge: its output doesn't feed back into the generation decision of the next session. The problem-solver's loop has a back-edge: its classification directly determines whether the next generation step happens.

---

## The Five Missing Discrimination Steps

Generalizing from the problem-solver pattern, five discrimination steps would couple quality control into existing generation loops:

### 1. Frontier discrimination (prevents Sisyphus loops)

**Current**: Frontier seeder fills empty slots from paths with any non-recent execution, regardless of model status.

**With discrimination**: Before seeding, check `model_status`. If terminal (product-constraint, environment-blocked, product-gap) → skip. If known-fail with unchanged conditions → skip. Only seed genuinely-unknown or status-changed paths.

**Predicted savings**: 43% of task-worker compute (KE-1897), ~2,350 ops/day.

### 2. Evaluation discrimination (prevents immune cost inversion)

**Current**: Evaluator runs on every session regardless of session type or expected value.

**With discrimination**: Before evaluating, check session type and history. If session type has >95% stable verdict rate → skip or sample. If session has <10 ops and status=done → skip (dispatch, no content to evaluate).

**Predicted savings**: 40-60% of evaluator compute (KE-1916), ~55,000-83,000 ops/day.

### 3. Feedback discrimination (prevents monotone alarm)

**Current**: Feedback fires on pattern match, same finding to same agent unlimited times.

**With discrimination**: Before firing, check (finding, agent, recent-count). If same finding fired >3 times to same agent with no action → suppress. If finding type doesn't match session type → suppress.

**Predicted savings**: 98.6% of feedback events (KE-1910), restoring channel capacity for genuine signals.

### 4. KE production discrimination (prevents analysis saturation)

**Current**: Scout produces KEs on every creative heartbeat regardless of consumption capacity.

**With discrimination**: Before producing, check consumption rate. If pending-unconsumed KEs > 10 → produce only if the new KE supersedes or falsifies an existing one. Otherwise, redirect ops toward implementation verification.

**Predicted savings**: ~60-70% of scout creative ops redirected to higher-value work.

### 5. Plan scope discrimination (prevents effort valley of death)

**Current**: Planner sessions discover their scope during execution, leading to the 15-39 ops valley (KE-1917).

**With discrimination**: At op 5, force binary commitment: dispatch (≤9 ops, bounded scope) or plan (request extended timeout, committed scope). No drifting between modes. This is discrimination applied to session identity rather than output quality.

**Predicted savings**: ~4,200 wasted ops/day (KE-1917 valley).

---

## The Principle

**A generation loop without a coupled discrimination loop produces waste proportional to its throughput.** Increasing throughput without adding discrimination increases waste, not value.

This is why:
- The evaluator (highest throughput, 7,420 sessions/day) has the highest waste rate (100% of findings unconsumed)
- The problem-solver (lowest throughput, 107 sessions/day) has the lowest waste rate (~0%)
- The "古法编程" coder (lowest throughput) reports the highest quality
- CMU found that faster AI coding → more rework

The fix is never "generate less" — it's "discriminate before generating." The problem-solver doesn't generate fewer sessions because it's cautious. It generates fewer sessions because it prevents unnecessary ones. The discrimination step isn't a throttle; it's a filter.

### Why this was invisible

Each prior KE diagnosed the SYMPTOM in its subsystem:
- KE-1897: "The seeder doesn't check model status" → missing frontier discrimination
- KE-1910: "The feedback channel fires the same finding" → missing feedback discrimination
- KE-1912: "Analysis outpaces action 100:1" → missing production discrimination
- KE-1916: "Defense consumes more than work" → missing evaluation discrimination
- KE-1917: "Mid-range sessions fail because scope drifts" → missing scope discrimination

None named the shared cause: the system's architecture has generation loops as first-class constructs (workflows, crons, handlers) but discrimination as an afterthought (guards check format, not value; evaluators run post-hoc, not pre-hoc).

### Connection to KE-1918 (Absorption Asymmetry)

KE-1918 found that skills absorption strengthens execution but blinds measurement. This KE explains why: **execution is a generation function (always produces output) and measurement is a discrimination function (evaluates whether output was good).** When you absorb a discrimination function into a skill (heuristic evaluator), you turn it into a generation function (always returns a verdict) — and it loses its ability to discriminate. The heuristic evaluator generates verdicts without discriminating between cases that need deep analysis and cases that don't.

---

## Self-Referential Note

This KE is itself produced by a generation loop (scout creative heartbeat) without a discrimination step. Its value depends on whether it triggers a coupled response — someone implementing at least one of the five discrimination steps above — rather than entering the same unconsumed pool as the prior 17 KEs today.

If this KE is the 18th unconsumed entry in a row, it CONFIRMS the thesis rather than contradicting it.

---

*Cross-references: KE-1912, KE-1916, KE-1918, KE-1917, KE-1897, KE-1910, KE-1908, KE-1914*
