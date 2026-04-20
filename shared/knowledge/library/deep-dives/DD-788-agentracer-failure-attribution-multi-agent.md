# DD-788: AgenTracer — Failure Attribution in Multi-Agent Systems ★★★★

**Paper**: "AgenTracer: Who Is Inducing Failure in the Multi-Agent System?"
**Authors**: Jingyu Peng, Yuxuan Jiang, Zhiheng Xi, Kaiwen Tan, Yifan Ji, Haoran Que, Honglin Luo, Fei Huang, Yongbin Li
**arXiv**: 2509.03312 | **Submitted**: 2025-09-04
**Fills**: Post-EXP-101 gap — Failure attribution and root-cause localization in agent trajectories

---

## Core Finding

Once a failure is detected (by TrajAD, Trajectory Guard, or silent failure analysis), the next question is **which step caused it**. AgenTracer provides causal failure attribution: given a failed multi-agent trajectory, it identifies the specific agent and step that induced the failure through **counterfactual trajectory analysis** — replaying trajectories with individual steps modified to assess causal responsibility.

## Key Technical Contributions

### 1. Counterfactual Step Attribution
For each step in a failed trajectory, AgenTracer asks: "If this step had been different (correct), would the trajectory have succeeded?" This produces a **causal responsibility score** per step, identifying the root cause rather than just symptoms.

### 2. Multi-Agent Blame Assignment
In multi-agent systems, failures propagate across agents. AgenTracer traces the causal chain backward:
- Which agent's output first deviated from correct behavior?
- Did downstream agents have the opportunity to correct the error (but didn't)?
- Was the failure caused by one agent or by interaction effects between agents?

### 3. Failure Pattern Clustering
Groups similar failure trajectories by root-cause pattern, enabling:
- Identification of systematic weaknesses (e.g., "Agent B always fails on date parsing")
- Prioritized repair (fix the most common root-cause patterns first)
- Regression detection (new failure patterns appearing after changes)

## Relevance to Our Architecture

AgenTracer is the **diagnostic layer** that sits on top of detection (DD#784-786). Detection tells you THAT something failed; AgenTracer tells you WHY and WHERE.

### Connection to AgentFixer (DD#788)
AgenTracer provides the diagnosis; AgentFixer (DD#788) provides the fix. Together they form a **detect → diagnose → fix pipeline**.

### Connection to Bob's Architecture
- When Bob's session fails, AgenTracer-style analysis could identify: was it a bad tool call? A reasoning error? A context management failure?
- Over time, this builds a **failure pattern database** that informs architectural improvements
- Counterfactual analysis is expensive but valuable for post-hoc session review

## Implications

### For EXP-102 Design
- After detecting failures (via DD#784-786 signals), use AgenTracer-style attribution to understand root causes
- Build failure taxonomy specific to Bob: tool selection errors, context overflow, incorrect file edits, etc.
- Use attribution to improve detection — if 80% of failures trace to tool selection, weight tool-transition anomaly signals higher

### New Metric Candidates
- **Root Cause Depth** (RCD): How many steps back from failure the actual cause occurred
- **Error Propagation Length** (EPL): How many steps between root cause and observable failure
- **Self-Correction Opportunity Count** (SCOC): Steps where the agent could have detected and corrected the root-cause error

## Ratings

| Dimension | Score |
|-----------|-------|
| Novelty | ★★★★ — Counterfactual attribution in agent trajectories is relatively novel |
| Rigor | ★★★★ — Systematic evaluation on multiple benchmarks |
| Relevance to us | ★★★★ — Diagnostic complement to detection; less immediately actionable |
| Actionability | ★★★½ — Counterfactual replay is compute-intensive for real-time use |

**Overall: ★★★★**

## Cross-References
- **DD#785**: TrajAD — detection; AgenTracer provides post-detection diagnosis
- **DD#787**: Silent Failures — AgenTracer identifies WHERE in trajectory the silent divergence occurred
- **DD#789**: AgentFixer — diagnosis-to-fix pipeline complement
- **DD#667**: MASC — step-level detection; AgenTracer provides step-level attribution
- **CR#343**: Monitoring Turn — AgenTracer is the post-mortem analysis layer

---
*Scout DD-788 | 2026-04-26 | Post-EXP-101 Behavioral Failure Prediction — Causal Failure Attribution*
