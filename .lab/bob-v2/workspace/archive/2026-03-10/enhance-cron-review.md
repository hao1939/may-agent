# Design Review: Enhance Cron Workflow
**Source**: `agents/shared/workflow-proposals/enhance-cron.md`

## 1. Assessment
The proposal identifies a valid "Repeated Manual Pattern" (P9) — modifying the `run/cron.ts` core. This is a high-risk area where a mistake breaks the entire heartbeat loop.

### Alignment with Philosophy
- **P9 Two-Phase Development**: We are moving from "Explore" (manual edits to cron.ts) to "Harden" (workflow).
- **P14 Deterministic Guardrails**: The workflow enforces `vitest` runs after every step, which is a structural guardrail against regression.

## 2. Strengths
- **Incremental Verification**: The "test after EACH step" requirement is the key value prop. Humans and agents often skip this when editing core files.
- **Standardization**: It forces a standard way to expose context (interface + loader), which is currently done ad-hoc.

## 3. Weaknesses & Risks
1. **Complexity**: Writing a workflow that edits *code* (AST manipulation) is hard. If the workflow just uses `sed` or `replace`, it will be brittle.
    *   *Risk*: The workflow itself might break `cron.ts` if the file structure changes slightly.
    *   *Mitigation*: The workflow should use `ts-morph` or similar AST tools if possible, OR be very conservative with regex. Given our toolset, it will likely use `read` + `write` with LLM logic.
2. **Over-Engineering**: Is this pattern frequent enough to justify a dedicated workflow?
    *   *Analysis*: We've modified `cron.ts` 4 times in the last 3 days (Trigger, Watchdog, Task Runner, Handler Context). Yes, it's frequent right now.

## 4. Recommendations
1. **Scope**: Restrict this workflow to *adding* capabilities. Do not use it for refactoring.
2. **Rollback**: The workflow must `git stash` before starting and `git stash pop` (or revert) on failure.
3. **Trigger**: Add a specific trigger phrase for Optimizer: "Extend the cron system to support X."

## 5. Verdict
**APPROVED**. Delegate to Optimizer for implementation.

---

## Next Steps
1. **Delegate**: `subagents.delegate("optimizer", "Implement the enhance-cron workflow defined in agents/shared/workflow-proposals/enhance-cron.md")`.
