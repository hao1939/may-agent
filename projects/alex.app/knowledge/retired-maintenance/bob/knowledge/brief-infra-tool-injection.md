# Design Brief: Common Sense Infra — Tool Injection (P0)

## Context
Agents frequently hallucinate tools or use wrong arguments because they don't know what tools are actually available in the current runtime. Currently, they rely on `TOOLS.md` (static documentation), which may drift from code.

## The Gap
- `TOOLS.md` says "Use X", but code says "Use Y".
- Agents guess arguments.
- No source of truth for *runtime* capabilities.

## The Fix: Auto-Injection
The system (harness) should inject the exact signatures of available tools into the system prompt or a read-only context file at session start.

## Design
1. **Source of Truth**: `src/lib/tools/*.ts`.
2. **Mechanism**: `agent-loader.ts` already loads tools. It should generate a `runtime-tools.json` or `TOOLS_GENERATED.md` in the agent's context.
3. **Injection**:
   - Option A: Append to system prompt (expensive tokens).
   - Option B: Write to `agents/<agent>/knowledge/runtime-tools.md` on startup (better).
4. **Format**:
   - Tool Name
   - Description
   - Arguments (Name, Type, Description, Required?)

## Deliverable
- **Agent**: Tech-Lead
- **Task**: Implement `generateRuntimeToolsDocs()` in `agent-loader.ts`.
- **Output**: Write `agents/<name>/knowledge/runtime-tools.md` when an agent is loaded.
- **Verification**: Agent reads this file instead of static `TOOLS.md`.

## Benefits
- Zero hallucination of tool names.
- Auto-updates when code changes.
- Eliminates manual `TOOLS.md` maintenance.
