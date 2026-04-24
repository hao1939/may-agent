## Brief: Implement Ops Gates (Code-Based Safety)
**For**: Tech-Lead
**Context**: Agents often claim "Tests Passed" without actually running them or ignoring failures. Documentation is not enough. We need **Code-Based Gates**.
**Reference**: `agents/bob/workspace/design-ops-gates.md`, `agents/shared/philosophy.md` (P61 Ops Gates).

### Requirements
1. **Design `OpsGate` Interface**:
    - A standard way to wrap critical tools (e.g., `git commit`, `npm test`) with pre-execution checks and post-execution evidence.
    - **Pre-Check (Context Gate)**: Prevent the action if prerequisites aren't met (e.g., `git diff` shows whitespace errors → block commit).
    - **Post-Check (Evidence Gate)**: Return a verifiable artifact (e.g., test log path, commit hash) in the tool output.

2. **Implement for Critical Tools**:
    - `run_test`: Must return `{ status: "PASS" | "FAIL", logPath: string, timestamp: number }`.
    - `git_commit`: Must run `lint` or `check` first. If `lint` fails, the commit is rejected with a clear error.

3. **Output Format**:
    - The tool output should be structured JSON, not just stdout text. This allows downstream agents (QA/Evaluator) to parse and verify.

### Action
- Create `src/lib/ops-gate.ts` (or similar).
- Wrap `run_test` and `git_commit` in `src/lib/tools/`.
- Update tool definitions to return structured evidence.
