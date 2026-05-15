# Parser Wiring: cc-worker and codex-worker

## What Changed

Both `agents/master/tools/cc-worker.ts` and `agents/master/tools/codex-worker.ts` were
updated to use their corresponding stream parsers (`cc-stream-parser.ts` and
`codex-stream-parser.ts`) instead of inline ad-hoc JSON line parsing.

### cc-worker.ts
- **Added** import of `parseCCStream` and `formatEnvelope` from `./cc-stream-parser`.
- **Replaced** mixed `chunks[]` array (stdout + stderr interleaved) with separate
  `stdoutChunks[]` and `stderrChunks[]`.
- **Removed** inline per-line JSON parsing in the `stdout.on("data")` handler
  (session_id extraction, result/assistant text tracking).
- **Replaced** the `close` handler logic: now calls `parseCCStream(stdout, stderr, code)`
  and returns `formatEnvelope(envelope)`.
- Session ID is extracted from `envelope.session_id` instead of an inline variable.

### codex-worker.ts
- **Added** import of `parseCodexStream` and `formatCodexEnvelope` from `./codex-stream-parser`.
- **Replaced** mixed `chunks[]` with separate `stdoutChunks[]` and `stderrChunks[]`.
- **Removed** inline per-line JSON parsing (thread.started, item.completed tracking).
- **Replaced** the `close` handler: calls `parseCodexStream(stdout, stderr, code)`
  and returns `formatCodexEnvelope(envelope)`.
- Thread ID is extracted from `envelope.thread_id` instead of an inline variable.

## Why

The parsers were already written but not wired in. The workers duplicated a subset of
the parsing logic inline, losing information:

- Tool call details (name, args, stdout) were discarded
- Files touched were not tracked
- Usage/token stats (codex) were ignored
- Timeout vs error vs partial status was not distinguished
- Truncated stream rescue (regex fallback) was unavailable

## Before / After Behavior

| Aspect | Before | After |
|--------|--------|-------|
| Return format | Plain text (last assistant message or raw tail) | Structured envelope: status, tool outputs, files touched, result text |
| Session ID persistence | Same (extracted and saved) | Same (extracted from envelope and saved) |
| Timeout detection | Not distinguished from error | Detected via exit code 143/124, reported as `timed_out` |
| Tool outputs | Lost | Captured with tool name, args summary, stdout tail, error flag |
| Files touched (cc) | Lost | Extracted from Read/Edit/Write tool_use blocks |
| Usage stats (codex) | Lost | Captured from turn.completed events |
| Truncated stream | Returns raw tail | Regex rescue pass recovers partial tool output text |
| Error diagnosis | Generic `[exit N] raw_tail` | Structured error/no_output status with stderr surfaced |

## Known Limitations

1. **Format change is visible to master agent.** The return value changes from plain
   text (just the last message) to a structured multi-section envelope. Master's prompts
   or downstream tooling that pattern-matches on the old format may need adjustment.

2. **`formatEnvelope` is not configurable per-call.** The `verbose` option (which
   includes stderr in successful runs) defaults to off. If master needs stderr for
   debugging, the tool would need an additional parameter or always-verbose mode.

3. **Codex `file_change` event handling is speculative.** The parser handles an
   anticipated `file_change` item type that hasn't been observed in the wild yet.
   If the actual event shape differs, tool_outputs will contain a raw JSON dump
   under `item:file_change`.

4. **No streaming to master during execution.** Both workers still buffer the full
   stream and parse on close. Long-running tasks give no intermediate feedback.
