# Proposal: finish() Evidence Validation Guard

**Author**: Optimizer (req:c7c75d5f from Coach)  
**Date**: 2026-03-18  
**Status**: ✅ APPROVED BY COACH (req:5fac7938, 2026-03-18T03:25) — awaiting tech-lead implementation (req:4621ae91)

### Coach Approval Evidence
- Bob FM-3.1 (non-delivery): 4 instances in 7 days, text coaching 0% effective (exp-053/055/056)
- Coach self-errors: 5 instances of finish() with phantom deliverables in last 12 hours
- Authority hierarchy data (58 experiments): Mechanical enforcement (Layer 1) = 100% effective, Text coaching (Layer 4) = 0%

## Problem

Bob has 8 FM-3.1 (NON_DELIVERY) + FM-2.2 (EVIDENCE_GAP) errors in the last 7 days. Text coaching is confirmed 0% effective (exp-053: 0/5 sessions changed behavior). The structural pattern:

1. Agent calls `finish(status: "success", deliverables: [{path: "foo.md", ...}])`
2. The file exists on disk (passes current validation)
3. But the **session transcript has no write/edit tool calls** — the agent didn't create or modify the file this session
4. Or the agent claimed "verified" but never ran a verification command

## Current State

`finish()` in `src/lib/tools/lifecycle.ts` validates:
- ✅ Required fields (status, summary)
- ✅ Blockers required for blocked/failure status
- ✅ Deliverable file paths exist on disk (for success)
- ❌ **No transcript-level evidence validation**

## Proposed Solution: `beforeToolCall` Hook

### Why `beforeToolCall` (not modifying finish() directly)

The `finish()` execute function only receives `(toolCallId, params)` — it has no access to the session transcript. The `AgentLoopConfig.beforeToolCall` hook receives `BeforeToolCallContext` which includes `context.messages` — the **full conversation history**. This is the cleanest integration point.

### Implementation Design

**File**: `src/lib/tools/finish-evidence-guard.ts` (new, ~80 lines)

```typescript
/**
 * beforeToolCall hook that validates evidence when finish(status: "success") is called.
 *
 * Checks:
 * 1. WRITE_EVIDENCE: If deliverables are listed, at least one write/edit tool call
 *    must exist in the transcript (the agent actually produced something)
 * 2. UNADDRESSED_ERRORS: If any tool calls returned errors that were never
 *    followed by a corrective action, warn the agent
 *
 * Returns { block: true, reason: "..." } if validation fails.
 * Returns undefined (pass-through) for all other tools.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "@mariozechner/pi-agent-core";

// Tool names that count as "write evidence"
const WRITE_TOOLS = new Set(["write", "edit", "bash"]);

// Tool names that count as "read/verify evidence"  
const VERIFY_TOOLS = new Set(["read", "bash"]);

export function createFinishEvidenceGuard() {
  return async (context: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    // Only intercept finish() calls
    if (context.toolCall.name !== "finish") return undefined;
    
    const args = context.args as any;
    
    // Only validate success claims with deliverables
    if (args.status !== "success") return undefined;
    if (!args.deliverables || args.deliverables.length === 0) return undefined;
    
    // Scan transcript for write evidence
    const messages = context.context.messages;
    let hasWriteEvidence = false;
    let lastErrorTool: string | null = null;
    let errorAddressed = true;
    
    for (const msg of messages) {
      // Check assistant messages for tool calls
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block?.type === "toolCall" && WRITE_TOOLS.has(block.name)) {
            hasWriteEvidence = true;
          }
        }
      }
      
      // Check tool results for errors
      if (msg.role === "toolResult" && Array.isArray(msg.content)) {
        const isError = msg.content.some((b: any) => 
          b?.type === "text" && (b.text?.includes("error") || b.text?.includes("Error"))
        );
        if (isError) {
          lastErrorTool = "tool";
          errorAddressed = false;
        } else if (lastErrorTool) {
          errorAddressed = true; // A successful tool call after an error = addressed
        }
      }
    }
    
    // Check 1: Write evidence
    if (!hasWriteEvidence) {
      return {
        block: true,
        reason: `finish(status: "success") blocked: No write/edit tool calls found in this session, ` +
          `but ${args.deliverables.length} deliverable(s) claimed. ` +
          `You must actually create or modify files before claiming them as deliverables. ` +
          `If the files already existed, either remove them from deliverables or verify them with a read.`,
      };
    }
    
    // Check 2: Unaddressed errors (warning, not block)
    // This is softer — just appends a warning to the reason
    // Future: could block if pattern is severe
    
    return undefined; // All checks pass
  };
}
```

### Wiring Point

In `src/lib/manager.ts`, where `session.agent` is created/configured, add the hook:

```typescript
// In the agent creation config:
beforeToolCall: createFinishEvidenceGuard(),
```

OR if pi-agent-core doesn't expose a way to set this post-creation, wire it in `agent-loader.ts` where the `AgentLoopConfig` is assembled.

### What This Catches

| Scenario | Current | With Guard |
|----------|---------|------------|
| Agent claims deliverables but never wrote anything | ✅ passes (file pre-exists) | ❌ blocked |
| Agent wrote files and claims them | ✅ passes | ✅ passes |
| Agent claims success with no deliverables | ✅ passes | ✅ passes (no check needed) |
| Agent claims partial/blocked/failure | ✅ passes | ✅ passes (only validates success) |

### Edge Cases & Safeguards

1. **Pre-existing files**: Agent reads a file (not writing) and lists it as deliverable → blocked. This is correct — if you didn't produce it, don't claim it.
2. **bash writes**: `bash` with echo/cat/write commands count as write evidence (bash is in WRITE_TOOLS). This is permissive — we count bash as potential write.
3. **Delegated work**: Agent calls `agents.send()` which causes another agent to write → the parent's transcript won't have write calls. Solution: `agents.call()` results would need to be inspected, or the parent shouldn't list sub-agent deliverables. **Recommendation**: For delegated work, parent should use `status: "partial"` or not list deliverables it didn't directly produce.
4. **False positives**: An agent does `bash("echo hello > file.txt")` which counts as write evidence, then claims an unrelated file. This is a weaker form of the problem. Phase 2 could match deliverable paths against write targets.

### Complexity

- ~80 lines of new code (single file)
- 1 integration point (wiring the hook)
- No changes to pi-agent-core
- No changes to existing finish() tool
- Backwards compatible — only affects `finish(status: "success")` with deliverables

### Expected Impact

- **Direct**: Blocks Bob's FM-3.1/FM-2.2 pattern mechanically
- **Indirect**: All agents get evidence validation for free
- **Cost savings**: Prevents wasted eval cycles on sessions that claim success but delivered nothing
- **Safety**: Non-destructive — only blocks, never modifies. Agent gets a clear error message and can fix its finish() call.

### Phase 2 (Future)

1. **Path matching**: Match deliverable paths against actual write/edit targets in transcript
2. **Verification check**: Require at least one read/verify after the last write (Common Sense 2.3)
3. **Error recovery check**: If errors occurred, verify they were addressed before allowing success
4. **Configurable per agent**: Some agents (e.g., optimizer writing proposals) always write; others (e.g., qa) might legitimately claim success without writes

## Recommendation for Tech-Lead

Implement the `beforeToolCall` approach. It's the cleanest integration:
- Uses existing pi-agent-core hook infrastructure
- No tool modifications needed
- Full transcript access via `context.messages`
- Can be extended for other pre-tool validations in future

Priority: **HIGH** — text coaching is provably 0% effective for this pattern. Only mechanical enforcement works.
