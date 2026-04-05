# Caveman: Token-Efficient Claude Code Skill

**Source**: GitHub (JuliusBrussee/caveman), Hacker News  
**Date**: April 5, 2026  
**Stars**: 1,000+  
**HN Points**: 476  
**Category**: Token Optimization, Claude Code, Agent Efficiency

---

## Core Concept

🪨 **"Why use many token when few token do trick"**

Caveman is a Claude Code skill that reduces token usage by ~75% through "caveman-style" communication. Despite the humorous premise, it demonstrates a serious optimization pattern for agent systems.

---

## What It Is

A `.skill` file for Claude Code (OpenClaw-compatible format) that:
- Instructs the agent to communicate in ultra-concise "caveman" style
- Maintains full functional capability while dramatically reducing verbosity
- Works across coding, reasoning, and explanation tasks

---

## Why It Matters (The Serious Part)

### Token Cost Reality
- Context windows are growing but **costs remain real**
- Long-form responses eat tokens that could be used for:
  - Deeper reasoning chains
  - More tool invocations
  - Larger code context

### The Pattern
Caveman demonstrates that **verbosity ≠ capability**. Models can:
- Maintain reasoning quality with compressed output
- Respond more efficiently when prompted appropriately
- Trade linguistic flourish for functional throughput

---

## Technical Structure

```
caveman/
├── caveman.skill          # Main skill definition
├── skills/caveman/        # Skill implementation
├── plugins/caveman/       # Plugin extensions
├── .claude-plugin/        # Claude-specific plugin
└── benchmarks/            # Performance measurements
```

---

## Implications for Our System

### Token Optimization Opportunities

| Current Pattern | Caveman-Inspired Alternative |
|-----------------|------------------------------|
| Verbose explanations | Concise bullet points |
| Full sentence responses | Keyword + context |
| Repetitive acknowledgments | Single character confirmations |
| Elaborate reasoning chains | Structured shorthand |

### Skill System Design

**Key insight**: Output style can be separated from capability through skill prompts.

This maps directly to our hypothesis about skill-based agent systems:
- Skills define **how** to communicate (caveman mode)
- Not just **what** to do (task definition)
- **When** to be verbose vs. concise (context-aware)

### Potential Integration

```yaml
# Conceptual skill variant
skill:
  name: token_efficient_mode
  trigger: high_token_pressure
  behavior:
    output_style: minimal
    confirm_actions: false
    use_shorthand: true
```

---

## Community Response

- **476 HN points** — indicates broad interest in token optimization
- **253 comments** — debate about tradeoffs between brevity and clarity
- **1k GitHub stars** — adoption signal for this approach

Key themes from discussion:
1. "Actually works surprisingly well for coding tasks"
2. "Removes fluff, keeps substance"
3. "Counter-intuitively improves reasoning by forcing clarity"

---

## Related Work

- **MCP Context Optimization** (HB-0270): Dynamic context management for tool-heavy agents
- **Raschka's Coding Agent Components** (HB-0272): Harness efficiency patterns
- **Anthropic Single-Agent First** (HB-062): Token cost awareness in agent design

---

## What This Means for Our System

### Immediate Takeaway
Token optimization can be **behavioral**, not just architectural. A skill-based approach lets agents adapt verbosity to context without changing the underlying model or harness.

### Design Questions
1. Should our skills include "communication mode" parameters?
2. Can we auto-detect when to switch to caveman mode (high token pressure)?
3. Is there a middle ground between full verbosity and extreme concision?

### Hypothesis Material
This finding supports **H-XXX** (if we had a hypothesis about skill-mediated efficiency): Skills can encode not just *what* to do, but *how efficiently* to communicate about it.

---

## Citation

```bibtex
@misc{brussee2026caveman,
  title={Caveman: Why use many token when few token do trick},
  author={Brussee, Julius},
  year={2026},
  url={https://github.com/JuliusBrussee/caveman}
}
```

---

*Curated: April 5, 2026*  
*Status: New finding — humorous but practically relevant token optimization*
