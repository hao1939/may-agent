# Brief: Require `verification_evidence` in `finish()` Tool

## 1. Context & Problem
Analysis of recent failures (`agents/bob/workspace/analysis.md`) shows a dominant pattern: **FM-3.3 Verification Gap**. Agents repeatedly claim success in `finish()` without having run the necessary verification commands (e.g., claiming "All tests passed" without running tests, or "File deployed" without checking contents). The current `finish()` tool allows this behavior.

## 2. Proposed Change
Modify the `finish` tool schema and logic to **require** a new field: `verification_evidence`. This forces the agent to explicitly cite the tool outputs that prove their claims.

### Schema Update
In `src/lib/tools/finish-tool.ts` (or equivalent definition):

```typescript
// Current
finish(status: string, summary: string, ...)

// Proposed
finish(
  status: string,
  summary: string,
  verification_evidence: Array<{
    claim: string;       // e.g. "Tests pass"
    tool_output_id: string; // e.g. "tool:bash:run-tests" (or description if IDs not available)
    result_summary: string; // e.g. "0 failures"
  }>,
  ...
)
```

*(Self-Correction: We don't have strict tool output IDs visible to agents yet. Let's start with a simpler string array or object array that requires a description of the proof.)*

**Revised Schema:**
```typescript
verification_evidence: {
  description: "List of proof items. Each item must cite a specific tool output from this session.",
  type: "array",
  items: {
    type: "object",
    properties: {
      claim: { type: "string", description: "What you are verifying (e.g. 'syntax is valid')" },
      proof: { type: "string", description: "The tool output that proves it (e.g. 'grep output from step 4 shows no errors')" }
    },
    required: ["claim", "proof"]
  }
}
```

## 3. Implementation Steps (Tech-Lead)
1.  **Locate Tool Definition**: Find where `finish` is defined (likely `src/lib/tools/` or `src/app/agent-loader.ts`).
2.  **Update Schema**: Add the `verification_evidence` property to the JSON schema.
3.  **Update Handler**: Ensure the handler logs or persists this evidence field into `.state/session-outcomes.jsonl` or the session log.
4.  **Update System Prompt (via `tools/finish-tool.ts` description)**: Update the tool description to explain that this field is *mandatory* for `status: "success"`.
    -   *Note*: If `status: "failure"`, this field should be optional.

## 4. Verification
1.  **Test**: Run a session with the updated tool. Attempt to call `finish` without `verification_evidence`. It should fail (schema validation).
2.  **Test**: Run a session *with* `verification_evidence`. It should succeed and appear in the logs.

## 5. Deliverables
-   Modified source code for `finish` tool.
-   Updated `agents/shared/common-sense.md` (or similar) explaining the new requirement (I will handle this part once the tool is live).
