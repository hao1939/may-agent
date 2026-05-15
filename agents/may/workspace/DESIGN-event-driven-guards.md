# Design: Event-Driven Guard Architecture

**Status**: Phase 1 Implemented (guard redirect/steer)  
**Author**: May  
**Prompted by**: Hao's observation that hardcoded guards in the tool pipeline is the wrong pattern — event-triggering is better.
**Phase 1**: Guard redirect via steer() — implemented on branch `review/guard-redirect-phase1`

## Problem

Currently we have 11 guard files hardcoded into `composeGuards()` in `manager.ts`. Adding, removing, or per-agent configuring a guard requires editing core code. This is:

1. **Tightly coupled** — guards are wired at agent construction time in `manager.ts`
2. **Not composable** — per-agent exemptions are hardcoded (e.g., `exemptAgents: ["bob"]` for verification-depth)
3. **All-or-nothing** — every guard runs on every tool call, even when irrelevant
4. **Not extensible** — agents can't define their own guards without touching core

## Current Architecture

```
LLM → tool_call → beforeToolCall(composeGuards(...11 guards...)) → tool execution → tool_result
                   ↑ hardcoded chain, blocking
```

Guards in the chain:
| Guard | Type | What it does |
|-------|------|-------------|
| `empty-args-guard` | **Linter** | Blocks calls missing required params |
| `tool-schema-guard` | **Linter** | Blocks cross-tool argument confusion |
| `path-hallucination-guard` | **Linter** | Blocks /home/*, ~/*, etc. |
| `completeness-guard` | Policy | Blocks finish() without checklist |
| `finish-guard` | Policy | Blocks finish(success) without evidence |
| `commit-guard` | Policy | Blocks finish() with uncommitted files |
| `verification-depth-guard` | Policy | Blocks finish(success) without real verification |
| `read-dedup-guard` | Policy | Warns/blocks repeated reads of same file |
| `session-read-guard` | Policy | Blocks reading raw .jsonl files |
| `scrape-dedup-guard` | Policy | Warns/blocks repeated scrapes of same URL |
| `cross-edit-guard` | Policy | Blocks writes to other agents' files (in tool impls) |

## Proposed Architecture

Split into two layers:

### Layer 1: Minimal beforeToolCall (Linter)

Keep only guards that catch **malformed tool calls** — things that would never be valid regardless of policy. These are analogous to compiler/type-checker errors:

- `empty-args-guard` — missing required params
- `tool-schema-guard` — wrong args for wrong tool  
- `path-hallucination-guard` — impossible filesystem paths

These stay in `beforeToolCall` because they must block synchronously.

### Layer 2: Event-Driven Policy Guards (EventBus subscribers)

Everything else becomes an EventBus subscriber that reacts to events:

```
LLM → tool_call → beforeToolCall(3 linters) → tool execution → tool_result
         ↓ emit                                      ↓ emit
    [tool_call event]                           [tool_result event]
         ↓                                           ↓
    bus subscribers                             bus subscribers
    (can inject steer/                          (can inject steer
     schedule correction)                        for next turn)
```

#### New event type needed: `before_tool_call`

The current `tool_call` event is emitted at `tool_execution_start` — AFTER the tool runs. For guards that need to prevent execution, we need a new event:

```typescript
| { type: "before_tool_call"; sessionId: string; agent: string; tool: string; args: unknown; 
    /** Callback to block execution. First blocker wins. */
    block?: (reason: string) => void }
```

OR, simpler approach — don't block, **steer**:

#### Alternative: Post-hoc steering (no blocking needed)

Instead of blocking tool calls, policy guards observe `tool_result` and inject steering messages for the next turn:

```typescript
// Example: commit-guard as event subscriber
bus.subscribe((event) => {
  if (event.type === "session_end" && event.status === "success") {
    // Check for uncommitted files, if found, inject a steer
    // to tell the agent to commit and re-finish
  }
});
```

But this doesn't work for finish() guards — the session is ending. We need the blocking semantic for those.

#### Hybrid: Blocking beforeToolCall + event-driven registration

```typescript
// In manager.ts — single thin hook that delegates to registered guards
beforeToolCall: async (ctx, signal) => {
  // Always run linters
  const lintResult = await runLinters(ctx, signal);
  if (lintResult?.block) return lintResult;
  
  // Run registered policy guards (loaded from config/events)
  return await runPolicyGuards(agentName, ctx, signal);
}

// Policy guards registered via EventBus or config, not hardcoded
class GuardRegistry {
  private guards: Map<string, PolicyGuard[]> = new Map();
  
  register(guard: PolicyGuard) { ... }
  unregister(name: string) { ... }
  
  // Guards can be loaded from agent.json
  // "guards": ["commit", "finish-evidence", "verification-depth"]
  // Or from a central config
}
```

## Recommended Approach

**Phase 1: Declarative guard config (agent.json)**

Move guard selection from hardcoded `manager.ts` to per-agent `agent.json`:

```jsonc
// agents/bob/agent.json
{
  "guards": {
    "linters": true,  // always: empty-args, tool-schema, path-hallucination
    "commit": true,
    "finish-evidence": true,
    "verification-depth": false,  // Bob is exempt (EXP-142)
    "read-dedup": true,
    "completeness": false
  }
}
```

`manager.ts` reads this config and composes only the relevant guards. No code change needed for per-agent tuning.

**Phase 2: Guard registry with event-driven lifecycle**

Guards register themselves on an EventBus-like registry. The `beforeToolCall` hook queries the registry instead of a hardcoded list. Guards can be added/removed at runtime.

```typescript
// src/lib/guard-registry.ts
export class GuardRegistry {
  private guards: GuardEntry[] = [];
  
  register(guard: GuardEntry): () => void { /* returns unsubscribe */ }
  
  async evaluate(agentName: string, ctx: BeforeToolCallContext, signal?: AbortSignal): Promise<BeforeToolCallResult | undefined> {
    for (const entry of this.guards) {
      if (!entry.appliesTo(agentName)) continue;
      const result = await entry.check(ctx, signal);
      if (result?.block) return result;
    }
  }
}

interface GuardEntry {
  name: string;
  type: 'linter' | 'policy';
  appliesTo: (agentName: string) => boolean;
  check: (ctx: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>;
}
```

**Phase 3: Full event-driven (future)**

When pi-agent-core supports middleware/plugin patterns, guards become pure event subscribers that can both observe and intercept. The `beforeToolCall` hook becomes a thin dispatcher.

## Migration Path

1. Add `guards` field to agent.json schema (optional, backward compatible)
2. Create `GuardRegistry` class that loads guards
3. `manager.ts` creates one `GuardRegistry` per agent, configured from agent.json
4. Remove hardcoded `composeGuards(...)` chain
5. Each guard file stays the same — just registered differently

## Benefits

- **Per-agent config without code changes** — tune guards in agent.json
- **Extensibility** — new guards are just new files + registry entries
- **Testability** — guards can be tested in isolation with mock registry
- **Runtime flexibility** — guards can be enabled/disabled without restart
- **Event visibility** — guard activations can emit events for observability

## Open Questions

1. Should we go straight to Phase 2 (registry) or Phase 1 first (declarative config)?
2. How do we handle the finish() guards? They MUST block — event-driven post-hoc doesn't work for session-ending calls.
3. Should the guard config live in agent.json or a separate guards.json?
