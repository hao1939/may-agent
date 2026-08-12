# Skill: Post-Delivery Readback Verification

**Purpose**: Ensure every deliverable claimed in `finish()` has a verifiable tool-call chain: write → read-back → cite read output step in `verification_evidence`.

**Error pattern**: FM-3.3 (Verification Failure) — 46 occurrences in 7 days.

## The Rule

**Every file in `finish({ deliverables })` MUST have a corresponding read() or bash() call whose output you cite by step in `verification_evidence`.** No exceptions.

## Three Failure Modes This Skill Prevents

### FM-3.3a: Write-preview-as-evidence
❌ `write()` returns a preview → agent cites the preview as verification.
✅ After `write()`, call `read()` on the file. Cite the `read()` output.

### FM-3.3b: Fabricated metrics
❌ "The file has 5 layers and 725 lines" — no tool call produced these numbers.
✅ `bash({ command: "wc -l file.ts" })` → "Step 14: bash(wc -l) showed 725 lines."

### FM-3.3c: Phantom verification
❌ "Verified all 3 files are correct" — but only 1 read() call exists in session.
✅ Each file gets its own read() or bash() call. Each is cited separately.

## Protocol

### After every write() or edit():
```
1. write()/edit() the file           → Step N
2. read() the file back              → Step N+1  
3. Note "Step N+1" for later use in finish()
```

### Before calling finish():
```
For each file in deliverables[]:
  - Find the step number where you read/verified it
  - Write that step reference into verification_evidence[]

For each concrete metric you want to claim:
  - Find the tool call that produced it
  - If no tool call exists → do NOT claim the metric
```

### In finish():
```json
{
  "verification_evidence": [
    "Step 8: read(agents/tech-lead/skills/new-skill.md) confirmed skill content matches intent",
    "Step 12: bash(tsc --noEmit) exit code 0 — no type errors",
    "Step 14: bash(wc -l src/handler.ts) showed 142 lines"
  ]
}
```

## Examples

### ❌ BAD: Citing write preview
```
write({ path: "config.json", content: "..." })
→ Preview shows correct content

finish({
  verification_evidence: ["write() preview confirmed config.json content"]
})
```
**Why bad**: write() preview is the *input* you gave, not independent verification of what landed on disk.

### ✅ GOOD: Read-back citation
```
write({ path: "config.json", content: "..." })          // Step 5
read({ path: "config.json" })                            // Step 6
→ Shows: { "timeout": 5000, "retries": 3 }

finish({
  verification_evidence: ["Step 6: read(config.json) confirmed timeout=5000, retries=3"]
})
```

### ❌ BAD: Fabricated count
```
finish({
  summary: "Created 5 workflow files totaling 725 lines",
  verification_evidence: ["All files verified"]
})
```
**Why bad**: No tool call produced "5" or "725". "All files verified" cites nothing.

### ✅ GOOD: Tool-backed metrics
```
bash({ command: "ls agents/coach/workflows/*.ts | wc -l" })  // Step 10 → "5"
bash({ command: "cat agents/coach/workflows/*.ts | wc -l" }) // Step 11 → "725"

finish({
  summary: "Created 5 workflow files totaling 725 lines",
  verification_evidence: [
    "Step 10: bash(ls|wc -l) showed 5 workflow files",
    "Step 11: bash(cat|wc -l) showed 725 total lines"
  ]
})
```

## Self-Check Before finish()

Ask yourself three questions:
1. **For each deliverable**: "Which step number read this file back?" → If none, do a read() now.
2. **For each metric**: "Which tool call produced this number?" → If none, remove the metric or run a tool.
3. **For each verification claim**: "Does it reference a specific step?" → If not, make it specific.

## Relationship to Existing Rules

- **C1.3** (read after write): This skill enforces C1.3 AND requires citing the read in finish().
- **C1.7** (verify in last 5 calls): This skill specifies HOW to cite that verification.
- **Correction #6** (verify intent): This skill complements it — Correction #6 says *what* to verify, this skill says *how to cite* it.
