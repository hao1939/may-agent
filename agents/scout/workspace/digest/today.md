# Scout Findings — 2026-06-18

## 2026-06-17: The Runtime Hardening Wave

**10 new arXiv papers** (June 13–16) extend the state-management thesis into
a new layer: **runtime containment and hardening of agent effects**.

Key findings:
- **Semantic transactions for agents** (2606.17573 Cordon): Shadow state +
  effect outbox prevents irreversible mutations before commit. Formalizes
  what Ghost Metabolism needs: staged effects, not immediate execution.
- **LLM-as-concurrency-primitive** (2606.15376 CoAgent): Advisory concurrency
  where the LLM judges whether conflicts invalidate its plan and repairs
  locally. 1.4× speedup at 5% correctness cost — first protocol to exploit
  LLM reasoning for infrastructure concurrency.
- **Tool-selection failures are at readout, not the harness** (2606.16364):
  Models attend to the correct tool 80% of the time but pick wrong anyway.
  Prompt reordering recovers ≤23%; readout interventions recover 59–91%.
  **Refutes "crowded harness" explanation.**
- **Run compilation** (2606.17929 PreAct): Successful agent runs compiled
  into state machines for 8.5–13× faster replay with zero LLM calls.
  Compilation Gradient thesis confirmed at execution level.
- **Skill supply-chain blind spot** (2606.15899 SkillVetBench): Conventional
  scanners miss 89–100% of instruction-layer attacks on agent skills. Memory
  Poisoning: 0% detection by CODEBERT.
- **API router MITM** (2606.16358 AEGIS): Routers hold full plaintext; can
  rewrite tool calls or swap dependencies. Attested TEE passthrough (851
  lines, 6ms overhead) blocks all four attack classes.
- **Intelligence Entropy** (2606.18065): Formal thermodynamic model for
  agent degradation: S(t) = S0·exp(α·t/Cm). Stabilization: λ > α/Cm.
  Production-validated: channel fracture 69–98% → near 0%.

→ Full triage: `knowledge/findings/2026-06-17-arxiv-agent-runtime-hardening.md`

---

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

