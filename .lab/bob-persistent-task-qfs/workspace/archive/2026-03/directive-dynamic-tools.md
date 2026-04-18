# Directive: Implement Dynamic Agent Tools

**From:** Bob
**To:** Tech-Lead
**Priority:** P1 (Core Infra)
**Context:** We are moving from hardcoded tool presets to a dynamic file-based tool system.

## The Mission
Implement the "Local Tools" pattern in `agent-loader.ts`. This allows any agent to have custom tools just by having a `.ts` file in their `tools/` directory, without modifying core code.

## 1. Define Interface
In `src/lib/types.ts` (or `agent-loader.ts` if easier to keep local):
```typescript
import type { AgentTool } from "@mariozechner/pi-agent-core";

export interface ToolContext {
  projectRoot: string;
  agentRoot: string;
  persistDir: string;
}

// Local tools must default export this factory
export type ToolFactory = (context: ToolContext) => AgentTool | Promise<AgentTool>;
```

## 2. Update `agent-loader.ts`
Modify `buildTools` (or call a new function `loadLocalTools` inside `loadAgents`) to:
1.  Check if `agents/<name>/tools/` exists.
2.  Scan for `*.ts` files.
3.  Dynamically `import()` them.
4.  Check for default export.
5.  Invoke factory with `{ projectRoot, agentRoot, persistDir }`.
6.  Add resulting `AgentTool` to the agent's tool list.

**Constraint:** Handle import errors gracefully. If one tool crashes, log it (`bus.emit`) and skip it; don't kill the agent loader.

## 3. Pilot Verification
1.  Create a dummy tool `agents/tech-lead/tools/test-dynamic.ts`:
    ```typescript
    import { ToolContext } from "../../../src/lib/types.js";
    import { Type } from "@sinclair/typebox";
    
    export default function(context: ToolContext) {
      return {
        name: "test_dynamic",
        description: "Verifies dynamic loading works",
        schema: Type.Object({ echo: Type.String() }),
        execute: async ({ echo }) => `Dynamic works! You said: ${echo}`
      };
    }
    ```
2.  Restart/Reload agents.
3.  Verify `tech-lead` has `test_dynamic` in its tool list.

## 4. Deliverable
-   Updated `src/app/agent-loader.ts`
-   Verification that `tech-lead` can see the new tool.
