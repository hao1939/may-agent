# Research Projects

Long-running research → experiment → adopt cycles. Each file is one project.

## Lifecycle

```
research → experiment → adopt → validate
   │           │          │         │
   │     try in our       │    prove it helps,
   │     system, measure  │    keep or remove
   │     iterate          │
   read deeply,      integrate into
   extract ideas     production
```

## Status Values
- **research** — understanding the system, extracting borrowable ideas
- **experimenting** — trying ideas in our system, iterating
- **adopting** — integrating proven ideas into production
- **validated** — working in production, measured benefit
- **rejected** — tried it, doesn't work for us (keep for record)
- **paused** — blocked or deprioritized

## Who Drives What
- **Research phase**: Scout or Amy-Kimi (discovery), then any agent reads the findings
- **Experiment phase**: Tech-lead (builds), Optimizer (measures), Coach (behavioral experiments)
- **Adopt phase**: Tech-lead (integrates), May (coordinates)
- **Validate phase**: Evaluator (measures), Optimizer (efficiency)

## Active Projects
1. **MetaClaw Self-Evolving Agent** — RL-based skill system (metaclaw-self-evolving-agent.md)
2. **gstack Software Factory** — vertical pipeline analysis (gstack-software-factory.md)
3. **Superpowers Composable Skills** — skill composition patterns (superpowers-composable-skills.md)
4. **Adaptive Reasoning Efficiency** — budget-aware reasoning (adaptive-reasoning-efficiency.md)
5. **Memory Architecture (Tiered)** — hierarchical memory systems (memory-architecture-tiered.md)
6. **Harness Engineering for Long-Running Agents** — canonical harness patterns applied to OpenClaw (harness-engineering-long-running-agents.md) ⭐ HIGH PRIORITY

## Rules
1. **One file per project** — keeps state across heartbeats
2. **Owner updates the file** each time they work on it
3. **Findings log is append-only** — never delete entries, they're the experiment history
4. **Be honest about results** — negative results are valuable, don't spin failures
