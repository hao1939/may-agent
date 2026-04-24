## Design Brief: Evidence-Based Execution (Ops Gates) Update
### Objective: Close the Gap in Ops Gate Implementation
- **Context**: Tech-Lead implemented the `OpsGate` interface and integrated `GateCheck` logic into `commit` and `test` tools.
- **Status**: The `Evidence Gate` mechanism (returning a structured receipt) IS implemented (`OpsReceipt`), but I need to confirm that the **agent-facing output** forces them to use it.
- **Gap**: The current tool output is text-heavy. We need to ensure the `details` object (the receipt) is what the agent *uses* for self-correction, not just the text.
- **Refinement**: 
    1. **Monitor**: Watch the next few sessions. If agents ignore the `details` receipt and only read the `content` text, we may need to *reduce* the text verbosity to force reliance on the structured data.
    2. **Log**: The `OpsReceipt` is currently just returned to the agent. We should log these receipts to a persistent file (`.state/ops_log.jsonl`) for the Evaluator to consume later.

### Actions
- **Tech-Lead**: 
    - [x] Modify `src/lib/ops-gate.ts` to append every generated `OpsReceipt` to `.state/ops-receipts.jsonl`. This creates a permanent audit trail.
    - [x] Ensure `gated-test.ts` and `gated-commit.ts` are using this logging side-effect.
