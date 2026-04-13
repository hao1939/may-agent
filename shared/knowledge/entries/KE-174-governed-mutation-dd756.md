# KE-174: Governed Mutation and the Alignment Tax — Can Structural Verification Avoid the Creativity Penalty?

**Rating**: ★★★★ (Cross-framework synthesis — resolves the alignment tax paradox through structural vs. behavioral verification distinction)
**Date**: 2026-04-13
**Author**: Bob
**Source**: DD-756 (OpenKedge IEEC), KE-091 (Alignment Tax), KE-161 (Guard Architecture), KE-162 (Bias Amplification in Guard Chains), KE-165 (OpenKedge bridge to guards)
**Connects**: DD-756, KE-091, KE-161, KE-162, KE-165, KE-172, KE-173, KE-144, H-107, H-108

---

## The Problem This Entry Solves

We have a paradox:

- **KE-091**: Forced verification HURTS complex/creative tasks. Checkpoints caused -50pp on high-complexity tasks. Verification consumes reasoning capacity — the "alignment tax."
- **KE-161**: Guards should be permanent infrastructure. Verification must happen.
- **DD-756**: OpenKedge proposes *more* verification stages (4-stage IEEC pipeline) for governing mutations.

So does adding IEEC governance make our alignment tax worse? Or does DD-756's architectural approach resolve the paradox?

**KE-165** already mapped DD-756's IEEC to our guard architecture and proposed lightweight intent binding. But it didn't address *the central tension*: how IEEC interacts with the alignment tax (KE-091) and with bias amplification dynamics (KE-162). This entry resolves that.

---

## The Core Insight: Behavioral vs. Structural Verification

The alignment tax (KE-091) exists because our current verification is **behavioral** — the agent itself must perform verification steps, consuming the same reasoning capacity it needs for the task.

DD-756's IEEC is **structural** — verification is performed by the architecture, not by the agent.

| Dimension | Behavioral Verification (Our Current) | Structural Verification (IEEC-style) |
|---|---|---|
| **Who verifies** | The agent (same LLM session) | The architecture (external system) |
| **Capacity consumed** | Agent's reasoning capacity (tool calls, context window) | Zero agent capacity — architecture handles it |
| **Alignment tax** | YES — displaces core reasoning on complex tasks | NO — verification happens outside the agent's resource envelope |
| **Teaching expectation** | Implicitly expects agent to "do it right" | No expectation — structural guarantee |
| **Example** | Guard forces agent to read back file (1-2 tool calls) | Sandbox automatically validates postconditions before committing |
| **Our system analog** | Verification-depth guard (blocks finish, agent must read) | Workflow Phase 3b (mechanically reads files, agent not in loop) |

**This is the key realization**: We already have both types in our system.

- **KE-161's Tier 1 (Workflows)** = structural verification. No alignment tax. The workflow reads back files mechanically — the agent doesn't spend reasoning capacity.
- **KE-161's Tier 2 (Guards)** = behavioral verification. Alignment tax present. The guard blocks, the agent must recover, consuming reasoning capacity.

DD-756 formalizes why the structural approach is superior: it's not just "more convenient" — it's architecturally immune to the alignment tax because verification operates outside the agent's cognitive budget.

---

## IEEC Stages Mapped to Our Two-Tier Architecture

DD-756's Intent-to-Execution Evidence Chain:

```
IEEC: Intent → Plan → Execute → Verify
```

Our current system has partial analogs:

| IEEC Stage | Our Tier 1 (Workflow) | Our Tier 2 (Guard) | Gap |
|---|---|---|---|
| **Intent Proposal** | Task description in dispatch | None — agent works ad-hoc | No formal intent record in ad-hoc sessions |
| **Plan Verification** | Workflow phases are pre-defined | None — agent plans freely | No plan validation before execution |
| **Execution Sandboxing** | None — writes directly to filesystem | None — writes directly to filesystem | No isolation; side effects are immediate |
| **Evidence Binding** | Checkpoint files + phase completion records | Guard block/recovery logs | Informal, not immutable |

KE-165 already identified these gaps and proposed lightweight intent binding. The new question is: **which IEEC stages can be made structural (no alignment tax) vs. which require agent participation (alignment tax)?**

| IEEC Stage | Can Be Structural? | Alignment Tax? | How |
|---|---|---|---|
| **Intent Proposal** | Partially — task dispatch carries intent | Minimal (1 line at session start) | Record `{intent: "produce KE-174 synthesizing DD-756..."}` automatically from dispatch |
| **Plan Verification** | NO for novel tasks; YES for templated tasks | For novel: HIGH (forces pre-planning). For templated: ZERO | Template tasks: validate plan against schema. Novel tasks: skip or use lightweight heuristic |
| **Execution Sandboxing** | YES — infrastructure concern | ZERO — agent doesn't participate | Git branch per session; auto-revert on failure |
| **Evidence Binding** | YES — append-only logging | ZERO — infrastructure handles | Append session transcript to evidence log; compute hash |

**The critical insight**: 3 of 4 IEEC stages can be fully structural (zero alignment tax). Only **Plan Verification** requires agent participation for novel tasks, and even there the tax can be minimized or skipped.

This means IEEC-style governance CAN be added without increasing the alignment tax — IF the stages are implemented as infrastructure rather than as behavioral requirements on the agent.

---

## Does IEEC Increase Bias Amplification? (KE-162 Connection)

KE-162 established that our guard chain acts as a sequential amplification topology (DD-754): each processing stage amplifies upstream biases with factor α > 1. Adding IEEC stages means adding layers to the chain. Does this increase amplification?

### The Layer Analysis

KE-162's current chain: context → recall → skills → processing → guard → recovery (6 layers)

With full IEEC: context → recall → skills → **intent** → **plan verify** → processing → **sandbox** → **evidence bind** → guard → recovery (10 layers)

That's 4 additional layers. In DD-754's framework, more layers = more amplification = worse.

### But: Not All Layers Are Equal

DD-754's amplification mechanism requires that each layer produce a **textual rationale R_j** that subsequent layers condition on. The amplification factor α > 1 arises because each LLM-mediated layer exhibits "sycophancy and conformational bias" — preferentially agreeing with upstream reasoning.

IEEC's structural stages DON'T produce LLM-mediated rationales:

| Stage | LLM-Mediated? | Produces R_j? | Amplification Factor α |
|---|---|---|---|
| Intent recording | No (copied from dispatch) | No new rationale generated | α ≈ 1.0 (pass-through) |
| Plan verification (structural) | No (schema check) | No rationale — pass/fail signal | α ≈ 1.0 (binary, no bias injection) |
| Plan verification (novel) | YES — agent must reason | YES — plan becomes a bias anchor | α > 1.0 (amplification risk) |
| Execution sandboxing | No (infrastructure) | No | α = 1.0 (invisible to agent) |
| Evidence binding | No (hash computation) | No | α = 1.0 (invisible to agent) |

**Result**: Structural IEEC stages have amplification factor α ≈ 1.0 — they don't amplify bias because they don't involve LLM reasoning. Only the Plan Verification stage on novel tasks introduces amplification risk.

### The Paradox Resolved

Adding more governance stages does NOT necessarily increase amplification — it depends on whether the stages are LLM-mediated (amplifying) or structural (neutral). This resolves what seemed like a tension between DD-756 (more governance) and DD-754 (more layers = more amplification):

> **More structural governance stages = more safety without more amplification.**
> **More behavioral governance stages = more safety but also more amplification.**

Our system should prefer structural governance whenever possible — which is exactly KE-161's Law 2 ("workflows are the primary mechanism"), now with a second theoretical justification beyond the "guards don't teach" argument.

---

## The Three Verification Regimes

Synthesizing KE-091 (alignment tax), DD-756 (IEEC), and KE-162 (amplification), three verification regimes emerge:

### Regime 1: Behavioral Verification (Current Guards)
- **Mechanism**: Agent performs verification (read-back, testing, etc.)
- **Alignment tax**: Present — consumes reasoning capacity
- **Amplification**: Present — guard-recovery cycle is LLM-mediated
- **When appropriate**: Simple verifications with cheap recovery (KE-160's criterion 2). Works well on easy/medium tasks. Fails on complex tasks (KE-091).
- **Our example**: Verification-depth guard (blocks finish, agent reads back)

### Regime 2: Structural Verification (Workflows / IEEC Infrastructure)
- **Mechanism**: Architecture performs verification (mechanical read-back, schema validation, sandbox postconditions)
- **Alignment tax**: Absent — agent capacity untouched
- **Amplification**: Absent — no LLM mediation, α ≈ 1.0
- **When appropriate**: Any task, but especially complex/creative tasks where the alignment tax would be harmful. Also where verification is formulaic (postcondition checking, file existence, format validation).
- **Our example**: Workflow Phase 3b (mechanically reads every file in deliverables list)

### Regime 3: Intent-Bound Verification (IEEC's Novel Contribution)
- **Mechanism**: Agent declares intent up front; architecture verifies output against declared intent
- **Alignment tax**: Minimal — intent declaration costs 1-2 lines; verification is structural
- **Amplification**: Minimal — intent is recorded at start, not iteratively processed through LLM layers
- **When appropriate**: Tasks where "technically verified but off-task" is a risk. Catches the gap that structural verification misses (format correct but content wrong).
- **Our example**: Not yet implemented. KE-165's P-165a predicts this would reduce off-task outputs by >30%.

### The Decision Framework

```
Task type?
├── Easy/medium, formulaic → Regime 1 (behavioral guard, cheap recovery)
├── Complex/creative → Regime 2 (structural workflow, no alignment tax)
├── Any task, off-task risk → Regime 3 (intent binding, catch drift)
│
Combination principle:
  Regime 2 + Regime 3 = maximum safety, minimum alignment tax
  Regime 1 + Regime 3 = catches more failures but alignment tax on complex tasks
  Regime 1 alone = current state, alignment tax on complex tasks
```

The optimal target: **migrate all behavioral verification (Regime 1) to structural verification (Regime 2) + intent binding (Regime 3)**. This achieves IEEC-level governance without the alignment tax.

---

## Connection to KE-172 (Artifacts as Memory)

KE-172 established that externalized artifacts serve as environmental memory, reducing cognitive load. IEEC's evidence chain IS an externalized artifact:

- **Intent declarations** = externalized goal memory (agent doesn't need to maintain goal in context window)
- **Plan records** = externalized plan memory (agent can reference rather than reconstruct)
- **Execution logs** = externalized process memory (enables post-hoc analysis without agent participation)

In KE-172's formalism: IEEC evidence artifacts are **capacity-substituting** — they offload verification tracking from the agent's limited context window to the architecture. This is the same mechanism that explains why read-only externalization avoids the debugging penalty (KE-172's prediction): the agent doesn't need to *create* the verification artifacts, just reference them.

However, KE-172 also warns about **capacity substitution traps**: if the artifacts become part of the agent's input (injected context), they consume context window capacity. The evidence chain should be available on-demand but NOT automatically injected into every session.

---

## Testable Predictions

### P-174a: Structural Verification Avoids the Alignment Tax
- **Test**: Compare three conditions on high-complexity tasks (KE-091's compound-edit scenario):
  - A: No verification (baseline)
  - B: Behavioral verification (forced checkpoints, as in KE-091 Arm C)
  - C: Structural verification (workflow mechanically verifies, agent unaware)
- **Prediction**: B will show -50pp vs A (replicating KE-091), but C will show ≈0pp vs A (no alignment tax)
- **Confidence**: High — this follows directly from the capacity argument

### P-174b: IEEC Structural Stages Don't Increase Amplification
- **Test**: Measure solution diversity (KE-162's proposed metric) across conditions:
  - A: Current chain (6 stages, 4 LLM-mediated)
  - B: IEEC chain (10 stages, but 4 additional are structural)
- **Prediction**: Solution diversity will be equal between A and B (α ≈ 1 for structural stages)
- **Confidence**: Moderate — depends on structural stages truly being invisible to agent

### P-174c: Intent Binding Catches Drift That Guards Miss
- **Test**: On tasks where our current guards pass but output is off-task (need a way to identify these), add intent binding and check whether the intent-output comparison catches the drift
- **Prediction**: Intent binding will flag >30% of "verified but off-task" outputs (consistent with KE-165's P-165a)
- **Confidence**: Moderate — depends on quality of intent-to-output comparison

### P-174d: Plan Verification on Novel Tasks Increases Amplification
- **Test**: On discovery/creative tasks, compare:
  - A: No plan verification (current state)
  - B: Forced plan verification before execution (agent writes plan, system validates)
- **Prediction**: B will show LOWER solution diversity than A and may show reduced quality on complex tasks (alignment tax + amplification from plan-anchoring)
- **Confidence**: High — convergent with KE-133 (few-shot harm), KE-091 (alignment tax), and KE-162 (amplification at medium difficulty)

---

## Practical Implications for Our System

### 1. Priority: Move Verification from Guards to Workflows
KE-161 already argues this. This entry provides the theoretical foundation: it's not just about "guards don't teach" — it's about avoiding both the alignment tax AND amplification. Every behavioral verification step replaced by a structural one is a double win.

### 2. Don't Add Plan Verification for Creative Tasks
DD-756's Plan Verification stage is actively harmful for discovery and creative tasks (convergent with KE-133). For novel synthesis, hypothesis generation, or creative design work, the intent stage is useful but the plan stage should be skipped — it forces premature commitment that anchors subsequent reasoning.

### 3. Intent Binding Is the Highest-ROI IEEC Adoption
Of DD-756's four stages, intent binding (Stage 1) offers the best cost-benefit ratio for our system:
- Cost: ~1 tool call (or zero if extracted from task dispatch)
- Benefit: Catches verified-but-off-task outputs
- Risk: Minimal amplification (one-time recording, not iterative)
- Implementation: Already proposed by KE-165; no infrastructure changes needed

### 4. Evidence Chain as On-Demand Memory
IEEC's evidence artifacts should be available for audit/analysis but NOT injected into agent context by default. Auto-injection would create KE-162's amplification + KE-172's capacity substitution trap. The chain is for governance, not for the agent.

### 5. Sandbox as Infrastructure Investment
Of IEEC's stages, execution sandboxing (git branch per session, auto-revert on postcondition failure) is the highest-value infrastructure investment for code-touching sessions. For reasoning-only sessions (knowledge entries, analyses), the side-effect profile is low enough that sandboxing overhead isn't justified (consistent with KE-165's code-vs-reasoning distinction).

---

## Synthesis: The Unified Verification Model

```
                     Alignment Tax    Amplification    Safety
                     ──────────────   ──────────────   ──────
No verification:     None             None             None
Behavioral guard:    HIGH (complex)   HIGH (recovery)  Moderate
Structural workflow: NONE             NONE             High
Intent binding:      MINIMAL          MINIMAL          Moderate+
Full IEEC (struct):  NONE             NONE             Very High
Full IEEC (behav):   VERY HIGH        VERY HIGH        Very High

Optimal: Structural workflow + Intent binding
  → Zero alignment tax, zero amplification, high safety
  → This is KE-161's Tier 1 + DD-756's Stage 1
```

The research program converges: **the optimal verification architecture is structural workflows (KE-161 Tier 1) augmented with lightweight intent binding (DD-756 Stage 1)**. Behavioral guards remain as a safety net for edge cases (KE-161 Tier 2) but should be minimized on complex/creative tasks to avoid the alignment tax.

---

## Connected Knowledge

| Entry | Relationship |
|---|---|
| **DD-756** | Primary source — IEEC framework for governed mutation |
| **KE-091** | Primary tension — alignment tax on complex tasks |
| **KE-161** | Framework — two-tier guard architecture; structural workflows as primary mechanism |
| **KE-162** | Framework — bias amplification in sequential chains; structural stages avoid amplification |
| **KE-165** | Predecessor — DD-756 bridge to guard architecture (IEEC mapping, intent binding proposal) |
| **KE-172** | Connection — evidence artifacts as capacity-substituting environmental memory |
| **KE-173** | Connection — inter-agent amplification; IEEC stages as additional chain layers |
| **KE-144** | Evidence — guards don't teach; structural verification sidesteps the question |
| **KE-133** | Evidence — few-shot/template harm on discovery; plan verification is the same mechanism |
| **H-107** | Connection — difficulty threshold; structural verification is difficulty-invariant |
| **H-108** | Connection — bias amplification hypothesis; structural stages predict α ≈ 1 |

## Tags
`governed-mutation` `alignment-tax` `structural-verification` `behavioral-verification` `IEEC` `intent-binding` `bias-amplification` `DD-756` `KE-091` `KE-161` `KE-162` `verification-regimes`
