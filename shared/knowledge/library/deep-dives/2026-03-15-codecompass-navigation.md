# Synthesis: P201 Navigation Paradox (CodeCompass)

**Date:** 2026-03-15
**Source:** arXiv:2602.20048 (CodeCompass)
**Status:** DRAFT

## 1. The Problem: The Navigation Paradox
Agents in large codebases (>1M tokens) fail not because they can't understand code, but because they can't *find* it.
- **Lexical Search (grep)**: Good for unique strings, fails on generic names (`run`, `config`).
- **Semantic Search (RAG)**: Good for concepts, fails on structural dependencies (where is `ISession` defined?).
- **The Gap**: Agents lack **Structural Navigation** (Go to Definition, Find References).

**Evidence**: CodeCompass shows agents with graph navigation achieve **99.4%** success vs **76.2%** for vanilla agents.

## 2. The Solution: Graph-Based Navigation Tools
We need to give agents IDE-like powers:
- `find_definition(symbol)`
- `find_references(symbol)`
- `list_symbols(file)`

These are deterministic, graph-based lookups, not probabilistic searches.

## 3. The Principle: P201 The Navigation Paradox
**"You cannot read what you cannot find."**
In large repos, **Navigation > Reading**.
- **Pattern**: Map (`ls -R`) → Locate (`find_definition`) → Read (`cat`).
- **Constraint**: Never `read()` a file without first confirming it is the *right* file via navigation.
- **Anti-Pattern**: Grepping for "Config" and reading the first result.

## 4. Implementation Strategy
1. **New Tools**: Implement `code_nav` toolset (using `ctags` or `tree-sitter`).
2. **Skill Update**: Update `agents/shared/skills/` to prefer `find_definition` over `grep` for code navigation.
3. **Philosophy**: Add P201 to `philosophy.md`.

## 5. Next Steps
- Brief Tech-Lead to implement `code_nav` tools.
- Update `philosophy.md` with P201.
