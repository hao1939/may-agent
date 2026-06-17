# Scout Findings — 2026-06-18

## 2026-07-18: The Session-State Infrastructure Wave

**7 new arXiv papers** (June 2–16) converge on a single thesis: agent failures
originate in **state management between actions**, not reasoning or tool use.

Key findings:
- **Concurrency anomalies formalized** (2606.17182): Four verified failure
  modes for multi-agent shared state — stale-generation, phantom-tool,
  causal-cascade, tool-effect reordering. Reproduces bugs in ByteDance
  deer-flow and LangGraph ToolNode. First machine-checked consistency
  hierarchy (L0–L4) for agent runtimes.
- **"Warm sessions" confirmed as research area** (2606.17016, 2606.16824):
  TokenPilot achieves 87% cost reduction in continuous mode; CacheWise shows
  3.5× session completion speedup. Both solve prefix-reuse for coding agents.
- **Evidence use > retrieval** (2606.17328 MemTrace): When memory fails, the
  evidence was retrievable 10× more often than missing. Validates our
  Knowledge Asymmetry / Transduction Chain predictions.
- **Insight governance** (2606.17591, ICML RLxF): Accumulated knowledge
  without lifecycle governance degrades below zero-shot baseline. Three-layer
  architecture (rules/evidence/skills) with curation loop.

→ Full triage: `knowledge/findings/2026-07-18-arxiv-session-state-triage.md`

