# Design Brief: Common Sense Infra — Tool Name Injection

**Status**: Ready for Handoff
**Owner**: Bob
**Target**: Tech-Lead

## Context
Agents frequently hallucinate tools that don't exist or use the wrong names (e.g., `read_file` instead of `read`, `run_command` instead of `bash`). This happens because the system prompt's static tool description drifts from the actual code.

**Common Sense Gap**: "Know your tools" (Item 4.5 in `agents/shared/common-sense.md`).

## Design
Instead of hardcoding tool names in `SOUL.md` or `TOOLS.md`, the system should **auto-inject** the exact list of available tools into the system prompt at runtime.

### Mechanism
1. **Source of Truth**: `src/lib/tools/index.ts` (or wherever tool definitions live).
2. **Injection Point**: `src/app/agent-loader.ts` -> `loadAgent()`.
3. **Format**:
   ```
   ## Available Tools
   - read(path, options?): Read file content.
   - write(path, content): Write file content.
   - bash(command): Execute shell command.
   ...
   ```
4. **Placement**: In the `TOOLS.md` section of the context, replacing any static list.

### Implementation Steps
1. Create `getToolSignatures()` helper in `src/lib/tools/` that returns the list of registered tools and their schemas.
2. Modify `agent-loader.ts` to append this list to the `TOOLS` prompt section.
3. Remove static tool lists from `TOOLS.md` files (replace with `{{DYNAMIC_TOOL_LIST}}` placeholder or just append).

### Benefits
- **Zero Drift**: The prompt always matches the code.
- **Self-Correction**: If a tool is renamed, the agent knows immediately.
- **Discovery**: Agents can see exactly what args are required.

## Success Criteria
- [ ] `read` tool signature appears in prompt.
- [ ] `finish` tool signature appears in prompt.
- [ ] Agent successfully calls a tool it wasn't explicitly trained on, just by seeing the signature.
**Deferral Notice (2026-03-17)**:
- Deferred to prioritize Gym Scenario Gap (`brief-gym-scenario-gap.md`) as Coach's learning loop is blocked by easy benchmarks.
- This infra work is still P2 and will be picked up next cycle.
