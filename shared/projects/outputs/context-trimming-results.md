# Context.md Trimming Results

## Files Trimmed (Iteration 4)

| Agent | Before (bytes) | After (bytes) | Reduction |
|-------|---------------|--------------|-----------|
| qa | 5620 | 1559 | 72% |
| coder | 4534 | 1538 | 66% |
| amy | 4349 | 1731 | 60% |
| evaluator | 3490 | 1540 | 56% |
| tech-lead | 2862 | 2174 | 24% |

All 5 files now under 2500 bytes. Average across all agents (excluding scout.bak): ~1846 bytes (~460 tokens).

## What was removed
- Redundant protocol repetitions (anti-shallow rule duplicated, finish() warnings repeated 3x)
- Verbose explanations replaced with terse bullet points
- Stale violation counts and experiment references (EXP-207, EXP-212, etc.)
- "When finish() is blocked" boilerplate (common across all agents)
- Formatting fluff (emoji headers, excessive bold/italic)

## What was preserved
- All environment setup info (paths, tools, commands)
- All mandatory protocol codes (C1.1, C1.3, C1.7, etc.)
- All skill file references
- Agent-specific knowledge (evaluation rules, QA review process, etc.)
- KE-008 and other durable knowledge entries
- SIG markers
