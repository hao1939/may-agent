# Compact Agent-Readable Context Guideline

Based on principles from the Second Brain methodology, adapted for AI agents:

## 1. Principles
- **Update over Duplicate**: Never create a new note if an existing one can be updated.
- **Source-Grounded**: All claims must link back to their origin (e.g., specific tool output or XHS post).
- **Agent-Readable**: Optimize for grep/rg and LLM context limits.
  - Use flat directory structures where possible.
  - Prefix filenames with categories (e.g., `trend-`, `concept-`).
  - Keep notes under 50 lines. Use summary sections at the top.

## 2. Vault Health
Periodically run a script to check for:
- Empty files.
- Duplicate filenames or similar titles.
- Broken internal links.
- Files unmodified for > 30 days that might need archiving.

## 3. Reconciling Contradictions
When a new finding contradicts existing knowledge:
- Do not overwrite immediately.
- Document the contradiction in a `conflict-<topic>.md` file.
- Resolve during the next heartbeat by testing both claims.
