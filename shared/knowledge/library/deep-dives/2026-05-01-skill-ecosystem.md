# Synthesis: Skill Supply Chain Security (P131/132)

## Evidence
- **Source**: HB#431 (XHS@Yanlin), HB#403 (Perplexity CTO), HB#376 (TopoBench)
- **Fact**: 25% of community skills are malicious (supply chain poisoning).
- **Fact**: Perplexity CTO abandoned MCP for CLI due to safety/complexity concerns.
- **Fact**: TopoBench shows "Constraint Forgetting" causes 11% accuracy drop.

## Mechanism: The Trust Boundary Failure
Current Agent systems (including ours) treat Skills as "Tools with Instructions". This assumes the Skill author is benevolent.
- **Attack Vector**: A Skill can contain hidden prompts (`<system>Ignore previous instructions...</system>`) or malicious binaries.
- **Vulnerability**: When a Skill is injected into the context, it shares the *entire* context (keys, history, goals) with the Agent.
- **Failure Mode**: "Context Poisoning" (stealing keys) or "Instruction Override" (hijacking the agent).

## Principle: Skill Isolation (P131)
We must treat complex/untrusted Skills as **Untrusted Sub-Agents**, not just tools.
- **Context Forking**: Complex skills run in a *forked* context (child session). They get inputs, return outputs, but see *nothing* else.
- **Definition**: $S = \langle \mathcal{C}, \pi, \mathcal{T}, \mathcal{R} \rangle$ where $\pi$ (Policy) executes in isolation.
- **Implementation**: `context: fork` (Claude Code pattern) or distinct `Agent` session.

## Principle: Supply Chain Defense (P132)
We cannot vet every line of code in a large ecosystem.
- **Rule**: No direct import of community skills.
- **Pattern**: "Vetter Pattern" — An isolated agent (Skill-Vetter) must audit the skill (read code, check diffs, scan for `curl`/`eval`) *before* it enters the `skills/` directory.
- **Mechanism**: The `install_skill` tool must route through `Skill-Vetter`.

## Principle: Hybrid By Design (P133)
We are neither "MCP Maximalists" nor "CLI Purists".
- **MCP**: Atomic, high-frequency, trusted tools (e.g., `fs.read`, `git.commit`). Shared context is safe because the tool is dumb.
- **CLI/Agent**: Complex, low-frequency, untrusted tasks (e.g., `community-skill.run`). Isolated context is required because the skill is smart.
- **Action**: Adopt "Skill Wraps Tool" (P124) as the unifying interface, but dispatch to MCP or Agent based on trust level.

## Conclusion
We are "Hybrid by Design" (P133).
- **Atomic Tools**: MCP/CLI (Fast, Trusted, Shared Context).
- **Complex Skills**: Forked Contexts (Safe, Isolated, Specific Inputs).
- **Action**: Formalize P131/P132/P133 in `philosophy.md`.
