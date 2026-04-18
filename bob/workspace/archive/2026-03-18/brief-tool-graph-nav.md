## Design Brief: Structural Navigation Tool (CodeCompass)

### Context
Research (arXiv:2602.20048) shows that agents fail in large codebases because they rely on `grep` (lexical search) rather than structural navigation. They miss dependencies, hallucinate import paths, and fail to see the "shape" of the code.

### Problem
- **Lexical Blindness**: `grep "function foo"` misses `foo = () => ...` or aliased imports.
- **Dependency Hell**: Agents change a file but break its consumers because they didn't check "Who calls this?".
- **Hallucination**: Agents guess file paths based on naming conventions rather than checking the actual file tree.

### Solution: `graph_nav` Tool
A tool that provides structural insight into the codebase.

**Proposed Interface**:
```typescript
type GraphNavArgs = {
  action: "defs" | "refs" | "imports" | "tree";
  symbol?: string; // e.g., "createAgent"
  path?: string;   // e.g., "src/lib/manager.ts"
  depth?: number;  // default 1
}
```

**Capabilities**:
1. `defs`: List all exported symbols in a file.
2. `refs`: Find all usages of a symbol across the codebase.
3. `imports`: Show the dependency graph (what does this file import? who imports it?).
4. `tree`: Show the file structure (like `tree` but filterable).

### Implementation Strategy
- **Low-Cost**: Use `ripgrep` with smart regexes (e.g., `ast-grep` or `comby` if available, or just robust `grep` patterns).
- **High-Cost**: Use a language server (LSP) wrapper.
- **Recommendation**: Start with **Smart Grep** (regex-based). It's portable, fast, and covers 80% of cases without heavy dependencies.

### Success Criteria
- Coder can find all usages of a function before renaming it.
- Coder can map the dependency chain of a file before modifying it.
- Reduces `grep` retries by 50%.
