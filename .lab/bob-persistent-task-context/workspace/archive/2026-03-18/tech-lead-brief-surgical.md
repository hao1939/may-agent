# Tech-Lead Brief: Surgical Refactor of Agent Loader

## Context
Two attempts to refactor `agent-loader.ts` failed due to LLM context limits.
We must use surgical edits.

## The Edit
Locate the `buildTools` function in `src/app/agent-loader.ts`.
Find the switch statement handling presets.

## Action 1: Add "coordination" preset
Insert this block before `default:`:

```typescript
      case "coordination": {
        // P82 Handoff Tool - Universal coordination primitive
        tools.push(
          createHandoffTool({
            agentName: config.name,
            agentsRoot: opts.agentsRoot,
            projectRoot,
            triggerHeartbeat: (target: string) => {
              for (const cron of agentCrons.values()) {
                if (cron.triggerNow(`heartbeat-${target}`)) return true;
                if (cron.triggerNow("heartbeat") && target === "may") return true;
              }
              return false;
            },
          }),
        );
        break;
      }
```

## Action 2: Add "coordination" to VALID_TOOL_PRESETS
Add `"coordination",` to the `VALID_TOOL_PRESETS` set.

## Execution
Do NOT rewrite the whole file. Use `edit()` to insert these blocks.
Run `tsc` to verify.
