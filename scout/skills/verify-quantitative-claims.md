# Skill: Verify Quantitative Claims

**Purpose**: Every number in your `finish()` summary must come from a tool output. This prevents FM-3.3 — claiming counts you never actually computed.

## The Rule

**Before calling `finish(success)`, identify every number in your draft summary. For each one, run a `bash(grep -c / wc -l / jq length)` that produces that exact number. Cite each in `verification_evidence`.**

No number from memory. No mental tallies. Tool output or don't claim it.

## How to Apply

1. **Draft your summary mentally** — "Found N papers, triaged M, discovered K new"
2. **For each number**, run a command that outputs it:
   - `bash("grep -c '## ' papers.md")` → 11
   - `bash("grep -c 'TRIAGED' papers.md")` → 8
3. **Only then call finish**, citing each count:

## Examples

### ❌ BAD — numbers from vibes
```
finish({ status: "success", summary: "Found 11 papers, triaged 8" })
// No grep or wc produced 11 or 8
```

### ✅ GOOD — numbers from tool output
```
bash("grep -c '##' papers.md")        → 11
bash("grep -c 'TRIAGED' papers.md")   → 8

finish({
  status: "success",
  summary: "Found 11 papers, triaged 8",
  verification_evidence: [
    "grep -c '##' papers.md returned 11",
    "grep -c 'TRIAGED' papers.md returned 8"
  ]
})
```

## Scope

Applies to **any** `finish(success)` where your summary contains a number. Does not apply to finish calls with no quantitative claims.
