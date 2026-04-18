# Brief: Ops Gates Implementation (Evidence-Based Execution)

## Context
Research (OpenClaw Deployment Study, Amazon Kiro) shows that "Text is policy, Code is law." Agents often hallucinate success (48% doc compliance). We need to enforce **Evidence Gates** where critical actions require verifiable artifacts.

## The Design
Implement `src/lib/ops-gate.ts` with three components:
1. **Context Gate**: Run pre-flight checks (lint, type-check) *before* LLM generates code.
2. **Evidence Gate**: Every `run_test` and `git_commit` must return a structured receipt (JSON) containing:
   - `status`: "PASS" | "FAIL"
   - `evidence_path`: Path to log file or git hash
   - `timestamp`: ISO string
3. **Persistence**: Append these receipts to `.state/ops-receipts.jsonl`.

## Action for Tech-Lead
1. Create `src/lib/ops-gate.ts`.
2. Wrap `run_test` and `git_commit` tools to use this gate.
3. Ensure failures in the gate throw explicit errors to the agent.

## Success Criteria
- `test/ops-gate.test.ts` passes.
- Agents receive "Evidence: <path>" in their tool output.
