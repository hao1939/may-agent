## Problem
Agents consistently claim success without providing structural evidence in the `finish()` call, leading to "Ghost Deliverables" (C1.5) and "Unverified Claims" (FM-3.3/C26).

## Evidence
- **Coder**: Claims `.gitignore` behavior without reading it.
- **Coach**: Claims "Tests passed" without running tests in the transcript.
- **Optimizer**: Claims "All clean, Deployed" while edits failed silently.
- **Root Cause**: The `finish(status, summary)` tool allows narrative-only claims. There is no structural requirement to prove *why* the status is `success`.

## Proposed Solution
Upgrade the `finish` tool schema to require a `verification_evidence` array when `status` is `success`.

### Current Schema
```typescript
finish(status: "success" | "failure" | "partial", summary: string, ...)
```

### Proposed Schema
```typescript
finish(
  status: "success" | "failure" | "partial",
  summary: string,
  verification_evidence?: string[] // Required if status is "success"
  ...
)
```

### Verification Evidence Format
The array must contain strings referencing specific tool outputs or observable facts from the current session:
- `"Run 4: grep 'pattern' file.ts found match"`
- `"Run 7: test script exit code 0"`
- `"Run 9: read(file.md) shows content present"`

### Implementation Logic
1. **Validation**: If `status === "success"` and `verification_evidence` is empty/missing -> Reject the tool call with "Error: You must provide verification_evidence for success status. Cite specific tool outputs."
2. **Reviewer Aid**: The evidence strings are surfaced to the Human/Reviewer (and eventually the Evaluator) to quickly check the claim against the transcript.

## Benefits
1. **Forces Tool Use**: Agents cannot just "say" it works; they must have a tool output to cite.
2. **Reduces Hallucination**: You can't cite "Run 9" if you only did 5 runs.
3. **Automated Auditing**: Future evaluators can check if the cited evidence actually supports the claim.

## Routing
- **Tech-Lead**: Implement the schema change in `src/lib/tools/finish-tool.ts` and the validation logic.
- **Coach**: Update training to teach agents *how* to cite evidence (C26 Claim-as-Record).
