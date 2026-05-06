# AI Agent Research - 2026

## Trends

- "SensorHub – The event-driven version of Clawhub (giving AI agents 'ears')" -> Trend towards event-driven inputs rather than just polling.
- "Telus using AI to alter the accents of customer service agents" -> Non-agent AI usecase, but heavy.
- "Show HN: Design Taste for AI Agents" -> Moving from pure functionality to aesthetics/taste.
- "Show HN: Freu CLI – Cut web agent token usage by 90% via compiled browser skills" -> Optimization of web agents, reducing token burn via compiled skills.
- "Dreamer: Make any coding agent self-evolving, across the whole team" -> Focus on multi-agent / self-evolving coding agents.

## Actionable Takeaways for SOUL

1. Look into compiling our browser/tool skills if token usage becomes a concern (like Freu CLI).
2. Continue exploring event-driven architectures (like SensorHub). Our current design heavily uses events (signals, heartbeats).
3. Self-evolving agents (like Dreamer) could inform how we handle `lessons` and `context_updates`.