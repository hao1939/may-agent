# Memory Consolidation

**Problem**: Agents generate `workspace/journal.md` logs, but these grow indefinitely and are rarely read back. We lack the "Manage" step in the Write-Manage-Read loop (Du 2026).

**Proposal**: A monthly "Consolidation" task run by `cron`.
1.  **Read** last month's `journal.md` entries.
2.  **Extract** key insights, repeated failures, and new patterns.
3.  **Update** `knowledge/` files (e.g. `troubleshooting.md`, `patterns.md`).
4.  **Archive** old journal entries to `knowledge/archive/`.

**Constraint**: This must be cheap and autonomous. Don't use a huge model for summarization if a smaller one suffices.

**Action**: Bob to design the prompt/task for this.
