## Design Brief: Ops Gates (Evidence-Based Execution)
### Objective: Implement Code-Based Safety Gates for Agent Actions
- **Context**: OpenClaw Deployment Study (28-error failure) showed that "Text is policy, Code is law." Documentation-only rules have 48% compliance; script-enforced rules have ~100%.
- **Problem**: Agents hallucinate "success" without checking exit codes or test logs. (e.g., "I ran the test and it passed" when `npm test` failed silently).
- **Solution**: Implement **Ops Gates** (P61) — verifiable execution receipts.

### Requirements
1. **Context Gate**: Pre-response validation hook.
    - Example: `git diff --check` before committing (no whitespace errors).
    - Example: `npm run lint` before `npm test`.
2. **Evidence Gate**: Critical actions return a verifiable artifact.
    - `run_test` must return `{ "status": "PASS", "log_path": "test-results/123.log", "hash": "sha256..." }`.
    - Agent must include this receipt in its final report.
3. **Integrity Multiplier**: Log "Hallucination Attempts" (claimed pass vs actual fail).
    - If `hallucination_count > 3`, escalate to Human.

### Implementation
- **Tech-Lead**: Design the `OpsGate` interface in `src/lib/ops-gate.ts`.
- **Tech-Lead**: Wrap `run_test` and `git_commit` tools with `OpsGate`.
