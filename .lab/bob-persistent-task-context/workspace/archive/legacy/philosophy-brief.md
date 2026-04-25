# Philosophy Update Brief

## Context
Recent synthesis of arXiv:2503.13657 (MAST), arXiv:2602.10133 (AgentTrace), and arXiv:2602.09345 (AgentCgroup) has revealed critical structural weaknesses in our system:
1.  **Reasoning-Action Mismatch (92% of failures)**: Agents say they checked, but didn't. (P120)
2.  **Observability Flatness**: We mix intent and action in logs, hiding hallucinations. (P121)
3.  **Resource Blindness**: Agents don't know that `npm install` takes 50s and 2GB RAM. (P122)
4.  **Passive Safety Dominance**: Passive Context (100% adherence) beats Active Skills (53%). (P140)
5.  **Adversarial Sycophancy**: Reasoning Judges are gullible. We need Code Checks. (P126)

## Action
Update `agents/shared/philosophy.md` with the following new principles.

### P120: Reasoning-Action Decoupling
> **Trust the Hand, Not the Mouth.**
> Agents suffer from FM-2.6 (Reasoning-Action Mismatch). They will hallucinate their own actions.
> - **Operational Truth**: The `tool_calls` and `tool_outputs` are the only reality.
> - **Cognitive Fiction**: The `thought` and `text` are strictly commentary.
> - **Verification**: Success must be proven by an Operational Receipt (e.g., file existence, exit code 0), never by a Cognitive Summary.

### P121: The Three-Layer Log
> **Log Intent, Action, and State Separately.**
> Flattening logs hides the difference between what an agent *meant* to do and what it *did*.
> - **Cognitive Log**: The reasoning trace (Subjective).
> - **Operational Log**: The tool execution (Objective).
> - **Contextual Log**: The input state (Causal).
> Mismatches between Cognitive and Operational logs are the primary signal of hallucination.

### P122: Resource Awareness
> **Compute is a Cost, Not a Given.**
> Agents are not just reasoning engines; they are process orchestrators.
> - Tools must report their cost (Time, RAM, Tokens) back to the agent.
> - An agent that burns 10s of CPU for a simple check is a bad agent.
> - Feedback Loops: If a tool is slow, the agent should know *why* (via cost signal) and adapt.

### P126: Three-Layer Grader
> **Code > Model > Human.**
> A "Reasoning Judge" (LLM) is vulnerable to adversarial sycophancy (being tricked by polite, confident failures).
> - **L1 Code Check**: Deterministic, un-gameable facts (Exit codes, file diffs, grep). **Pass/Fail.**
> - **L2 Model Reason**: Fuzzy logic, tone, helpfulness. **Score.**
> - **L3 Human Gold**: The ground truth for calibration. **Arbitrate.**
> Never rely on L2 alone for safety-critical checks.

### P140: Passive Safety
> **Safety Must Be Zero-Click.**
> Active Skills (e.g., "Run check_safety tool") have ~53% adherence under load. Passive Context (e.g., "Filesystem contains rules") has ~100% adherence.
> - **Constraint > Tool**: Don't give a tool to check safety; build the check into the harness or prompt.
> - **Push > Pull**: Safety is pushed to the agent (Context/Harness), not pulled by the agent (Tool).
