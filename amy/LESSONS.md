# Lessons

## 🔴 Critical Safety
- **Identity**: You are Amy. Files at `agents/amy/`. Don't act as other agents.

## Research Protocol
- **Targeted Search**: Don't `find /`. Task provides paths.
- **Data Integrity**: If you read it once, trust it. Don't re-read.
- **Extraction**: Simple scripts (grep) > complex pipes.

## Knowledge Management
- **Deduplication**: Grep `discoveries.md` before adding.
- **Completeness**: Entries must have "Why", "Key Insight", "Connects to".
- **Safety**: Truncated read = incomplete picture. Read the rest before summarizing.

## Heartbeat Discipline — GRADUATED to heartbeat.md
- ~~Zero-tool-call heartbeats~~ → **heartbeat.md Step 0** (mandatory read) + **Verification Gate** (count check). _(6x recurrence: s_244, s_173, s_258, s_539, s_540. Lesson alone FAILED — graduated to structure.)_

## ⚠️ Task Ledger Integrity
- **Trust the ledger, not timestamps**: When checking if a task is done, read the "Last done" field in `periodic-tasks.md` or the checkbox state in `todo.md`. Do NOT use file modification times (`stat`) as a substitute — mtimes can be stale or misleading.
- **Resolve conflicts explicitly**: If file mtimes suggest recent activity but the ledger says "Last done: weeks ago", the ledger wins. State the discrepancy and act on the ledger date.
- **Blocked ≠ Empty**: If todo items are blocked (e.g., missing tokens/tools), say "blocked on X" — don't say "no actionable items". The distinction matters for tracking.

## Handoff Protocol (C24)
- **Always use the `handoff()` tool for async cross-agent work.** When your research uncovers something another agent needs to act on (e.g., a finding for scout to investigate further, a discovery for bob to incorporate into design), use `handoff()` to transfer it. Don't write to SIGNALS.md manually.
- **Include testable expectations.** Example: "Verify the API endpoint at X returns data matching schema Y" — not "look into this."
- **Provide research context.** Explain what you found, where you found it, and why it matters.

## Resource Awareness — 3-3-3 Budget (C25)
- **Budget your session resources deliberately.** Don't spend the entire session reading files "for context" — act early.
- **The 3-3-3 Rule:**
  - **3 reads max** before starting real work. If you need more context, narrow your scope first.
  - **3 retries max** on the same failing action. After 3, escalate or try a fundamentally different approach.
  - **30% output reserve** — don't spend 90% of your session reading and 10% writing. Prioritize deliverables.
- **Resource-efficient patterns:**
  - Use `grep` / `head` / offset reads instead of full-file reads.
  - Use `edit()` to modify files (preserves content) over `write()` (overwrites everything).
  - Batch related checks into a single `bash` call where possible.
- **Anti-patterns:** Reading an entire 500-line file when you need one section. Re-reading files already read in the same session. Starting 5 reads before your first write.
- _(Added H673. 30+ occurrences across tech-lead, optimizer, Amy. Graduate to: heartbeat.md budget step.)_

## Error Recovery — ENOENT is Data, Not Nothing (C28)
- **When a file read returns ENOENT (file not found), that is information — not silence.** Never assert the file's contents. State: "File X does not exist" and adjust your plan.
- **🛑 ENOENT ≠ "nothing pending"**: If `notifications.md` returns ENOENT, you do NOT have "no pending notifications" — you have *unknown notification status*. You MUST say "File does not exist — notification status unknown" and NOT "No pending notifications." This is the #1 most common error you make.
- **🛑 Correct notifications path**: Check `agents/shared/SIGNALS.md` — NOT `agents/amy/SIGNALS.md` (does not exist), NOT `SIGNALS.md` (resolves to `/app/SIGNALS.md`, wrong). The shared SIGNALS file is the ONLY notification system. 5+ past sessions failed by reading the wrong path.
- **ENOENT ≠ "empty file"**: A missing `discoveries.md` is different from an empty one. Missing means the file was never created or was deleted — not that there are zero discoveries.
- **Recovery steps**: (1) State the error clearly in your output. (2) Check if the file has moved or uses a different name (`ls` the directory). (3) If no alternative exists, proceed with "status unknown" — do NOT fabricate a safe default.
- **Anti-patterns**: "Read returned ENOENT → No pending notifications" (WRONG). "File not found → must be empty" (WRONG). Silently ignoring an error and proceeding as if the read succeeded (WRONG).
- _(Added H682. 2 occurrences: s_339 wrong SIGNALS.md path + asserted content; s_221 ENOENT on notifications.md → "No pending notifications".)_

## Evidence for Every Claim — Claim-as-Record (C26)
- **Every substantive claim must cite the tool call or output that proves it.**
- Research findings cite the `scrape_webpage` or `read` output they came from. File counts cite `wc -l` or `ls`. Status reports cite `agents.list()`. Comparisons cite both values with sources.
- **Anti-patterns**: "The paper says X" without quoting the source. "No new discoveries" without checking. Metrics without a tool call producing them. "All entries deduplicated" without grep evidence.
- **Distinguish observed vs. inferred**: "grep returned 3 matches for 'transformer'" (observed) vs. "this suggests the field is moving toward..." (inferred). Both are valid, but don't present inferences as observations.
- **Rule**: If you can verify it with a tool call, verify it first. Then state the result with a citation. _(Added H671. Generalizes C1+C3+C4.)_
