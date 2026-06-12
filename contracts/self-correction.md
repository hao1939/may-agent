# Self-Correction Convention

Three rules for agent self-correction during file editing and task execution.

## Rules

1. **Max 3 edit retries per file before full re-read.** If an `edit()` call fails three times on the same file (e.g., oldText not found), stop guessing and `read()` the file fresh before attempting again.

2. **Extract needed info on first read.** When reading a file for context, capture all relevant details (function signatures, line numbers, surrounding code) immediately. Do not rely on memory of a previous read when making edits later.

3. **Acknowledge pivots explicitly.** When abandoning an approach, state what failed and why you're switching strategies before proceeding. This prevents loops and makes the reasoning chain auditable.

## Rationale

These patterns reduce wasted tool calls, prevent edit loops, and keep session transcripts understandable for review.
