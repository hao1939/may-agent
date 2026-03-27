# Synthesis: AgentTrace & AgentCgroup — Observability & Control
*Derived from Scout Discovery (arXiv:2602.10133, arXiv:2602.09345)*

## The Insight
We treat agents as "black boxes" that emit text. We log the text. This is insufficient.
Two new papers transform how we should see the agent runtime:
1.  **AgentTrace (arXiv:2602.10133)**: Observability must be **Three-Layered** (Operational vs Cognitive vs Contextual).
2.  **AgentCgroup (arXiv:2602.09345)**: Resource control must be **OS-Level** (eBPF), not just token-counting.

## 1. The Three-Layer Log (AgentTrace)
We currently flatten everything into `session.jsonl` or `ERROR_LOG.jsonl`.
AgentTrace proposes a distinct separation that solves our "Reasoning-Action Mismatch" (FM-2.6) problem:

| Layer | Content | Nature | Our Current State |
|-------|---------|--------|-------------------|
| **Cognitive** | Thoughts, Plans, Reflection | **Intent** (Fiction) | Mixed in log |
| **Operational** | Tool Calls, Exit Codes, File Writes | **Truth** (Fact) | Mixed in log |
| **Contextual** | Prompts, File Reads, Memory State | **State** (Input) | Invisible (Implicit) |

**Design Implication**:
- We need to structure `ERROR_LOG.jsonl` to explicitly separate these fields.
- `evaluator` should score them differently:
    - **Cognitive**: Did the plan make sense? (Logic Score)
    - **Operational**: Did the tool succeed? (Execution Score)
    - **Mismatch**: Did Cognitive match Operational? (Integrity Score)

## 2. OS-Level Control (AgentCgroup)
We currently count tokens to manage cost. AgentCgroup reveals that **56-74% of latency** is OS-level (process startup, file I/O), not LLM inference.
- **Problem**: Agents spin up `node`, `python`, `git` processes blindly.
- **Insight**: Memory spikes (15.4x) cause OOMs that look like "silent failures" or "stalls".
- **Solution**: We are not ready for eBPF kernel modules, but we *can* implement **Process Budgeting**.
    - **P122 Resource Awareness**: Agents must know their OS footprint.
    - **Action**: `run_test` and `run_script` tools should report `[TIME: 200ms] [RAM: 45MB]` in their output.
    - This gives the agent feedback to optimize its own compute usage (e.g., "Don't run `npm install` inside a loop").

## Strategic Realignment

### P121: The Three-Layer Observability
*New Principle for `philosophy.md`*
> **Log Intent, Action, and State Separately.**
> Flattening logs hides the difference between what an agent *meant* to do and what it *did*.
> - **Cognitive Log**: The reasoning trace (Subjective).
> - **Operational Log**: The tool execution (Objective).
> - **Contextual Log**: The input state (Causal).
> Mismatches between Cognitive and Operational logs are the primary signal of hallucination (FM-2.6).

### P122: Resource Awareness
*New Principle for `philosophy.md`*
> **Compute is a Cost, Not a Given.**
> Agents are not just reasoning engines; they are process orchestrators.
> - Tools must report their cost (Time, RAM, Tokens) back to the agent.
> - An agent that burns 10s of CPU for a simple check is a bad agent.
> - Feedback Loops: If a tool is slow, the agent should know *why* (via cost signal) and adapt.

## Action Plan
1.  **Philosophy Update**: Delegate P121/P122 to May.
2.  **Tool Update**: Brief Tech-Lead to add `[TIME: ...]` and `[RAM: ...]` signals to `run_script` outputs. (Start with Time, easier).
3.  **Log Schema**: Brief Evaluator to propose a v2 schema for `ERROR_LOG.jsonl` that respects the Three-Layer model.
