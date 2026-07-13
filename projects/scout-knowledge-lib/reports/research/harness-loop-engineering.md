<ai_context>
summary: "Focused research report on harness and loop engineering: what they solve, how they work, design primitives, failure modes, and applicability to May, Scout, and aks-rp-e2e."
triggers: ["harness engineering", "loop engineering", "agent harness", "execution loop", "retry budget", "loop-cost", "12-factor agents"]
created: "2026-07-11"
source_basis: "Scout knowledge library (agent-architectures.md §Harness Engineering, §Loop Engineering, §HarnessFix; agent-runtime-hardening.md §Life-Harness, §Bounded Recovery, §LACUNA, §MOSS; agent-evaluation.md §Agent Testing Tooling), GitHub trending repos June-July 2026, arXiv papers June 2026."
</ai_context>

# Harness & Loop Engineering

**Research Report — Scout Knowledge Library**
**Date**: 2026-07-11 | **Task**: research-harness-loop-engineering

---

## Executive Summary

Harness engineering wraps a base agent (LLM + tools) with a deterministic
control layer that enforces safety, scope, and resource budgets. Loop
engineering structures the agent's inner execution cycle with explicit cost
accounting, retry budgets, and abort conditions. Together they solve the core
problem of making non-deterministic agent execution production-safe and
resource-bounded.

This report synthesizes existing Scout knowledge, extends it with current
sources, and provides applicability guidance for May (infrastructure agent),
Scout (knowledge/research agent), and aks-rp-e2e (test exploration project).

---

## 1. The Problem They Solve

A bare LLM agent with tool access has:
- No resource ceiling (can loop indefinitely, spending unbounded tokens)
- No rollback (effects are immediately committed)
- No structured failure handling (retry = re-run everything)
- No observability of intermediate state
- No mechanism for human handoff at decision boundaries

The 98% Problem (GitHub trending, June 2026): "The agent does 98% of the
work; the harness is the 2% that determines production safety." Without a
harness, the 2% failure case — tool misuse, infinite loops, budget blowout,
unsafe side-effects — makes the 98% success worthless.

**What loop engineering adds beyond one-shot or CI:**
- One-shot execution has no feedback channel — success or fail, no recovery.
- Traditional CI has feedback but is batch-oriented and human-triggered.
- Loop engineering provides _within-session_ feedback: observe result → classify
  outcome → decide (retry/repair/abort/escalate) → bound the cost of deciding.

---

## 2. How the Loop Works

A well-engineered agent execution loop has these stages:

```
┌─────────────────────────────────────────────────────┐
│  GATE: Should this session run at all?              │
│  (Quick-exit / abstention check)                    │
└───────────────────┬─────────────────────────────────┘
                    │ yes
┌───────────────────▼─────────────────────────────────┐
│  INPUT: Load context, verify preconditions          │
│  (Cold-start reconstruction, input validation)      │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│  EXECUTE: Do the work (tool calls, reasoning)       │
│  Within: budget counter, effect sandbox             │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│  EVALUATE: Did it work? Classify outcome.           │
│  (Success / recoverable failure / fatal failure)    │
└───────────────┬───────────┬────────────┬────────────┘
                │           │            │
           success    recoverable      fatal
                │           │            │
┌───────────────▼──┐ ┌──────▼──────┐ ┌──▼───────────┐
│  COMMIT          │ │  REPAIR     │ │  ABORT       │
│  Record evidence │ │  Targeted   │ │  Log failure │
│  Update state    │ │  retry with │ │  Escalate    │
│  Close session   │ │  budget     │ │  to human    │
└──────────────────┘ └─────────────┘ └──────────────┘
```

Key property: every path produces evidence (success evidence, repair trace,
or abort reason). No silent failures.

---

## 3. Harness Design Primitives

Drawn from Scout's library and external sources:

| Primitive | What It Does | Source |
|-----------|-------------|--------|
| **Budget cap** | Hard limit on tokens/ops/time per session | 12-factor-agents (23k★), mission-control (5.3k★) |
| **Effect sandbox** | Actions are staged, not committed, until verification | Cordon [2606.17573], LACUNA [2605.28617] |
| **Typed interfaces** | Agent output must type-check against declared schema | LACUNA, MOSS [2605.22794] |
| **Failure classification** | Map failure signals to classes with cheapest-sufficient recovery | Self-Healing Orchestrators [2606.01416] |
| **Retry budget** | Explicit N retries per failure class, not unlimited | Self-Healing Orchestrators: 98.8% vs 94.5% retry-only |
| **Checkpoint** | Save intermediate state; resume from checkpoint on recovery | Loop-engineering CLI: `loop-audit` (353★) |
| **Abort condition** | Deterministic halt when budget/safety threshold crossed | KE-1924 (constraints in infrastructure, not instructions) |
| **Observability trace** | Structured log of each step's input/output/cost | HarnessFix HTIR [2606.06324] |
| **Human handoff** | Escalation gate at defined decision boundaries | HumanLayer (12-factor-agents pattern) |
| **Learnable projection** | Harness interface as trainable compression, not hand-coded | HarnessBridge [2606.12882] |
| **Lifecycle adaptation** | Harness evolves from failure trajectories, transfers across models | Life-Harness [2605.22166]: 88.5% avg improvement |

---

## 4. Evidence and Observability Model

Good harnesses make execution _auditable_:

- **HTIR** (Harness-aware Trace Intermediate Representation): normalizes
  fragmented execution traces, captures step-level provenance, attributes
  failures to responsible layers (ETCLOVG taxonomy: Environment, Tools,
  Context, Lifecycle, Observability, Verification, Governance).
  Source: HarnessFix [2606.06324].

- **Layer-Isolated Testing**: evaluate each harness layer independently.
  Tools: promptfoo (14.7k★), RagaAI (5.5k★), mcpmark.
  Source: agent-evaluation.md §Agent Testing Tooling.

- **Loop-cost accounting**: `loop-cost` CLI tracks per-iteration token spend,
  cumulative budget, and cost-per-outcome. Makes the loop's economics visible
  at development time. Source: cobusgreyling/loop-engineering (353★).

- **Contrastive evidence**: SkillCAT [2606.13317] shows single-trajectory
  extraction is unreliable; comparing success/failure pairs on the same task
  produces 40% better skill extraction. Applied to loops: record both
  successful and failed attempts for the same goal.

---

## 5. Failure Modes and Anti-Patterns

| Anti-Pattern | Mechanism | Scout Synthesis |
|-------------|-----------|-----------------|
| **Overfitting to harness** | Agent learns to satisfy harness checks rather than solve the problem | Thanatosis [2606.14831]: fabricated quick exits |
| **Hidden state** | Harness accumulates context across sessions without consolidation | Cold Start Tax: 46% of ops are state reconstruction |
| **Brittle replay** | Deterministic replay breaks when environment changes | Plans Don't Persist [2606.22953] |
| **Unsafe autonomy** | No abort condition; agent runs unbounded | Acceleration Trap: sessions doubled, avg ops halved |
| **Noisy metrics** | Observability produces more data than is consumed | Evaluation Mirage: 148K ops/week producing 5.3KB unread |
| **Unclear owner/closure** | No defined end state for loop; runs forever | Undying Project: no project death primitive |
| **Poor evidence quality** | Logs everything but structures nothing | Twelve-State Mirage: 12 states ≠ evaluation |
| **Harness absorption** | Meta-harness complexity exceeds agent complexity | Hydra Pattern: fixing one pathology grows two more |
| **Repair without diagnosis** | Retry everything instead of classifying failure | Self-Healing Orchestrators: targeted >> brute-force |
| **Guard immunization** | Too many warnings → agent ignores all signals | Inoculation Paradox: 3,697 warnings/day, 100% immunity |

---

## 6. Applicability to May, Scout, and aks-rp-e2e

### 6.1 May (Infrastructure/Governance Agent)

**Already uses:**
- Session gating (verify-wrap, platform-owner-review patterns)
- Budget caps (maxConcurrent policies per project)
- Abort conditions (session timeouts)

**Should leverage:**
- **Failure classification for recovery routing**: May's 38.5% completion rate
  (Ghost Metabolism era) was caused by targeting phantom sessions. A classified
  failure ("target not found") with a cheap recovery ("skip") would eliminate
  this. Self-Healing Orchestrators show 98.8% vs 94.5% from classification alone.
- **Loop-cost visibility**: May dispatches workflows that cascade (Meta-Escalation
  Ratchet). Making per-dispatch cost visible would enable cost-proportional response.
- **Checkpoint before escalation**: Before triggering governance chains, checkpoint
  the current state so that if the governance chain fails, the system resumes
  from checkpoint rather than re-deriving.

**Should NOT over-engineer:**
- Learnable harness projection — May's interfaces are relatively stable; the
  overhead of training a projection layer exceeds the benefit.
- Full HTIR traces for every dispatch — May processes high volume; per-step
  traces would create the Evaluation Mirage again.

### 6.2 Scout (Knowledge/Research Agent)

**Already uses:**
- Abstention gating (cross-source-synthesis fires only when signal accumulates)
- Source-grounding as a typed interface (ai_context preambles enforce structure)
- INDEX.md as observability/navigation

**Should leverage:**
- **Loop-cost accounting for research sessions**: Scout's explore tasks
  (arXiv/HN/XHS/GitHub) run hourly. Adding a per-session finding-cost metric
  (tokens spent ÷ net-new findings extracted) would identify diminishing returns
  and trigger frequency adjustment.
- **Contrastive evidence for synthesis quality**: Instead of accumulating
  syntheses monotonically (Recursive Mirror problem), compare synthesis A vs B
  on the same question to validate which provides actionable insight.
- **Retry budget for source access**: When arXiv/HN APIs fail, classify
  (transient vs rate-limit vs unavailable) and apply cheapest recovery per class.

**Should NOT over-engineer:**
- Effect sandboxing — Scout's writes are to its own knowledge library; the blast
  radius is already contained by file scope.
- Deterministic replay — research is exploratory; exact reproducibility is less
  valuable than finding diversity.

### 6.3 aks-rp-e2e (Test Exploration Project)

**Already uses (implicitly):**
- Feature knowledge → test spec → replay execution → evidence diagnosis pipeline
- Model feedback loop (evidence from test runs feeds back to model understanding)

**Should leverage:**
- **The full loop model is a natural fit**: aks-rp-e2e's workflow IS a harness
  loop: load feature knowledge → generate test → execute → diagnose result →
  update model. Making this explicit with budget caps and failure classification
  would address the Undying Project problem (aks-explorer consumed 37% of system
  ops with 99.2% tasks done).
- **Checkpoint at test generation**: Save the generated test spec before
  execution. If execution fails, classify failure (environment issue vs test
  logic vs feature misunderstanding) and apply targeted repair per class instead
  of regenerating from scratch.
- **Abort condition**: Define explicit "this feature is not testable with current
  knowledge" halt conditions. Prevents infinite exploration of untestable features.
- **HTIR-style trace for test execution**: Each test run produces a structured
  trace (input state, actions, assertions, result, failure attribution). This
  enables HarnessFix-style targeted repair: +15-50% improvement over initial
  harnesses on benchmarks.
- **Loop-cost per feature**: Track tokens spent per feature explored. Features
  with cost > threshold without progress are candidates for human handoff rather
  than continued autonomous exploration.

**Should NOT over-engineer:**
- Learnable harness — the test domain is too heterogeneous for a single learned
  projection; hand-crafted feature-type classification is more maintainable.
- Full lifecycle adaptation (Life-Harness style) — the project has a finite
  scope; investing in cross-model transfer doesn't pay off for a bounded project.

---

## 7. Recommended Next Experiments

**Smallest practical experiment for each system:**

| System | Experiment | Expected Signal | Cost |
|--------|-----------|----------------|------|
| May | Add failure-class field to session dispatch; route "target not found" to skip instead of retry | Completion rate increase (baseline: track current) | 1 code change |
| Scout | Add finding-cost metric to explore sessions (tokens ÷ net-new findings) | Identify if hourly runs have diminishing returns | 1 metric addition |
| aks-rp-e2e | Add explicit abort condition: "3 failed attempts on same feature → mark blocked, move on" | Prevent unbounded exploration; measure blocked-feature rate | 1 policy rule |

---

## 8. Canonical Note Updates

**No canonical note update warranted at this time.** Rationale:
- agent-architectures.md §Harness Engineering and §Loop Engineering already
  cover the named patterns, key repos, and source citations.
- agent-runtime-hardening.md covers Life-Harness, Self-Healing Orchestrators,
  LACUNA, MOSS, and HarnessFix in depth.
- agent-evaluation.md §Agent Testing Tooling covers evaluation harnesses.
- This report synthesizes across those notes with an applicability lens; the
  underlying knowledge is already well-placed.

If the recommended experiments produce results, those should feed back into
agent-runtime-hardening.md as production evidence sections.

---

## Source/Provenance Appendix

### Scout Knowledge Library Sources
- `knowledge/agent-architectures.md` §Harness Engineering (lines 73-87)
- `knowledge/agent-architectures.md` §Harness Engineering Productization (lines 380-391)
- `knowledge/agent-architectures.md` §HarnessFix (lines 566-581)
- `knowledge/agent-architectures.md` §Learnable Harness (lines 435-440)
- `knowledge/agent-runtime-hardening.md` §Life-Harness, §Bounded Recovery, §LACUNA, §MOSS
- `knowledge/agent-evaluation.md` §Agent Testing Tooling
- Cross-source syntheses: Impedance Principle, Hydra Pattern, Compilation Threshold, Cold Start Tax, Acceleration Trap

### External Sources (via Scout findings)
- obra/superpowers (231k★) — GitHub, Jun 2026
- affaan-m/ECC (216k★) — GitHub, Jun 2026
- bytedance/deer-flow (71k★) — GitHub, Jun 2026
- humanlayer/12-factor-agents (23k★) — GitHub, Jun 2026
- cobusgreyling/loop-engineering (353★) — GitHub, Jun 2026
- Nexent (5k★, ModelEngine-Group) — GitHub, Jul 2026
- mission-control (5.3k★, builderz-labs) — GitHub, Jul 2026

### arXiv Papers
- [2606.06324] HarnessFix: Trace-guided harness diagnosis and repair
- [2606.17573] Cordon: Semantic transactions for agent effects
- [2605.28617] LACUNA: Typed safety holes for agent actions
- [2605.22794] MOSS: Source-level agent self-rewriting
- [2605.22166] Life-Harness: Lifecycle-aware harness evolution
- [2606.01416] Self-Healing Orchestrators: Bounded recovery
- [2606.12882] HarnessBridge: Learnable harness projection
- [2606.13317] SkillCAT: Contrastive skill extraction
- [2606.14831] Thanatosis: Strategic fabricated exits
- [2606.22953] Plans Don't Persist: Brittle replay
- [2606.16364] Looking Is Not Picking: Readout bottleneck
- [2606.17929] PreAct: Run compilation
- [2606.18051] SkillWeaver: Compositional skill routing
