# Audit: Tool Invocation Dispatch Path Complexity

**Lens B** — 2026-04-13  
**Scope**: Trace a tool call from model output to actual execution  
**Files**: agent.json → agent-loader.ts → manager.ts → manager-receipts.ts → compose-guards.ts → individual tool

## Executive Summary

The tool dispatch path has **5 layers of processing** between the model emitting a tool call and the actual work running. This is **well-factored** — each layer has a clear responsibility. No unnecessary indirection found. Two minor issues worth noting:

1. **Dual guard systems** (beforeToolCall pipeline + inline guards) — architectural split, but justified
2. **4 unused buildTools presets** — dead code (minor, ~80 lines)

**Verdict: No simplification needed. The path is complex because tool dispatch genuinely IS complex (security, receipts, budgets, deduplication). Each layer earns its keep.**

## Path Trace

### Layer 1: Agent Config (`agents/<name>/agent.json`)
- Preset strings: `"coding"`, `"agents"`, `"finish"`, `"workflow"`, `"checkpoint"`, `"cron"`, `"system-status"`, `"scrape"`, `"codex"`, `"gemini-cli"`, `"claude-code"`
- 10 agents, each with 3-6 presets
- Clean declarative config — no indirection

### Layer 2: Preset Resolution (`src/app/agent-loader.ts` — `buildTools()`)
- **853 lines total** (includes config loading, tool building, dynamic import)
- 16 `case` branches in switch statement
- 4 unused: `background-exec`, `read-only`, `message-only`, `agent-growth` (dead code — ~80 lines)
- `loadLocalTools()`: scans `agents/<name>/tools/` for dynamic tool files. Only 1 file exists (`agents/src/lib/tools/security.ts` — appears misplaced)
- **Produces**: Array of `AgentTool` objects (name, parameters schema, execute function)

### Layer 3: Receipt Wrapping (`src/lib/manager-receipts.ts` — `wrapToolsWithReceipts()`)
- **376 lines total**, wraps each tool.execute with:
  1. **beforeToolCall guard pipeline** — composed 10 guards, first-blocker-wins
  2. **Op budget enforcement** — checks `P85` budget before state-changing tools
  3. **Tool pivot heuristic** — blocks after N identical failures (`P110`)
  4. **Execution timing** — measures ms for cost signal
  5. **HMAC receipt signing** — `[SIG: sessionId:hash]` tag appended
  6. **`<tool_output>` XML wrapping** — structured output for model parsing
  7. **Cost signal** — `<system_note>[COST: Xms, YKB]</system_note>`
  8. **Guard warning injection** — non-blocking guard feedback appended
  9. **Tool error history tracking** — for pivot heuristic
  10. **Stuck detection signals** — for session health monitoring

This is the **heaviest layer** but each concern is justified:
- Receipts prevent hallucinated tool outputs (security critical)
- Guards prevent wasted ops (cost critical)  
- Budget enforcement prevents runaway sessions
- XML wrapping helps model parse multi-tool results

### Layer 4: pi-agent-core Agent Class
- External dependency — the LLM orchestration loop
- `systemPrompt + messages + tools → model → toolCall → execute → toolResult → repeat`
- Clean abstraction boundary, no may-agent complexity here

### Layer 5: Individual Tool Execute
- 34 tool files in `src/lib/tools/`, 6,665 total lines
- Each tool: schema validation → path resolution → actual work → formatted result
- Some tools have **inline guards** (not in the beforeToolCall pipeline):
  - `cross-edit-guard.ts` — called from inside `edit.ts` and `write.ts` execute()
  - `memory-sanitizer` — called from inside `write.ts` execute()

## Dual Guard System Analysis

| System | Where | When | Guards |
|--------|-------|------|--------|
| **beforeToolCall pipeline** | manager-receipts.ts | Before tool.execute() | 10: empty-args, tool-schema, path-hallucination, completeness, finish, commit, verification-depth, read-dedup, session-read, scrape-dedup |
| **Inline guards** | Inside tool.execute() | During tool.execute() | 2: cross-edit-guard, memory-sanitizer |

**Why two systems?** The inline guards need access to resolved file paths (after path normalization in the tool), while beforeToolCall guards operate on raw args. This is architecturally correct — moving cross-edit-guard to beforeToolCall would duplicate path resolution logic.

## Dead Code

1. **4 unused buildTools presets** (~80 lines): `background-exec`, `read-only`, `message-only`, `agent-growth`
   - Nobody references them in any agent.json
   - Suggest: keep for now (low cost, may be useful for future agent types)

2. **Misplaced file**: `agents/src/lib/tools/security.ts` — looks like it was accidentally placed in agents/ instead of src/lib/tools/
   - May be the only "local tool" ever loaded by `loadLocalTools()`

## Complexity Budget

| Component | Lines | Justified? |
|-----------|-------|------------|
| agent-loader.ts (buildTools) | 853 | Yes — config loading + 16 presets + dynamic import |
| manager-receipts.ts | 376 | Yes — security receipts + budget + pivot + wrapping |
| compose-guards.ts | 67 | Yes — clean first-blocker-wins composition |
| 10 guard files | 2,614 | Yes — each guard addresses a specific agent failure mode |
| 34 tool files | 6,665 | Yes — actual tool implementations |
| **Total dispatch overhead** | **~1,296** | Lines between config and tool.execute() |

The 1,296 lines of "overhead" (agent-loader + manager-receipts + compose-guards) are reasonable for what they do: config resolution, security receipts, 10 behavioral guards, budget enforcement, and output formatting.

## Recommendations

1. **No structural changes needed** — the path is linear and each layer is justified
2. **Minor cleanup** (~P3): Remove 4 unused buildTools presets if confident no new agents will use them
3. **Minor cleanup** (~P3): Investigate `agents/src/lib/tools/security.ts` placement
4. **Documentation**: This audit serves as the dispatch path reference for future contributors

## Comparison to Previous Audits

- **Lens A (guard system)**: Found well-architected ✅ — confirmed here
- **Lens B (session lifecycle)**: Found 7 context layers — tool dispatch adds 3 more (receipt + guards + individual tool), total ~10 layers from user input to tool result
- **Lens B (session startup)**: Found 9 layers from cron to first LLM token — consistent with findings here
