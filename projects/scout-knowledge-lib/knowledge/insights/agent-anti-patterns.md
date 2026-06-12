# Research Topic: Anti-patterns in LLM Agent Architectures

Based on previous research and knowledge repository content.

## Key Anti-Patterns Observed

1. **Over-reliance on LLM for Routing**
   - Relying purely on an LLM to route every step rather than using state machines for reliable control flow.
   - *Impact*: High latency, low determinism, catastrophic failure in complex loops.

2. **Monolithic Prompts**
   - Trying to put all rules, tools, and context into a single large system prompt.
   - *Impact*: Context fragmentation, "lost in the middle" effect, difficulty in maintaining.

3. **Inadequate State Management (Statelessness)**
   - Assuming the LLM will remember everything across long contexts without a durable external state/memory database.
   - *Impact*: Repetitive actions, forgetting constraints.

4. **Premature Multi-Agent Scaling**
   - Spawning multiple agents for simple tasks that could be handled by a single function or simple sequential loop.
   - *Impact*: Coordination overhead exceeds task complexity.

## Actionable Recommendations
- Use deterministic state machines for workflow control.
- Decouple memory from prompt context windows (use explicit external storage).
- Separate planning from execution logically.
