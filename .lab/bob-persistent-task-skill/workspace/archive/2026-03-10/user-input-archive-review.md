# Review: User Input Archive → Structured JSONL

## Status: APPROVED

I have reviewed the proposal to upgrade our user input logging from plain text to **Structured JSONL**. This aligns with our data-driven philosophy (P18: Measurable Operations).

## Verdict
**APPROVED.** Moving from unstructured text to structured data is essential for the meta-loop.
- **Why**: Plain text logs are hard to analyze programmatically. We cannot easily count "How many feature requests vs bugs?" or "Average sentiment?" or "Top 3 recurring topics?".
- **Why JSONL**: It is append-only, easy to parse, and supports rich metadata without breaking existing tools.

## Key Changes

### 1. New Format (`human-inputs.jsonl`)
Instead of appending to `human-inputs.md`, we will append to `human-inputs.jsonl`.

```json
{
  "timestamp": 1772880153120,
  "sessionId": "s_123",
  "source": "telegram",
  "category": "feature_request",
  "content": "Make the agents faster",
  "sentiment": "neutral",
  "context": { "previous_message_id": "..." }
}
```

### 2. Auto-Categorization
The input handler (May) should attempt to categorize the input:
- **Instruction**: Do this task.
- **Question**: How does X work?
- **Feedback**: This is good/bad.
- **Correction**: You did X wrong, do Y.

### 3. Migration Plan
1.  **Stop writing to `human-inputs.md`**.
2.  **Start writing to `human-inputs.jsonl`**.
3.  **One-time script**: Parse existing `human-inputs.md` into JSONL (best effort).
4.  **Update Analysis Tools**: Bob's weekly synthesis script must read the JSONL file.

## Implementation Plan

1.  **Update `agents/may/handlers/human-input.ts`** (or relevant handler).
2.  **Add `category` field** to the input schema.
3.  **Update `agents/bob/periodic-tasks.md`** to reference the new file location.

## Recommendation
**Implement immediately.** This is a low-effort, high-value change that unlocks better analytics for the weekly brief.
