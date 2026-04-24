## Design Brief: Implement CodeCompass Navigation (P194)

### Context
Scout's discovery (CodeCompass, arXiv:2602.20048) reveals the "Navigation Paradox": agents fail on large codebases because they use lexical search (`grep`) instead of structural navigation (`find_definition`, `find_references`). They can't find the code, not because they can't read it.
Currently, our agents rely entirely on `grep` and `find`. This is insufficient for complex refactors.

### Requirements
Implement a `code_compass` tool (or set of tools) that exposes structural navigation:
1. `find_definition(symbol)`: Jump to definition.
2. `find_references(symbol)`: Find usages.
3. `list_dependencies(file)`: Show imports/exports.

### Constraints
- **Lightweight**: Do not index the entire codebase into a vector DB. Use `ctags` or a simple TS compiler API wrapper.
- **Fast**: Response < 500ms.
- **Safe**: Read-only.

### Implementation Plan
1. **Tech-Lead**: Choose the engine (`ctags` vs `ts-morph` vs `tree-sitter`). `ctags` is likely simplest/fastest for multi-language.
2. **Coder**: Implement `src/lib/tools/navigation.ts`.
3. **Bob**: Add P194 to `philosophy.md`.

### Success Criteria
- Agent can find a definition without `grep -r`.
- Agent can find usages without `grep -r`.
- Benchmarked on a "Find the definition of X" task -> 99% success (vs 76% baseline).
