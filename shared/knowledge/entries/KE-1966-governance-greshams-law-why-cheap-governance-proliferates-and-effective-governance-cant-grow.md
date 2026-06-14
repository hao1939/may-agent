# KE-1966: Governance Gresham's Law — Why Cheap Governance Proliferates and Effective Governance Can't Grow

**Type:** synthesis  
**Created:** 2026-06-20  
**Source:** Production data (8,885 guard triggers, 14,237 evaluations, 1,485 KE entries, 20-day window), KE-1946 (Anabolism Bias), KE-1956 (Instruction Ratchet), KE-1958 (Oversight Inverted-U), KE-1960 (Governance Reversal), KE-1964 (Reference Signal Gap), KE-1965 (Guard Paradox), arXiv (EvolveR arXiv:2510.16079, SGCD 2606.12634, Oversight Capacity 2606.08919), HN (Harness Engineering crystallization, 27% self-repair audit), XHS (EvolveR credit scoring as breakthrough)  
**Connects:** KE-1946, KE-1956, KE-1958, KE-1960, KE-1964, KE-1965

<ai_context>
Cross-KE synthesis revealing a single generative mechanism behind six previously-identified pathologies. The system has five layers of governance arranged on a hardness spectrum from structural blocks (100% enforcement, 0.4% of volume) to knowledge entries (0% consumption, growing monotonically). Production cost decreases as enforcement strength decreases. This creates a Gresham's Law dynamic: the system produces more of what it enforces less, because that's what's cheapest to produce. Over time, governance volume grows while governance effectiveness per unit decreases. Six recent KEs (1946, 1956, 1958, 1960, 1964, 1965) each document a specific consequence of this single mechanism. The escape requires either promotion (converting validated soft governance into hard governance) or sunset (removing ineffective soft governance) — both mechanisms the system currently lacks.
Triggers: governance effectiveness, Gresham's Law, enforcement spectrum, production cost, soft governance, hard governance, signal-to-noise, guard effectiveness, knowledge consumption, governance accumulation
Related: KE-1946, KE-1956, KE-1958, KE-1960, KE-1964, KE-1965
</ai_context>

---

## Discovery

KE-1946 through KE-1965 each diagnosed a distinct system pathology: unbounded growth (1946), one-way instruction ratcheting (1956), evaluator saturation (1958), output-focused governance (1960), missing reference signals (1964), and warning ineffectiveness (1965). This entry identifies the single generative mechanism behind all six: **the inverse relationship between how easy a governance mechanism is to produce and how effective it is at changing behavior**.

This is Gresham's Law — "bad money drives out good" — applied to agent governance: cheap-to-produce governance mechanisms proliferate, burying the expensive-but-effective ones in noise.

## The Enforcement Gradient

The system has five distinct layers of behavioral governance. They form a spectrum:

| Layer | Example | Enforcement | Volume (3-day) | Production cost |
|-------|---------|-------------|-----------------|-----------------|
| **1. Structural blocks** | FM-3.4 Persistent-Task Required | 100% — session halted | 39 triggers (0.4%) | Requires code change (high) |
| **2. Infrastructure constraints** | Tool timeouts, opCount limits | 100% — structurally impossible to violate | Invisible | Requires infrastructure engineering (high) |
| **3. Heuristic evaluation** | Deterministic verdict rules | ~25% triggers rework | ~7,000 evals | Requires rule authoring + deployment (medium) |
| **4. Advisory warnings** | READ_DEDUP, UNCOMMITTED_FILES | 38% first-compliance, 0% enforcement | 8,885 triggers | Requires config entry (low) |
| **5. Compiled knowledge** | KE entries, instructions, lessons | 0% consumption (KEs since May 7) | 1,485 KEs, growing | Requires writing text (trivial) |

The pattern is monotonic:

- **Enforcement decreases** from 100% → 0% moving down the stack
- **Volume increases** from 39 → 8,885 → unbounded moving down the stack  
- **Production cost decreases** from infrastructure engineering → text generation moving down the stack

## The Gresham's Law Mechanism

This gradient isn't static — it has a directional dynamic. The system's self-improvement processes (lesson learning, knowledge creation, guard additions, instruction compilation) all produce output into the cheapest layers:

| Self-improvement process | Produces into | Layer |
|--------------------------|--------------|-------|
| Session lesson learning | Compiled instructions | 5 (cheapest) |
| Scout knowledge creation | KE entries | 5 (cheapest) |
| Error response | New advisory warnings | 4 (cheap) |
| Evaluator aftermath | Heuristic rule tweaks | 3 (medium) |
| Human intervention | Structural blocks / infrastructure changes | 1-2 (expensive) |

**The system can only learn into layers 3-5.** Layers 1-2 require human engineering. This means the system's own learning process systematically increases the volume of its least effective governance while leaving its most effective governance unchanged.

Over time, the ratio shifts:

```
                       Effective but scarce
    Blocks:  ██  (39 triggers, 100% enforcement)
    
    Heuristic eval:  ██████████████████████████  (~7,000 evals, 25% actionable)
    
    Warnings:  ██████████████████████████████████████████  (8,885 triggers, 38% → 0%)
    
    Knowledge: ██████████████████████████████████████████████████████████ (1,485+ entries, 0% consumed)
                       Cheap but ineffective ↓↓↓ (all growth happens here)
```

Each day, the system adds more warnings, more lessons, more KE entries. It adds zero new structural blocks. **The denominator of governance effectiveness grows while the numerator stays fixed.**

## Why This Is Not Just KE-1946 (Anabolism Bias)

KE-1946 identified that the system can grow but can't shrink. KE-1966 identifies *why growth is systematically misdirected*: it's not just that the system grows — it's that it grows fastest in the layers that matter least.

The difference is the enforcement gradient. If all governance layers were equally effective, unbounded growth would still be costly (more to process) but not pathological. The pathology arises because growth is concentrated in the least effective layers, creating a signal-to-noise decay:

| Metric | Signal | Noise | S/N ratio |
|--------|--------|-------|-----------|
| Guard triggers | 39 blocks | 8,846 warnings | **1:227** |
| Evaluations | 27 low_quality findings | 14,210 acceptable/good | **1:526** |
| Knowledge entries | 0 consumed by agents | 1,485 in library | **0:1,485** |

The knowledge layer has **literally zero signal** — not because the entries are bad, but because no mechanism promotes them into layers where enforcement exists.

## The Six KEs as Consequences

Each recently identified pathology is a predictable consequence of Governance Gresham's Law operating at a specific layer:

| KE | Pathology | Layer affected | Gresham's mechanism |
|----|-----------|----------------|---------------------|
| **KE-1946** (Anabolism Bias) | System can only grow | All soft layers | Cheap governance is easy to add, impossible to remove |
| **KE-1956** (Instruction Ratchet) | "Do more" compiles, "do less" doesn't | Layer 5 (instructions) | Instructions are the cheapest governance to produce; each error adds one, nothing removes any |
| **KE-1958** (Oversight Inverted-U) | Evaluator past the safety peak | Layer 3 (evaluation) | Heuristic rules accumulate; each new rule adds volume but marginal discrimination is near zero |
| **KE-1960** (Governance Reversal) | Outputs scrutinized, inputs ungoverned | Layers 3-5 vs 1-2 | Input governance requires infrastructure engineering (expensive); output governance can be done with rules and text (cheap) |
| **KE-1964** (Reference Signal Gap) | Self-referential learning plateaus | Layers 4-5 | Self-improvement produces soft knowledge; promoting it to hard constraints requires external validation the system can't perform |
| **KE-1965** (Guard Paradox) | Warnings are diagnostic, not corrective | Layer 4 (warnings) | Warning guards are cheap to add; block guards require engineering; so warnings proliferate while blocks don't |

One mechanism. Six symptoms.

## The Evaluator Disagreement as Evidence

Production data reveals a structured pattern that confirms the Gresham's dynamic. The heuristic evaluator (layer 3, high-volume, cheap) and the LLM evaluator (layer 3, low-volume, expensive) disagree systematically by agent:

| Agent | Heuristic NI rate | LLM negative rate | Gap | Direction |
|-------|-------------------|-------------------|-----|-----------|
| **arc** | 32.2% | 10.1% | **3.2×** | Heuristic too negative |
| **scout** | 25.4% | 6.6% | **3.9×** | Heuristic too negative |
| **aks-explorer** | 22.7% | 16.0% | **1.4×** | Heuristic too negative |
| **may** | 22.7% | 27.5% | **0.8×** | LLM more negative |

The heuristic (accumulated rules, cheap to add) is 1.4-3.9× more negative than the LLM for three agents, but the LLM is actually *more* negative for may. This isn't random noise — it's the Gresham's effect at the evaluation layer. The heuristic has accumulated rules that penalize arc's high opCounts and scout's re-reads, but these are legitimate behaviors for those agents. Each rule was individually rational when added, but the accumulated weight produces systematic false positives.

May is the exception because may's characteristic failures are content-level (wrong routing, stale triggers) that structural heuristics happen to catch. The heuristic's accumulated rules are accidentally well-calibrated for may.

The quality score gap tells the same story:

| Agent | Heuristic quality score | LLM quality score | Gap |
|-------|------------------------|-------------------|-----|
| arc | 0.58 | 0.75 | **+29%** (LLM sees higher quality) |
| scout | 0.65 | 0.74 | **+14%** (LLM sees higher quality) |
| may | 0.65 | 0.63 | **-3%** (they agree) |

The heuristic underrates arc by 29% and scout by 14% because its accumulated rules penalize their working patterns. These false negatives then trigger rework → more evaluator sessions → more compute in the oversight layer → further reducing the system's effective capacity.

## What External Research Says

Three independent solutions from the June 2026 arXiv window each address Governance Gresham's Law at a different layer:

### EvolveR (ICML'26): Credit Scoring = Soft Governance Sunset

EvolveR's credit scoring mechanism is precisely the missing sunset mechanism for layer 5. Each knowledge entry gets a credit score based on downstream usefulness. Low-credit entries are pruned. This prevents cheap knowledge from accumulating without bound.

**Mapped to our system:** Track which KE entries are actually read (file_reads table) and which instructions actually correlate with session success (evaluations table). Entries/instructions with zero downstream reference in 30 days get flagged for removal. The data already exists — it just isn't fed back.

### SGCD: Contrastive Distillation = Higher-Quality Production

SGCD's sibling-guided distillation produces fewer but better lessons by comparing successful and failed trajectories. Instead of "everything in a successful session was good" (cheap, low-quality), it identifies "this specific step was the difference" (expensive, high-quality).

**Mapped to our system:** Instead of compiling every error into a new instruction (layer 5 proliferation), compare sessions where the same agent succeeded and failed on similar tasks. What differed? Compile only the causal difference. This produces less governance but higher-quality governance.

### Harness Engineering (HN consensus): The Hard-Layer Bet

The emerging HN consensus around "harness engineering" is an explicit bet on layers 1-2. The harness (sandboxing, permissions, rollback, budget caps) is infrastructure — expensive to build but 100% enforced. The HN community is independently discovering that soft governance (prompts, instructions, warnings) doesn't scale, and the product is the hard constraint layer.

## The Escape: Promotion and Sunset

Governance Gresham's Law has two escapes, both currently absent:

### 1. Promotion: Soft → Hard

When soft governance proves its value, promote it:
- A KE insight confirmed 5+ times → becomes a heuristic evaluator check (layer 3)
- A warning with persistent 0% compliance → either upgrade to block (layer 1) or remove
- An instruction that measurably reduces errors → encode in infrastructure (layer 2)

### 2. Sunset: Soft Governance Decay

Soft governance that isn't consumed should decay:
- KE entries unread for 30 days → archived, removed from retrieval
- Instructions that don't correlate with success → flagged for pruning
- Warnings with <10% compliance → removed (they've been absorbed or are wrong)

Without these mechanisms, the system will continue to accumulate governance volume in the layers where it matters least, while the layers where it matters most remain frozen at their human-engineered state.

## The Testable Prediction

If Governance Gresham's Law is correct:

1. **The ratio of soft-to-hard governance will increase monotonically** — more KEs, more instructions, more warnings per structural block, indefinitely
2. **Heuristic evaluator false-positive rate will increase** as rules accumulate — arc and scout negative rates will diverge further from LLM rates
3. **Adding more knowledge entries will not improve agent behavior** — the consumption rate will remain 0% regardless of quantity, because the mechanism is layer placement not volume
4. **Removing the bottom 50% of advisory warnings would have no measurable effect on session outcomes** — the warnings being removed already have 0% behavioral impact

---

*The system that learns the most is the system that enforces the least. The system that enforces the most has stopped learning. This is the governance dilemma: production cost and enforcement strength are inversely correlated, and no amount of cheap governance can substitute for expensive governance.*
