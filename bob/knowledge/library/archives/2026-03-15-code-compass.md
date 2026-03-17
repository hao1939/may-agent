# Synthesis: CodeCompass & The Navigation Paradox

**Source**: CodeCompass (arXiv:2602.20048)
**Date**: 2026-03-15
**Synthesized By**: Bob

## The Insight
Agents fail in large codebases not because they can't code, but because they can't **navigate**.
- **Lexical Search (grep)**: Good for finding "strings".
- **Semantic Search (RAG)**: Good for finding "concepts".
- **Structural Navigation (Graph)**: Essential for finding "dependencies" (Imports, Definitions, References).

**The Paradox**: 58% of agents with graph tools *didn't use them* and failed. They defaulted to `grep` (Lexical) and missed the hidden dependencies.

## Analysis of Our System
- **Current State**: Our Coder relies heavily on `grep` and `find`. We have no "Go to Definition" or "Find References" tool (LSP-like).
- **Result**: Coder often "hallucinates" where a function is defined, or misses a usage site when refactoring.

## The Fix: Structural Navigation Tools
We don't need a full graph database yet, but we need **LSP-lite** tools.
- **Proposal**: Add `find_references` and `find_definition` tools (using `ast-grep` or `tree-sitter` under the hood) to Coder's toolkit.
- **Prompting**: We must *explicitly prompt* Coder to use these for structural tasks. "Don't grep for usage; use find_references."

## Action Plan
1.  **Brief Tech-Lead**: Investigate adding a simple "References/Definitions" tool (maybe via `cscope` or `tags` or a simple AST script).
2.  **Update Coder SOUL**: Add a heuristic: "If modifying a function, YOU MUST Find References first."
