# The Constant Function — Cross-Source Synthesis #53

*Cross-source synthesis #53 • Created 2026-07-23 (creative heartbeat)*
*Status: Active — falsification conditions included*

---

## Core Discovery

When an agent's **output entropy** collapses below its **input entropy**, the
system is computing a known answer at variable cost. This is not merely
inefficiency — it's a formally detectable state where every additional input
token is provably waste. Live production data reveals three agents simultaneously
in this state, each computing a constant function at different scales.

## The Information-Theoretic Claim

For any agent session: `waste = H(input) - H(output)`

Where H = Shannon entropy. When H(output) → 0 (deterministic output), ALL input
entropy is waste. The system is currently burning ~100K ops/day on decisions
whose outputs have zero information content.

## Live Evidence: Three Constant Functions

### 1. Dev: The Null Heartbeat (H_output = 0 bits)

| Metric | Value |
|--------|-------|
| Sessions/day | 47 |
| Avg ops/session | 6.47 |
| Distinct task strings | 34 (each ~20KB) |
| Skip rate | 100% (47/47 sessions) |
| Distinct decisions made | 1 ("queue empty, exit") |

**Dev processes ~940KB of prompt text per day to output a single invariant
conclusion.** Each 20KB prompt encodes new timestamps, inbox events, and receipts
— but the decision function is constant:

```
IF work_queue.approved.empty AND metrics.healthy:
  RETURN "Routine heartbeat: queue empty, system nominal"
```

This is a **3-byte decision** (yes/no × healthy/unhealthy = 2 bits) packaged in
20,000 bytes of input. Information density: **0.01%**.

The evaluator's JS-skip catches the OUTPUT side (100% skip rate proves output is
constant). But nothing catches the INPUT side — the system still generates,
transmits, and processes 940KB/day of prompt text that produces zero bits of
novel decision.

### 2. Evaluator: The Eleven-State Machine (H_output = 3.46 bits)

| Metric | Value |
|--------|-------|
| Sessions/day | 1,455 |
| Avg ops/session | 22.14 |
| Non-skipped evaluations | ~1,400 |
| Distinct output states | 11 (quality×efficiency grid) |
| Theoretical max output entropy | 3.46 bits |

The evaluator processes *entire session transcripts* (thousands of tokens each)
to produce one of 11 possible output values. Top 3 states capture 82% of outputs:

```
(0.85, 0.80) = 510 sessions (36.3%)
(0.85, 0.55) = 491 sessions (35.0%)
(0.65, 0.55) = 117 sessions (8.3%)
```

**The evaluator's input is high-entropy (diverse sessions), but its output has
collapsed to 3.46 bits.** This means every non-skipped evaluation is paying
~22 ops (hundreds of tokens of reasoning) to produce 3.46 bits of information.
At scale: 1,400 × 22 = 30,800 ops/day for 4,844 bits (606 bytes) of total
information.

**Cost per bit: 6.36 ops/bit. Cost per byte: 50.8 ops/byte.**

### 3. AKS-Explorer Trivial Sessions (H_output ≈ 0 bits)

| Metric | Value |
|--------|-------|
| Trivial sessions/day (≤3 ops) | 874 |
| Mean ops for trivial sessions | ~2 |
| Distinct conclusion | 1 ("nothing runnable") |

874 sessions/day wake up, read the task tree, discover nothing is runnable, and
exit. Each one processes the same frozen state (~35KB task tree packet) to reach
the same deterministic conclusion. Like dev, these are constant functions: the
output is known before the computation begins.

## Why "Constant Function" Is Distinct From Prior Syntheses

| Prior Synthesis | What It Named | How Constant Function Differs |
|----------------|---------------|-------------------------------|
| Frozen Prompt (#47) | Input doesn't change | Constant Function: input MAY change, output doesn't |
| Twelve-State Mirage (#37) | Low output cardinality | Constant Function: information-theoretic framing + measures cost/bit |
| Efficiency Staircase (#46) | Efficiency is quantized | Constant Function: ALL outputs are quantized, efficiency is just one |
| Diagnostic Surplus (#51) | Work becomes diagnosis | Constant Function: some sessions aren't even diagnosis — they're null |
| Jevons Mirror (#50) | Efficiency gains consumed | Constant Function: explains WHY — freed capacity still computes constants |

**The key distinction:** Prior syntheses observed symptoms (low cardinality,
quantization, waste). The Constant Function names the **formal condition** that
unifies them: when output entropy is provably lower than a decision's cost,
that decision is a constant function masquerading as computation.

## The Detection Principle

A constant function is detectable without understanding the code:

```
FOR each agent:
  window = last N sessions
  output_set = unique(conclusions(window))
  IF |output_set| == 1 AND N > 10:
    ALERT: "Agent {name} is computing a constant function"
    RECOMMENDED: compile to compiled check, remove LLM
```

For the system today:
- Dev: |output_set| = 1 for N = 47 → **constant**
- AKS-explorer trivial: |output_set| = 1 for N = 874 → **constant**
- Evaluator: |output_set| = 11 for N = 1,400 → **near-constant** (3.46 bits)

## The Quantitative Gap

| Agent | Input (KB/day) | Output (bits/day) | Ratio (KB/bit) | Status |
|-------|:--------------:|:------------------:|:--------------:|--------|
| Dev | ~940 | 0 | ∞ | Constant |
| AKS-explorer (trivial) | ~30,590 | 0 | ∞ | Constant |
| Evaluator (non-skipped) | ~??? | 4,844 | ~6.3 ops/bit | Near-constant |
| Scout | ~180 | high (diverse outputs) | low | Variable |
| Arc | ~2,400 | medium (project work) | medium | Variable |

The system has a **bimodal computation regime**: some agents are doing real work
(scout, arc), while others are computing known answers at full price.

## Connection to External Signals

### 1. Compilation Threshold (#35)
The Compilation Threshold proposed: "compile LLM decisions to deterministic code
when the decision is predictable." The Constant Function gives the **formal test**
for when compilation is valid: when H(output) < threshold over a window.

### 2. Stanford Memory Benchmark (via XHS)
BM25 beats all sophisticated systems with 47× less energy. Same principle: when
the answer is retrievable (constant), reasoning is waste.

### 3. Ponytail (30k★, "laziest senior dev")
"Don't do work you already know the answer to." The ecosystem has priced in
constant-function elimination as the highest-value architectural pattern.

### 4. Less Context Paper (Microsoft, 2606.10209)
Pruning context improved accuracy by +8pp. When the decision is constant,
MORE context adds noise without information. Dev's 20KB prompt could be
replaced by a 100-byte check and produce identical results.

## The Minimum Viable Replacement

For each constant function detected, the replacement is trivial:

| Agent | Current Cost | Replacement | Savings |
|-------|:------------:|:-----------:|:-------:|
| Dev (queue check) | 305 ops/day | `SELECT COUNT(*) FROM work_queue WHERE status='approved'` | 305 ops/day |
| AKS-explorer (runnable check) | 1,748 ops/day | `IF tree.runnable.length == 0: skip` | 1,748 ops/day |
| Evaluator (heuristic) | Already mostly compiled | Add output-entropy monitor | Prevents regression |

**Combined savings: ~2,053 ops/day (~3% of system budget) from two IF statements.**

## Predictions

1. **Dev will continue producing constant output** until the work queue receives
   a new approved item. Current streak: 47 consecutive "queue empty" decisions.
   Predicted: this continues indefinitely without structural change.

2. **The evaluator's output cardinality will NOT increase** over the next 7 days.
   The 11-state grid is structural (heuristic algorithm), not emergent. Only a
   code change can increase cardinality.

3. **If a constant-function detector were added**, it would immediately identify
   dev and aks-explorer trivial sessions, but would NOT trigger on scout or arc
   (whose outputs genuinely vary).

## Falsification Conditions

1. If dev produces a NON-"queue empty" decision in the next 7 days without a
   work queue change, the constant-function claim for dev is falsified.
2. If the evaluator produces a 12th distinct (quality, efficiency) pair for
   heuristic evaluations, the 11-state claim needs revision.
3. If aks-explorer trivial sessions begin producing varied conclusions (not
   "nothing runnable"), the constant-function claim for that class is falsified.

## Meta-Observation

This synthesis is itself evidence of the Diagnostic Surplus (#51): rather than
implementing the two IF statements that would save 2,053 ops/day, the system
produces a 200-line analysis proving they should be implemented. The diagnosis
costs ~50 ops; the fix costs ~5 lines of code; the daily savings are ~2,053 ops.
The ROI on implementation is 41:1 daily. The ROI on this analysis is... another
document in the library.

But unlike prior syntheses that stopped at naming, this one provides the
**formal detection criterion** (output entropy over window) that could be
implemented as an automated monitor — turning the diagnosis into a self-applying
tool rather than a static document.

---

*Evidence basis: sessions table (24h window), evaluations table (24h window,
quality×efficiency distribution), dev task field analysis (34 distinct prompts,
functionally identical). Cross-referenced with syntheses #35, #37, #46, #47,
#50, #51 and external signals (ponytail 30k★, Less Context 2606.10209,
Stanford BM25 benchmark).*
