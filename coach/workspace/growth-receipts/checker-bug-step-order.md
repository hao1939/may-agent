# Checker Bug Report: step-order False Positive in spec-adherence-multi-step[-ext]

**Date**: 2026-04-09  
**Agent**: coach  
**Severity**: HIGH — caused systematic false failures in Wave 3 validation  
**Status**: FIXED  

## Problem

The `step-order` convention check in `spec-adherence-multi-step-ext/success_criteria.js` (and the base `spec-adherence-multi-step` variant) used **raw text regex matching** on the full JSONL transcript to determine step ordering:

```javascript
// BUGGY: searches raw JSONL text, not structured tool calls
const configReadPos = transcriptIndexOf(/read.*server-config|server-config.*json/i);
const reportWritePos = transcriptIndexOf(/write.*audit-report|edit.*audit-report/i);
```

### Why This Fails

In JSONL format, each transcript entry is a single line of JSON. A `write("CHECKLIST.md", "...write audit-report.md...")` call produces a line like:

```json
{"type":"toolCall","name":"write","arguments":{"path":"CHECKLIST.md","content":"# Checklist\n\n- [ ] Read server-config.json\n- [ ] Write audit-report.md\n..."}}
```

The regex `write.*audit-report` matches `write","arguments":{"path":"CHECKLIST.md","content":"...audit-report` because `.*` spans the entire line in JSONL. This causes the checker to think `audit-report.md` was **written** when actually only a checklist mentioning it was written.

The ext variant's injected_context instructs the agent to "Write CHECKLIST.md immediately after reading the task" — creating a systematic conflict where the checklist always contains output file names, triggering the false positive.

### Measured Position

In Run 2 transcript:
- `write.*audit-report` matched at character position **27** (inside the CHECKLIST.md write)
- `read.*server-config` matched at position **~8000** (when config was actually read)
- Result: **false negative** — checker says order wrong, but agent behavior was correct

## Fix Applied

Replaced raw text regex with **structured tool call matching** using the Score class's `toolCalls()` method:

```javascript
// FIXED: uses structured tool call arguments, not raw text
const readCalls = s.toolCalls("read");
const configRead = readCalls.find(tc =>
  typeof tc.arguments.path === "string" && /server-config\.json/i.test(tc.arguments.path)
);
const writeCalls = s.toolCalls("write").concat(s.toolCalls("edit"));
const reportWrite = writeCalls.find(tc =>
  typeof tc.arguments.path === "string" && /audit-report/i.test(tc.arguments.path)
);
if (!configRead || !reportWrite) return true;
return configRead.callIndex < reportWrite.callIndex;
```

This checks the **path argument** of tool calls, not the raw text. Writing CHECKLIST.md with content mentioning "audit-report" no longer triggers a false match.

## Verification

### Retroactive Re-scoring
All existing transcripts in `/tmp/gym-run-*/work/` were re-scored with the fixed checker. Step-order now passes for all runs (including those that previously failed).

### Fresh Runs (N=3 each)

| Condition | Runs | Passes | Rate |
|-----------|------|--------|------|
| Treatment (with read-all-inputs-first skill) | 3 | 3 | 100% |
| Baseline (no skill, just fixed checker) | 3 | 3 | 100% |
| Base scenario (non-ext, fixed checker) | 1 | 1 | 100% |

### Conclusion
The step-order failure was **entirely a checker bug**, not an agent behavior issue. Bob was always reading inputs before writing outputs — the checker's raw text regex was producing false positives due to CHECKLIST.md content.

## Files Modified
- `agents/gym/scenarios/spec-adherence-multi-step-ext/success_criteria.js` — fixed step-order check
- `agents/gym/scenarios/spec-adherence-multi-step/success_criteria.js` — same fix in base variant

## Broader Implication
Any checker using `transcriptIndexOf()` or `transcriptContains()` for **ordering** checks is vulnerable to this false positive. The `hasToolWithArgs()` and `toolCalls()` structured APIs should be preferred for all ordering/presence checks. Raw text search should only be used when structured data isn't available (e.g., checking for patterns in assistant prose).

## Impact on Wave 3 Results
The Wave 3 validation results that showed `spec-adherence-multi-step-ext` failing on `step-order` need to be re-evaluated. Those failures were false negatives from this checker bug, not real behavioral issues.
