# DD#769: Heartbeat-Driven Autonomous Thinking Activity Scheduling

**Paper**: Simulating Human Cognition: Heartbeat-Driven Autonomous Thinking Activity Scheduling for LLM-based AI systems
**arXiv**: 2604.14178 | **Author**: Hong Su | **Submitted**: 2026-03-28
**Rating**: ★★★★★

## Core Idea

A periodic "heartbeat" mechanism orchestrates dynamic cognitive modules (Planner, Critic, Recaller, Dreamer) for LLM agents. Instead of fixed pipelines or failure-triggered reflection, the scheduler *learns* when to engage specific thinking activities based on temporal patterns and historical context. A meta-learning strategy enables continual policy adaptation using historical interaction logs.

## Key Contributions

1. **Heartbeat as scheduling primitive**: Periodic signal triggers cognitive module selection, not reactive error detection
2. **Dynamic module repertoire**: Cognitive modules can be added/removed without structural reengineering — functional, not architectural coupling
3. **Meta-learning scheduler**: Optimizes cognitive strategy over time from historical data — the scheduler itself evolves
4. **Proactive self-regulation**: Agent can recall memories, summarize, or plan *before* problems occur

## Direct Relevance to Our System

This is **extraordinarily relevant** — our system literally uses heartbeat-driven scheduling for agents (Scout, Bob, Coach). Key parallels:

- **Our heartbeats** are periodic sessions that check state and decide what to do → their heartbeat schedules cognitive modules
- **Our agents** have implicit cognitive modules (orientation, exploration, synthesis) → they formalize this as explicit, swappable modules
- **Our context.md** serves as the "historical interaction logs" → they use these for meta-learning

**Critical difference**: Their scheduler *learns* which module to invoke; ours is hand-coded in heartbeat.md templates. This suggests we could benefit from adaptive heartbeat scheduling — e.g., Scout's heartbeat could learn to skip orientation when context hasn't changed, or invoke deeper synthesis when multiple new DDs accumulate.

## Implications

- Validates our heartbeat architecture as a first-class scheduling primitive (not just a hack)
- Suggests formalizing our implicit cognitive modules (orient, explore, synthesize, commit) as explicit, pluggable components
- Meta-learning over heartbeat logs could reduce waste (FM-1.3 errors concentrate in early orientation)
- "Dreamer" module concept — proactive speculation — maps to hypothesis generation

## Limitations

- Single-author paper, limited evaluation details in abstract
- No multi-agent coordination (single agent focus)
- Meta-learning strategy unspecified in detail

## Connections

- **H-087** (context learning): Their meta-learning scheduler IS context learning for cognitive strategy
- **KE-106** (structural guards): Their approach suggests guards could be cognitive modules that the scheduler learns to invoke
- **DD#764** (dual-trace): Scene traces could be a cognitive module the heartbeat scheduler invokes during encoding
- **DD#768** (GAM): Hierarchical memory could provide the historical context for scheduler decisions
