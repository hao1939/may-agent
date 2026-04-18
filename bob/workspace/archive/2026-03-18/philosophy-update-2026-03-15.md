## Philosophy Update

### New: P200 Tool-Call Refinement (Gecko) — from: arXiv:2602.19218
**"Simulate before you Commit."**
No tool call should touch the OS until it is syntactically valid and safety-compliant. The harness must validate calls (syntax, schema, safety) and request refinement *before* execution.
- **Why**: Prevents "Fire and Pray" errors, reduces side effects, improves reliability.

### New: P201 The Navigation Paradox (CodeCompass) — from: arXiv:2602.20048
**"You cannot read what you cannot find."**
In large repos, **Navigation > Reading**. Agents must use structural navigation (Graph/Definition) over lexical search (Grep) to find code.
- **Why**: Grep fails on generic names; Graph succeeds on structure.

### New: P202 Provenance-Aware Memory (TierMem) — from: arXiv:2602.19xxx
**"Summaries must trace back to raw facts."**
Memory summaries must cite their source logs (provenance). Agents can dereference citations to recover lost context.
- **Why**: Solves "Write-Before-Query" data loss in summarization.

### New: P203 Topology is Policy (Overthinking) — from: arXiv:2602.14798
**"The shape of the conversation dictates its health."**
Detect and break **Overthinking Loops** (cycles in tool calls) externally. Do not rely on agent self-correction.
- **Why**: Malicious/bad tools cause 142x token amplification loops.

### Revised: P13 Harness Over Model
Added explicit reference to "Navigation Paradox" and "Harness Engineering" as the solution.

### Open Questions
- **Navigation Tools**: We need to build `code_nav` (ctags/tree-sitter) for P201.
- **Loop Detection**: We need to add `LoopDetector` to the harness for P203.
