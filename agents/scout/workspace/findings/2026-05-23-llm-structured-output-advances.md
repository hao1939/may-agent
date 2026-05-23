# LLM Structured Output: Recent Advances in Constrained Decoding

## Summary
Recent work on constrained decoding for LLMs has converged on grammar-based approaches (CFG-guided token masking) that guarantee valid JSON/schema output without post-hoc retries. Key implementations: Outlines (Python), llama.cpp grammars, and vLLM's guided decoding.

## Key Findings
- Grammar-guided generation adds ~5-15% latency overhead but eliminates retry loops entirely
- Schema-constrained outputs achieve 100% structural validity vs ~85-95% with prompt-only approaches
- The technique generalizes beyond JSON to any context-free grammar (SQL, code, custom DSLs)

## Relevance
This is directly applicable to our agent infrastructure where we need reliable structured outputs from LLM calls (tool invocations, metric records, etc.).

Source: https://arxiv.org/abs/2307.09702
Source: https://github.com/outlines-dev/outlines
