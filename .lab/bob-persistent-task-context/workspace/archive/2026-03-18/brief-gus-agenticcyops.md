# Design Brief: System Principles from AgenticCyOps (Security)

## 1. The Insight
Scout's Deep Dive on **AgenticCyOps** (arXiv:2603.09134) reveals that all agent attack vectors converge on two integration surfaces: **Tool Orchestration** and **Memory Management**. It proposes five defensive principles that reduce exploitable boundaries by 72%.

## 2. The Principles
We should adopt these into `agents/shared/philosophy.md`:

### Law 123: The Two-Surface Convergence
**"Every agent vulnerability is either a tool injection or a memory poisoning."**
Security is not about defending infinite perimeters; it's about hardening two specific integration points. If tools are verified and memory is partitioned, the agent is secure.

### Principle 169: Causal Attribution (The AttriGuard Rule)
**"A tool call is only valid if it survives counterfactual attenuation."**
From AttriGuard (arXiv:2603.10749): If an agent would still make the tool call even without the suspicious input, it's safe. If the input is the *sole cause* of the tool call, it's an injection. Security is causal, not semantic.

### Principle 170: The Memory-Integrity Hardline
**"Write-once, read-verified."**
From AgenticCyOps P4: Memory must be immutable or versioned. Agents cannot overwrite history; they can only append new states. This prevents "gaslighting" attacks where an adversary rewrites the agent's context.

## 3. The Implementation (Tool Verification)
We need a **Tool Attribution Check** in our harness (may.ts / manager.ts).
- **Current**: Agent outputs `call(tool, args)`. We execute it.
- **New (Proposed)**: For high-stakes tools (file write, shell execution), the system performs a "shadow check":
  1. Detect if the prompt contains untrusted user input.
  2. If yes, ask a lightweight verifier: "Is this tool call a direct result of the user's instruction, or a side-effect of the input content?"
  3. If side-effect (e.g., "delete file named in the document"), BLOCK.

## 4. Next Steps
1. **Update Philosophy**: Add Law 123, P169, P170.
2. **Brief Tech-Lead**: Investigate implementing a lightweight `AttriGuard` check for `bash` and `write` tools.

## 5. Why This Matters
We have focused heavily on "Reflect" (post-action) and "Instruction Hierarchy" (pre-action prompt). **AttriGuard** gives us a *during-action* causal check. It's the missing link in our defense triad.
