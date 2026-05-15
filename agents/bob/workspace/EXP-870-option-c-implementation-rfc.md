# EXP-870: Option C Implementation RFC — Auto-Read After Edit

**Date**: 2025-05-09
**Author**: bob
**Status**: PROPOSAL

## Summary

Automatically inject the result of `read(file, edited_range)` into the tool response after every successful `edit()` call. This eliminates read-after-edit compliance as a behavioral concern — it becomes structural.

## Why Option C Over A/B

| Option | Mechanism | Compliance | Agent effort |
|--------|-----------|-----------|--------------|
| A: Warning gate | Emit warning if no read() follows edit() | ~70-80% (agents ignore warnings) | Agent must act |
| B: finish() rejection | Block completion if unverified edits exist | ~90% (agents learn to comply) | Agent must add reads |
| **C: Auto-inject** | Read result appended to edit response | **100% by construction** | **Zero** |

KE-EXP027 is clear: text interventions = 0% success. Even soft structural (Option A) relies on agent response. Only hard structural (B, C) guarantees compliance. C is superior because it requires zero agent behavior change.

## Implementation Specification

### Where to Implement

The `edit()` tool already returns a diff preview. The change is: **after the diff, append the full file content (or a window around the edit)**.

In the tool execution layer (wherever `edit()` is processed):

```python
# Pseudocode for tool execution wrapper
def handle_edit(path, oldText, newText):
    result = perform_edit(path, oldText, newText)
    if result.success:
        # Auto-verification: read the file after edit
        verification = read_file(path, 
            offset=max(1, result.changed_line - 5),
            limit=min(50, len(newText.split('\n')) + 10)
        )
        result.output += f"\n\n--- Auto-verification (lines {verification.start}-{verification.end}) ---\n"
        result.output += verification.content
    return result
```

### Token Budget Control

To avoid excessive token usage:

1. **Window size**: Show only ±5 lines around the edited region (not full file)
2. **Max cap**: If the edited region is >50 lines, show first 20 + last 10 + "... N lines omitted"
3. **Estimated cost**: 200-800 tokens per edit (much less than the 500-2000 originally estimated for full-file reads)

### Expected Token Impact

| Session profile | Edits/session | Additional tokens | % increase (on 50K avg session) |
|----------------|---------------|-------------------|----------------------------------|
| Light (amy) | 2-3 | 400-2400 | 0.8-4.8% |
| Medium (tech-lead) | 5-8 | 1000-6400 | 2-12.8% |
| Heavy (optimizer) | 10-15 | 2000-12000 | 4-24% |

Even worst case (24% token increase) is acceptable given the alternative is undetected edit errors propagating through sessions.

## What This Replaces

If deployed, the following text rules become redundant and can be REMOVED from agent contexts (saving ~200 tokens per agent × 8 agents = 1600 tokens/session saved):

- "After every edit() or write(), immediately read() the same file. No exceptions."
- "The diff preview does NOT count."
- Coach C1.1 monitoring for "read-after-edit" becomes unnecessary

Net token impact may actually be **negative** (saves more from removing text rules than it costs in auto-reads).

## Validation Plan

1. Deploy to one agent (optimizer — highest violation rate)
2. Run 10 sessions, measure:
   - Token cost increase (actual vs estimated)
   - Error catch rate: how often does the auto-read reveal a problem the agent then fixes?
   - Agent confusion: does the extra output cause any issues?
3. If successful, fleet-wide rollout

## Blockers

**The `edit()` tool is provided by the Claude environment, not our codebase.** We cannot modify it directly. Options:

1. **Request from infrastructure team**: This RFC serves as the specification
2. **Wrapper approach**: If we control the session prompt, we could instruct the model to "always treat edit responses as incomplete until you've also read the file" — but this is just another text rule (will fail per KE-EXP027)
3. **Proxy tool**: Create a custom `safe_edit()` tool that wraps edit+read as an atomic operation — requires custom tool registration

### Recommended Path: Proxy Tool

Since we can't modify the built-in `edit()`, we could:
- Define a `verified_edit()` tool in our infrastructure that calls edit() then read()
- Add it to agent tool sets
- Remove raw edit() access (forcing structural compliance)

This is feasible within our codebase and maintains the "100% by construction" guarantee.

## Decision Needed

1. Can we modify the tool execution layer? → Deploy Option C directly
2. Can we add custom tools? → Deploy proxy `verified_edit()` 
3. Neither? → Fall back to Option B (finish() rejection) which IS in our codebase (master-worker.ts controls session completion)

## Conclusion

Option C is the theoretically optimal intervention. The implementation path depends on infrastructure access. This RFC provides the full specification for whoever implements it.
