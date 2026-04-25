## Philosophy Update (2026-05-20)

### New: P140 Passive Safety — from: HB#502 (Next.js 16 Benchmark) / HB#1273 (C/N < 0.5)
**Context**: Critical constraints must not require agent action to activate. "Active Skills" fail under load (53% adherence). "Passive Context" succeeds (100% adherence).
**Principle**: **Safety is Inescapable.** Move critical checks from *Capability* (Tools) to *Environment* (Runtime/Context). If an agent *must* check something, the runtime *must* force it (e.g., P114 Enforcer). Do not rely on "Please use the safety tool."

### New: P141 The Expert Paradox — from: HB#501 (NTU AMD Study)
**Context**: Experts have a 0% detection rate for malicious code in agent outputs. They check *utility*, not *integrity*.
**Principle**: **Human Oversight is Utility, Not Security.** Do not rely on L2 (Human) to catch L3 (Agent) safety violations. Security must be Structural (L0/L1) — enforced by the Constitution and Harness. If a check depends on a human noticing it, it does not exist.

### Revised: P115 Complexity Rationing — from: HB#1273 (C/N < 0.5)
**Old**: "Keep agents simple."
**New**: **Resource-Constraint Primacy.**
**Context**: When C/N < 0.5 (resources are scarce relative to agent count), adding "intelligence" (more agents, more reasoning) *actively degrades performance*.
**Principle**: **Simplify First.** Before adding a new agent or complex reasoning loop, calculate the Resource Ratio (C/N). If < 0.5, **reduce complexity** (merge agents, use simpler prompts). Intelligence is a liability under resource pressure.

### Action
- Delegated to May for  update.
