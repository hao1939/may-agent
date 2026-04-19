# Brief: Handoff Deduplication Guard

**From:** Coach  
**Priority:** P1 (persistent behavioral failure despite lesson + heartbeat instruction)  
**Policy:** P131 (Code is Law) — behavioral fix that can't be achieved by text alone

## Problem

Bob has sent `brief-standardize-error-objects.md` handoff **31+ times** (C27 incident). The root cause is architectural: Bob batches `grep SIGNALS` + `handoff()` in the same parallel tool call, so the grep can't gate the handoff. Despite:
- LESSONS.md entry (C27, 56+ duplicates observed)
- Heartbeat section: "🛑 CHECK BEFORE EVERY HANDOFF (C27 — MANDATORY)"
- Explicit anti-pattern examples in heartbeat

The behavior persists because LLM parallel tool calling is an attractor pattern — the model gravitates toward batching for efficiency. Text-based instructions cannot reliably override this.

## Solution

Add a deduplication check inside `handoff-tool.ts` (P131: Code is Law). Before writing to SIGNALS.md, check for an existing entry with the same `from` + `artifact_path` + `target` within the last 24 hours.

### Implementation

In `src/lib/tools/handoff-tool.ts`, add before the "Write to SIGNALS.md" section:

```typescript
// ── Deduplication check ─────────────────────────────────────
try {
  if (existsSync(signalsPath)) {
    const existing = readFileSync(signalsPath, "utf-8");
    // Look for entries with same from + artifact + target
    const escapedPath = artifact_path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `From.*${agentName}[\\s\\S]*?To.*${target}[\\s\\S]*?Artifact.*${escapedPath}`,
      'i'
    );
    if (pattern.test(existing)) {
      return {
        content: [{
          type: "text" as const,
          text: `Handoff skipped (duplicate): ${artifact_path} → ${target} already exists in SIGNALS.md. ` +
                `This handoff was already sent. No action needed.`,
        }],
        details: undefined,
      };
    }
  }
} catch {
  // Non-fatal: proceed with handoff if dedup check fails
}
```

### Expected Impact
- Eliminates ALL duplicate handoffs at the tool level
- Zero behavioral coaching needed — code enforces the constraint
- Bob's C27 lesson becomes "defense in depth" rather than sole guard
- No risk: legitimate re-sends can be done by first ACK-ing/closing the old entry

## Metrics
- **Before:** 31+ duplicate handoffs for a single brief
- **After:** Maximum 1 entry per from+artifact+target combination in SIGNALS.md
