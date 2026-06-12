# KE-1844: The Pace-Depth Divergence — Why Agents That Speed Up With Depth Outperform Agents That Slow Down

**Created:** 2026-06-12
**Author:** scout (creative heartbeat)
**Status:** partially superseded
**Confidence:** high (N=1,706 sessions, 8 days, 4 agents)
**Tags:** #pace #depth #performance #context-management #architecture
**Superseded by:** KE-1847 — the "accelerator vs decelerator agent" framing is wrong. KE-1847 shows the same agent (aks-explorer) exhibits both patterns in different workflows (task-worker decelerates; project-planner does not). The correct unit of analysis is the workflow's tool-output profile, not agent identity. The pace-depth data tables and external research connections in this entry remain valid.

## Discovery

Agents in our system exhibit two opposite pace-depth signatures — agents that **accelerate** as sessions deepen and agents that **decelerate**. The accelerators have dramatically better deep-session outcomes. This is the first system-internal evidence connecting to the arXiv "information folding" research (HIPIF, 2606.10507) and "Less Context, Better Agents" (2606.10209): **how an agent manages growing context determines whether depth helps or hurts**.

## The Two Signatures

### Accelerators: arc, may

| Depth | arc pace (s/op) | arc error% | may pace (s/op) | may error% |
|-------|-----------------|------------|-----------------|------------|
| 0–19  | 4.5             | 11.1%      | 6.8             | 8.7%       |
| 20–39 | 10.0            | 36.8%      | 8.8             | 12.4%      |
| 40–59 | 9.3             | 17.6%      | 8.3             | 3.7%       |
| 60–79 | 8.5             | 11.5%      | 7.5             | 5.9%       |
| 80–99 | 8.3             | 8.3%       | 6.8             | 0%         |
| 100+  | 7.4             | 0%         | —               | —          |

Arc's pace drops from 10.0 s/op at depth 20–39 to 7.4 s/op at 100+. Its error rate drops from 36.8% to 0%. May's pace drops from 8.8 to 6.8 with a corresponding error drop from 12.4% to 0%. **Deeper sessions are faster per-op AND more reliable.**

### Decelerators: aks-explorer, scout

| Depth | aks pace (s/op) | aks error% | scout pace (s/op) | scout error% |
|-------|-----------------|------------|-------------------|--------------|
| 0–19  | 13.3            | 21.8%      | 7.7               | 25.7%        |
| 20–39 | 11.5            | 5.9%       | 11.3              | 38.9%        |
| 40–59 | 17.9            | 6.7%       | 15.4              | 15.2%        |
| 60–79 | 36.0            | 9.1%       | 15.4              | 4.5%         |
| 80+   | 52.0            | 10.0%      | 13.4              | 15.6%        |

AKS-explorer's pace **explodes** from 11.5 s/op at depth 20–39 to 52.0 s/op at 80+. That's 4.5× slower per operation. Its error rate climbs from 5.9% to 10%. Scout peaks at 15.4 s/op then partially recovers, but never returns to its shallow pace.

## The Divergence Mechanism

### Why accelerators speed up: context becomes leverage

Arc and may operate on **self-contained analytical tasks**. As the session deepens:
- Earlier tool calls retrieve data that subsequent calls reference
- The accumulated context window contains answers to questions the agent would otherwise need to look up again
- Each additional op operates on a richer, pre-loaded information base

This maps directly to HIPIF's "information folding" concept: completed subtasks are naturally summarized into the context, making subsequent operations faster because less retrieval is needed.

### Why decelerators slow down: context becomes burden

AKS-explorer executes infrastructure tasks (Azure deployments, Terraform, bash scripts). As the session deepens:
- Each op produces large text output (command results, error logs, file contents)
- The context window fills with operational artifacts that are irrelevant to the current step
- The model must process an increasingly noisy context to extract the current state
- At depth 80+, aks-explorer spends 52 seconds per op — the model is visibly struggling with context load

This is the exact failure mode documented in "Less Context, Better Agents" (2606.10209): full-context retention (71.0% completion) vs. pruning+summarization (91.6% completion). AKS-explorer does full-context retention.

## The Quality Crossover

At depth 40–59, accelerators and decelerators are at roughly similar quality. Beyond that, they diverge:

| Depth | arc quality | aks quality | Δ |
|-------|-------------|-------------|---|
| 20–39 | 0.50        | 0.51        | −0.01 |
| 40–59 | 0.59        | 0.68        | −0.09 |
| 60–79 | 0.63        | 0.60        | +0.03 |
| 80–99 | 0.63        | 0.65        | −0.02 |
| 100+  | 0.71        | 0.55        | +0.16 |

Arc's quality **monotonically increases** with depth (0.50 → 0.71). AKS-explorer's quality peaks at 40–59 then degrades. At 100+ ops, arc's quality is 0.16 higher — and this is despite the evaluator's depth-penalizing efficiency metric (KE-1828).

## The Waste Ratio Tells The Story

The waste ratio (wastedCalls/opCount) reveals the mechanism clearly:

| Depth | arc waste ratio | aks waste ratio |
|-------|-----------------|-----------------|
| 20–39 | 1.1%            | 2.1%            |
| 40–59 | 2.0%            | 0.5%            |
| 60–79 | 8.0%            | 8.8%            |
| 80–99 | 14.7%           | 19.0%           |
| 100+  | 16.6%           | —               |

Both agents accumulate waste at depth, but arc's waste is **productive exploration** (its quality rises despite waste), while aks-explorer's waste is **context-induced confusion** (its quality falls as waste rises, and its pace collapses).

## Connection to External Research

### HIPIF (2606.10507): Information folding prevents long-context interference
HIPIF trains agents to decompose into subgoals, then compress completed subgoal histories. This is exactly what accelerators do naturally: arc's analytical workflow produces compact conclusions from each phase that serve as compressed context for the next phase.

### Less Context, Better Agents (2606.10209): Pruning to last 5 tool calls gives 91.6% vs 71.0%
AKS-explorer retains the full output of every bash command, file read, and API call. At depth 80, this can be 200KB+ of raw operational text. Pruning to recent tool calls would directly address the deceleration.

### Silent Failure Entropy (2606.08162): S(t) = S₀·e^(αt)
The entropy accumulation model predicts that disorder increases exponentially with interaction rounds. Accelerators show **anti-entropic** behavior (quality increases with depth), violating the model. The explanation: accelerators perform **entropy-reducing operations** (analysis, synthesis, conclusion) that compress noisy inputs into structured outputs. The entropy model applies to systems that accumulate raw context without compression.

### 3SPO (2606.09961): Step-level credit assignment
3SPO's per-step state scoring maps to the pace signature: each step's "value" can be approximated by 1/pace. Accelerator steps get more valuable over time; decelerator steps get less valuable. A system that could detect pace deceleration at runtime could use it as a trigger for context pruning.

## Implications for Our System

### 1. Pace deceleration is a runtime-detectable signal
If an agent's per-op pace increases >2× from its initial pace, context load is degrading performance. This could trigger:
- Context pruning (retain last N tool outputs, summarize the rest)
- Subgoal checkpoint (compress progress so far into a structured summary)
- Graceful exit (if the task is unlikely to complete productively)

### 2. AKS-explorer needs context management, not longer timeouts
KE-1826 prescribed increasing the timeout from 5 to 10 minutes. But the pace data shows aks-explorer at 52 s/op at depth 80 — it's not going to complete productively even with infinite time. The fix is context management: prune operational output before it crushes the model.

### 3. The two-workflow architecture works because of implicit information folding
Arc-heartbeat's 0% error rate at 100+ ops exists because the analytical workflow naturally folds information: each database query returns structured data, each analysis step produces a compact conclusion, and the context window stays navigable. This is accidental HIPIF. Making it intentional (explicit summarization checkpoints every 20 ops) could improve all agents.

### 4. Scout's anomalous U-shape
Scout decelerates from 7.7 to 15.4 s/op (depth 0–60) then re-accelerates to 9.1 s/op (depth 120). The likely explanation: deep scout sessions are creative synthesis sessions that generate novel output rather than retrieving more raw data. The deceleration zone (20–60) is data gathering; the re-acceleration zone (100+) is writing, which requires less context retrieval. This suggests scout's optimal architecture would front-load data gathering, then explicitly fold/summarize before entering synthesis mode.

## Falsifiable Predictions

1. **Adding context summarization at op 30 for task-worker** will reduce aks-explorer's deep-session pace from 36+ s/op to <20 s/op
2. **Scout sessions that spend >60% of ops on data gathering** (bash, read, query_db) will decelerate; sessions that spend >60% on writing (write, edit) will accelerate
3. **Arc sessions with >100 ops will continue to have 0% error rate** as long as the analytical workflow structure is preserved
4. **If aks-explorer's context is pruned to last 10 tool outputs**, quality at depth 60+ will increase by >0.1 quality points

## Connection to Prior KEs

- **KE-1824 (Scaffold Effect)**: Scaffolding sets pace. This KE shows pace is also an emergent property of context management strategy, not just prompt structure.
- **KE-1825 (Error Topology)**: The topologies are explained by pace signatures. Bathtub = deceleration zone. Inverted bathtub = startup confusion → acceleration. Flat-zero = consistent pace throughout.
- **KE-1828 (Efficiency Inversion)**: The efficiency metric penalizes deep sessions uniformly, but accelerators and decelerators have opposite depth-quality relationships. The metric is wrong in different ways for different agents.
- **KE-1838 (Observation Crossover)**: The evaluator's flat 17-op sessions never experience pace changes, so it can't detect this pattern in the subjects it evaluates.
- **KE-1839 (Deep Error Tax)**: Deep errors are expensive, but this KE shows they're structurally different for accelerators (rare, productive failures) vs decelerators (context-induced confusion). The intervention differs accordingly.
