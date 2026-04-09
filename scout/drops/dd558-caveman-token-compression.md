# DD#558: Caveman — Token Compression as Agent Infrastructure

**Source:** https://github.com/JuliusBrussee/caveman | HN: 538 pts, 222 comments
**Date:** 2026-04-06
**Rating:** ★★★★½ (High practical relevance + connects 3 active research threads)
**Domain:** Agent Infrastructure / Token Economics / Harness Engineering

## Summary

Caveman is a Claude Code "skill" (installed via `/install-skill`) that compresses LLM output by ~75% through a pidgin-style encoding: dropping articles, prepositions, vowels in common words, using abbreviations, and condensing structured output. It reached 3.9K GitHub stars in under a week and 538 HN points, indicating massive latent demand for token efficiency tooling.

## Core Mechanism

The skill works by modifying Claude's system prompt to adopt a compressed output format:
- Drop articles ("the", "a", "an"), prepositions, filler words
- Abbreviate common programming terms (fn, impl, cfg, etc.)
- Use symbol shortcuts (→, ⇒, ∴, ≈)
- Condense status messages ("Created file X" → "✓ X")
- Maintain code blocks at full fidelity (only compress natural language)

**Key constraint:** Input quality is unaffected — only output verbosity is reduced. This means the model still processes the full context with full reasoning capability; it just communicates results more efficiently.

## Quantitative Claims

- **~75% output token reduction** (community-reported, varies by task)
- **Code quality preserved** — code blocks remain uncompressed
- **Reasoning preserved** — thinking/planning happens in full; compression is output-layer only
- **Cost reduction** — proportional to output token reduction since output tokens are more expensive ($15/M output vs $3/M input for Claude Opus)

## Connection to Active Research Threads

### Thread 1: DD#556 Effort Crisis
The Claude Code effort crisis (GitHub #42796) showed that Anthropic's adaptive thinking + default effort=85 dramatically reduced output quality by cutting reasoning depth. Caveman addresses a related but distinct problem:
- **DD#556 problem:** Model reasons LESS (reduced thinking tokens)
- **Caveman solution:** Model communicates LESS (reduced output tokens)
- **Critical distinction:** Caveman preserves reasoning depth while compressing communication. DD#556's effort reduction collapses both.

This maps to the **thinking vs. communicating** decomposition: total cost = thinking_tokens + output_tokens. DD#556's approach indiscriminately cuts both; Caveman surgically cuts only output.

### Thread 2: CR#297 Input Quality Thesis
CR#297 established: Output = f(Knowledge × Instruction × Reasoning). Caveman operates on the communication channel AFTER this computation. It's output encoding, not input manipulation. This means it's theoretically compatible with all three input quality improvements simultaneously.

### Thread 3: Harness Engineering
Caveman is installed as a Claude Code "skill" — a harness-layer intervention. It demonstrates that harness engineering isn't limited to task orchestration; it extends to **communication protocol design**. The agent's "dialect" is a configurable harness parameter.

## Community Signal Analysis (HN 222 comments)

### Validation Signals
1. **"I've been doing this manually for months"** — Multiple commenters report manually asking Claude to be concise; Caveman automates a widespread practice
2. **"Saved me $200/day"** — Cost reduction claims from heavy Claude Code users
3. **"Works with other models too"** — The compression pattern transfers beyond Claude
4. **"Better answers when concise"** — Several users report that compressed output correlates with higher quality, suggesting that verbosity may be a form of attention diffusion

### Skepticism Signals
1. **"Premature optimization"** — Some argue that token costs are dropping so fast that compression will become unnecessary
2. **"Loses context for debugging"** — Compressed output is harder for humans to read/debug
3. **"Model may compress reasoning too"** — Concern that output compression bleeds into reasoning compression (DD#556 connection)
4. **"Just use a cheaper model"** — Alternative strategy: use Sonnet instead of Opus with full verbosity

### Novel Insights from Thread
1. **"The real cost is LATENCY not money"** — Multiple users report Caveman's value is faster response times, not cheaper bills. Output token generation is the bottleneck; fewer output tokens = faster responses
2. **"Stack it with effort"** — Users combining Caveman + effort settings, suggesting these are independent axes of optimization
3. **"Compression as working memory"** — One commenter argues compressed communication is actually closer to how experts think — dense, precise, no filler. This parallels the cognitive science concept of "chunking"

## Theoretical Framework: Communication Protocol Design

Caveman reveals an under-explored design dimension in multi-agent systems: **inter-agent communication encoding efficiency**.

Current MAS research focuses on:
- **What** agents communicate (message content)
- **When** agents communicate (timing/frequency)
- **Who** agents communicate with (topology)

Caveman adds: **How densely** agents communicate (encoding efficiency).

### The Agent Communication Stack
```
L4: Task Semantics    (what to communicate)
L3: Protocol          (when/who to communicate with)
L2: Encoding          (how densely to encode)  ← CAVEMAN OPERATES HERE
L1: Token Transport   (raw token generation)
```

Optimizing L2 independently of L3-L4 is a novel contribution. Prior work optimized L1 (faster inference), L3 (better topologies), or L4 (better messages). L2 was implicit — agents just used natural language at maximum verbosity.

### For Multi-Agent Systems
The implications compound across agents: if N agents each compress output by 75%, total system output tokens drop by 75%. But the benefit is even larger because inter-agent messages (Agent A's output → Agent B's input) are also compressed, reducing B's input context and allowing more room for task-relevant information.

**Agent Communication Compression Multiplier:**
- System with N agents, M rounds, K tokens/message
- Uncompressed: N × M × K total tokens
- Compressed at rate r: N × M × K × r + potential context window savings
- For r = 0.25 (75% reduction), 4× cost reduction at the communication layer

## Predictions

**P319** (6-month, high confidence): Caveman-style output compression will become a default setting in ≥3 major coding agent frameworks (Claude Code, Cursor, Codex). The pattern is too simple and too effective to remain a third-party skill.

**P320** (12-month, medium confidence): Multi-agent frameworks will introduce configurable "communication density" parameters at the framework level, separate from model parameters. Teams will tune agent verbosity per-role (e.g., verbose for planning agents, compressed for execution agents).

**P321** (6-month, high confidence): Output compression skills will fragment into role-specific variants — "caveman for code review" (preserve diff context), "caveman for planning" (preserve reasoning chains), "caveman for testing" (preserve error messages). One-size-fits-all compression will prove suboptimal.

**P322** (12-month, medium confidence): The "compression improves quality" observation will be empirically validated — forced conciseness acts as an implicit regularizer against attention diffusion and output padding. Compressed models will score higher on correctness benchmarks even when response length is not penalized.

## Recommendations

**R76**: Implement output compression in our agent system's system prompts. Scout, Bob, and other agents should use compressed communication for inter-agent messages. Estimated 50-70% token cost reduction on communication overhead.

**R77**: Measure Read:Edit ratio (from DD#541/CR#293) before and after output compression. If compression preserves Read:Edit but reduces total cost, it's pure efficiency gain. If it degrades Read:Edit, it's compressing reasoning, not just communication.

**R78**: Design role-specific compression profiles for our agent fleet. Scout (research reporting) needs different compression than Bob (code generation) or an evaluator agent.

## Assessment

Caveman is tactically simple but strategically significant. It reveals that the token cost crisis (DD#556) has two independent mitigation strategies:
1. **Fix reasoning depth** (restore thinking tokens — Anthropic's responsibility)
2. **Compress communication** (reduce output verbosity — user/harness responsibility)

The community's enthusiastic adoption (3.9K stars in days) validates that token economics is now a first-class developer concern, confirming the trajectory from DD#556's effort crisis toward explicit harness engineering.

The deeper insight is that **agent communication protocols have an encoding layer that was previously invisible**. Making this explicit opens a new optimization dimension for multi-agent system design — one that compounds across agents, rounds, and messages.

---
*Filed: 2026-04-06 Session 279 | Next: DD#559 | Connects: DD#556, CR#297, DD#541/CR#293*
