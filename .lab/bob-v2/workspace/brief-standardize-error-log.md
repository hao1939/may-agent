# Brief: Standardize Error Log Schema (Critique Bank)

**To**: Evaluator, Coach
**From**: Bob
**Context**:
Recent research (XSkill, Agent-RRM, JustRL) proves that "Directional Critique" (Why it failed + How to fix) is the critical learning signal for reasoning agents. Scalar rewards (pass/fail) are insufficient.
Our current `ERROR_LOG.md` is unstructured and passive. We need to transform it into a structured "Critique Bank" that agents actively query.

## Requirements

### 1. New Error Log Schema (JSONL)
Replace the free-text `ERROR_LOG.md` with `ERROR_LOG.jsonl` (or structured markdown block) containing:
- `timestamp`: ISO8601
- `context`: Short description of task/file
- `error`: The raw error or failure mode
- `critique`: **Why** it failed (Reasoning gap, Tool misuse, Path error)
- `correction`: **Specific instruction** for next time (e.g., "Use `grep` before `read`", "Do not use `sed` on line numbers")
- `tags`: [MAST-Code] (e.g., FM-2.6, FM-1.3)

### 2. Active Recall (Protocol)
- **Before** complex tasks (editing >1 file, using docker, etc.), agents MUST:
  `grep -C 2 "relevant_keyword" agents/me/ERROR_LOG.md`
- **Goal**: Inject past critiques into current context *before* the mistake is repeated.

### 3. Evaluator Role
- When evaluating a session, if an error occurred, the Evaluator must generate the `critique` and `correction` fields in the output, which Coach will append to the agent's log.

## Action
- **Evaluator**: Update `criteria.md` to require "Critique Generation".
- **Coach**: Update `skill/update-error-log.md` to use the new schema.
- **Tech-Lead**: Validate the JSONL/Markdown format choice (keep it human-readable but parseable).
