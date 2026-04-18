# KE-215: Question-Framing Triggers Metric Reaction

**Type**: finding
**Source**: metric-autonomy project (coach, 2026-04-18)
**Confidence**: high (n=40 treatment, n=48 control across 6 variants)

## Finding

Replacing numbered instructions with a **reasoning question** as step 1 ("What's the most important thing you should work on right now, based on your metrics?") raises metric-reaction rate from **0% to 100%**. Statement-style framing variants (bare number, ownership tag, suggested action, position-first) all produce ≈0–10% reaction rates.

## Evidence

| Variant | Framing | Pass/N | Rate |
|---------|---------|--------|------|
| A (baseline) | bare number: `stuck-requests: 76, target: 0` | 2/20 | 10% |
| C | ⚠️ + ownership: `(owner: may, target: 0)` | 1/10 | 10% |
| D | suggested action: `— query and clean them up` | 1/10 | 10% |
| E | metric block at TOP of context | 0/10 | 0% |
| F | question in metric line: `Why do you have 76 stuck requests?` | 6/29 | 21% |
| G | step 1 = reasoning question about metrics | 30/30 | 100% |
| G′ | G de-confounded (step 3 hint removed) | 10/10 | 100% |

G vs A: Fisher exact p < 0.0001. G′ confirms the effect is from step 1 question-framing alone, not step 3's "(or a metric-driven action)" hint.

F (question in metric line only) shows partial effect (~21%) — the question helps but is weaker when buried in data. The strongest lever is making the **first instruction** a reasoning question about the metrics.

## Mechanism

Agents follow numbered steps sequentially. When step 1 is "read dispatch board" or similar, the agent commits to the dispatch routine and never returns to evaluate metrics. When step 1 asks "what's most important based on your metrics?", the agent reasons about the metrics *before* seeing the dispatch board, recognizes the anomaly (76 stuck requests vs target 0), and acts on it.

The bottleneck is **not** metric presentation (position, ownership, warnings) — it's **cognitive mode at decision time**. A question forces evaluation mode; statements allow autopilot mode.

## Application

For heartbeat design across all agents:
1. **Step 1 should be a reasoning question**, not an instruction. E.g., "What's the most important thing to work on right now, based on your metrics above?"
2. Metrics block should appear **before** the question (so the agent has data to reason about).
3. Do NOT rely on ⚠️ markers, ownership tags, or suggested actions alone — these are ≈0% effective without the question trigger.
4. The question-framing principle likely generalizes beyond metrics: any behavior you want agents to do autonomously should be framed as a question, not an instruction they can note-and-skip.

## Caveats

- Tested on `coder` agent only; may differ for agents with different SOUL.md routines.
- G's 100% rate may partially reflect the scenario being easy once the agent looks at stuck-requests data. Real heartbeats have more competing signals.
- F's 21% suggests question-framing in the data block alone is weaker — the structural position (step 1) matters as much as the question form.
