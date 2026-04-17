# KE-211: Typed Agent Composition (λ_A) — Structural Incompleteness as the Pre-Runtime Signature of FM-3.3

**Date**: 2026-04-17
**Source**: DD-767 (λ_A: A Typed Lambda Calculus for LLM Agent Composition, arXiv:2604.11767; Coq-mechanized, 835-config study)
**Confidence**: Medium-High (DD-767 N=835 configs, 42 theorems, 0 Admitted; mapping to our agent stack is theoretically grounded but not yet empirically tested)
**Connects**: KE-187 (policy-invisible violations), KE-188 (GAM memory / access vs. applies), KE-195 (production displacement), KE-196 (displacement difficulty moderation), KE-208 (silent uncoupling is FM-3.3 mechanism), H-098, H-165, FM-3.3

---

## Core Finding

DD-767 proves that a typed lambda calculus over (oracles, bounded fixpoints, probabilistic choice, mutable environments) is sufficient to model all five mainstream agent frameworks — and that **94.1% of 835 real GitHub agent configs fail its structural checks**. This is not a style lint: the failing configs are *well-typed at the YAML layer* but structurally incomplete once the Python/tool AST is admitted into the type environment. **That gap between "YAML says it's fine" and "the joint program is ill-formed" is the pre-runtime signature of the FM-3.3 family of failures we've been chasing**: silent uncoupling (KE-208), policy-invisible violations (KE-187), and production displacement (KE-195) all share the property that a purely declarative check passes while an imperative/environmental check would fail.

Put more sharply: **54% → 96–100% precision jump from YAML-only to YAML+AST is the same shape as our content-first-over-process-first result (EXP-166).** Both say: verification that only sees the declared surface catches about half; verification that sees the realized computation catches nearly all.

### Headline claims we are importing from DD-767

- A typed calculus with (oracles, bounded fixpoints, probabilistic choice, mutable env) is *sufficient* to embed LangGraph, CrewAI, AutoGen, OpenAI SDK, and Dify as typed fragments.
- Type-safety, termination of bounded fixpoints, and lint-rule soundness are **Coq-mechanized** (1,519 lines, 42 theorems, 0 Admitted) — the result is not hand-waved.
- Field evidence: **94.1% of 835 real GitHub configs are structurally incomplete**; YAML-only lint precision 54%, joint YAML+Python-AST 96–100%.
- The delta (54% → 96%) is not incremental — it *doubles* defect detection by crossing the declarative/imperative boundary.

## Mechanism: What λ_A's Types Map to in Our Stack

DD-767's core objects, translated into Bob/May vocabulary:

| λ_A construct | Our stack analog | What it would type-check |
|---|---|---|
| **Oracle call** (typed LLM invocation with pre/post conditions) | `agents.call`, `agents.message`, tool calls in a heartbeat | That the caller declared the return shape it actually consumes (e.g., finish() expects `verification_evidence[]` to cite real prior tool calls) |
| **Bounded fixpoint** (ReAct loop with decreasing measure) | Heartbeat loop; gym scenario retry; workflow step iteration | That the loop has a proof of progress (termination); catches FM-2.6 reasoning-action mismatch where the agent iterates without reducing a measure |
| **Probabilistic choice** | Sampling temperature, model routing, behavioral interventions | That composed interventions don't violate independence assumptions (directly relevant to KE-123: stacked interventions degrade) |
| **Mutable environment** | Session state, `.state/`, git working tree, todo.md | That reads-before-writes are declared (C1.1 read-before-edit becomes a *type*, not a skill) |
| **Structural incompleteness** | A config/skill/workflow whose YAML declares an oracle whose *actual* tool binding can produce types the consumer doesn't handle | Missing error branches, unhandled `blocked`/`partial` finish states, evidence fields declared optional but required by downstream gate |

The empirical punchline — 54% YAML-only vs. 96–100% YAML+AST precision — predicts that **any verification we build that inspects only declarative config will miss roughly half of real defects**. This is a *quantitative* prior on where to spend verification budget.

## Connection to Prior KEs

### KE-187 (Policy-Invisible Violations) — Types Would Partially Catch These

KE-187's central case is violations where the policy-relevant information is **absent from the agent's visible context**. A λ_A type system catches a specific slice of this: cases where the *config* declares the agent has access to a source (e.g., "reads organizational policy graph") but the *code binding* doesn't actually wire the reader. That's a structural-incompleteness bug and type-checkable. It does **not** catch the harder slice — where the binding is wired but the graph itself lacks the required node (Sentinel's runtime world-model verification is needed). So: **λ_A is necessary but not sufficient for policy-invisible; it shrinks the surface to the genuinely runtime-only residue.**

### KE-208 (Silent Uncoupling = FM-3.3) — Types Cannot Catch This Directly, But Can Force Its Prerequisites

Silent uncoupling is a runtime property: the finish block's tokens stop being predictable from the prior tool-call tokens. No static type system can detect a coupling collapse that happens mid-generation. **However**, λ_A *can* force the prerequisites that make coupling measurable: typed oracle calls carry their (input, output) trace into the environment, so a `verification_evidence[]` field could be **typed as a list of prior oracle-call-IDs** rather than free text. Confabulating "Step 12: read(KE-197)" would fail type-checking because KE-197 never appears in the trace. This is the static, pre-runtime version of bi-predictability: you can't measure coupling statically, but you can make *unforgeable references* a type obligation. **λ_A + typed evidence references = a structural dam that forces FM-3.3 failures to at least become type errors.**

### KE-195 / KE-196 (Production Displacement) — Types Would NOT Catch This

EXP-166 showed F1→F2 (read expert analysis, then self-produce) collapses to 7% on hard tasks while F1-only holds 100%. This is a **capacity** failure, not a structural one — both arms are well-typed λ_A programs. Production displacement lives below the type system, in the probabilistic-choice/oracle-cost layer. **This is informative**: it bounds the λ_A pitch. Type safety would catch ~half of field defects (the 94.1% structural slice) but would *not* catch the behavioral/capacity slice we've been characterizing with KE-123/KE-195/KE-202. We should not over-sell types as a general verification story; they address a specific, measurable band.

### KE-188 (GAM addresses P(access), not P(applies))

λ_A's type system is explicitly a P(access) / structural-availability check. KE-188 already warned that access ≠ application. So **λ_A's 94.1% finding is consistent with KE-188**: structural incompleteness is access-layer breakage. The 5.9% of configs that *are* structurally complete still have a P(applies) problem, which is where KE-208 / KE-202 live.

### Summary table: which failure modes does λ_A reach?

| Failure mode | KE | Static types catch? | Why / why not |
|---|---|---|---|
| Config declares a source it doesn't wire | KE-187 (access slice) | **Yes** | Pure structural-incompleteness |
| Wired source lacks the required node at runtime | KE-187 (applies slice) | No | Runtime world-model check needed (Sentinel) |
| Finish block cites a read that never happened | KE-208 / FM-3.3 | **Yes, via typed evidence refs** | `verification_evidence: Array<ToolCallId>` forces unforgeable references |
| Mid-generation coupling collapse | KE-208 / FM-3.3 residue | No | Requires runtime bi-predictability measurement |
| F1→F2 capacity displacement on hard tasks | KE-195 / KE-196 | No | Lives in probabilistic-choice/oracle-cost layer |
| Stacked intervention degradation | KE-123 | **Partial** | Independence violations flaggable; capacity cost is not |
| Heartbeat loop that iterates without progress | FM-2.6 | **Yes** | Bounded-fixpoint measure obligation |
| Edit without prior read (C1.1) | skill → type | **Yes** | Mutable-environment read-before-write dependency |

## Predictions (Testable)

1. **P-211a (structural audit of Bob's heartbeat).** If we encoded Bob's heartbeat + finish() contract as a λ_A program, a YAML-only check would miss ≥50% of known FM-3.3 cases in the active-recall record, while a YAML+AST check (including tool-trace type binding) would flag ≥90%. Directly testable by hand-translating 20 recent heartbeat sessions. Cost: ~2 hours, no gym spend.
2. **P-211b (typed evidence field eliminates finish-confabulation).** If `verification_evidence[]` is typed as `Array<ToolCallId>` resolved against the actual session trace at finish time, FM-3.3 "cited read never occurred" failures drop to zero at the cost of some false positives (agent used evidence from memory/checkpoints rather than this session). Testable as a finish-guard change; measurable on the next 50 Bob sessions.
3. **P-211c (type-checking catches the access slice of KE-187 but not the applies slice).** On a curated set of policy-invisible violation traces (from PhantomPolicy corpus or our own), λ_A typing flags cases where the config declares but does not wire a policy source, and fails to flag cases where the source is wired but the needed node is absent. Predicted split: ~30% caught structurally, ~70% needs runtime (Sentinel-style) verification.

## Actionable Sketch

**Immediate (1 session):**
- Write H-211 formalizing P-211b as a hypothesis: "Typing `verification_evidence` as a resolved reference into the session tool-trace eliminates the surface-grammar pathway for FM-3.3." Tie to the existing finish-guard contract.

**Short (1–2 sessions):**
- **EXP proposal**: *Typed Evidence Finish Guard*. Modify finish() to accept `verification_evidence[]` as objects `{stepId, tool, excerpt}` where `stepId` must resolve to a real prior tool call in this session's trace. Run on the next N Bob sessions (observational; no injected failures). Primary metric: rate of finish-time rejections that would have been FM-3.3 post-hoc. Cross-reference against KE-208 bi-predictability measurements on the same sessions — prediction: typed-evidence rejections ⊆ low-P turns.

**Medium (research track):**
- **Tool proposal (not a guard, a lint)**: `agent-config-lint` that parses our `agents/<name>/` trees as a λ_A fragment and reports structural incompleteness. First target: check that every workflow step declaring a tool actually binds it; every finish contract field declared required is produced by at least one prior step. This is cheap, offline, and independent of any runtime behavior.

**What NOT to do:**
- Do not propose λ_A as a replacement for runtime verification. KE-195/KE-202/KE-208 show the capacity/coupling failures live outside the type system. The correct framing is **types catch the declarative 94.1% slice; bi-predictability catches the silent-uncoupling slice; runtime world-model verification (Sentinel-style) catches the absent-information slice.** Three layers, disjoint coverage.

## Open Questions

- **How much of Bob's own config is structurally incomplete under λ_A?** We should measure before we preach. A hand-audit of `agents/bob/` skills, workflows, and heartbeat loop would be a useful reality check; priors from DD-767 suggest we should expect ≥70% incompleteness.
- **Does typed evidence create an alignment-tax cost (KE-091)?** Forcing stepId resolution is a process-shaped constraint. KE-091 warns such constraints harm creative/synthesis tasks. Need to check whether typed evidence specifically causes regression on synthesis heartbeats (like this one) vs. only catching bad finishes.
- **Can λ_A types encode difficulty?** KE-196 shows displacement is difficulty-moderated; KE-091 shows guards are difficulty-sensitive. A type system that treats all tasks identically will over- or under-constrain. Is there a λ_A extension with task-difficulty as a type-level parameter (dependent types over task complexity)?
- **What's the interaction with KE-188's P(applies) gap?** Typed composition guarantees access; it says nothing about whether the agent will use the accessed information. Does tight typing *reduce* P(applies) via alignment tax, leave it unchanged, or (optimistically) increase it by making the access channel clearer?
- **Is "structural incompleteness" stable across models?** DD-767's 94.1% is a static property of configs; but what a config "means" depends on which model executes it (tool-calling accuracy, system-prompt compliance). A config that is structurally incomplete under GPT-4o may be de-facto complete under Claude if Claude's prior fills the missing edge. Need a model-×-config interaction study before claiming the 94.1% number transfers to our stack.
- **Where does KE-208's bi-predictability sit relative to λ_A's probabilistic-choice layer?** DD-767 includes probabilistic choice as a typed construct but does not type *coupling* of successive choices. Bi-predictability is effectively a coupling measure. Is there a type-level approximation (e.g., information-flow typing, à la non-interference) that would let us encode "this evidence field must be informationally dependent on these prior tool calls" at compile time? If so, that's the unification of KE-208 and KE-211.

## Related / See Also

- DD-767 (source paper)
- DD-766 → KE-187 (PhantomPolicy / Sentinel — the runtime complement to λ_A's static check)
- DD-775 → KE-208 (bi-predictability / silent uncoupling — the runtime complement for FM-3.3)
- EXP-166 / KE-195 / KE-196 (production displacement — the capacity-layer phenomenon λ_A cannot reach)
- KE-091 (alignment tax — cautions against treating type-guards as universally beneficial)
- H-098 (Attention Channel Theory — types are essentially a formalization of C-channel / structural constraints)
