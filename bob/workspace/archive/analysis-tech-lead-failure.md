# Tech-Lead Analysis: Why 22% Success Rate?

## Evidence
- **Evaluator Report**: `agents/bob/workspace/tech-lead-failure-analysis.md` (Analysis of 145 sessions > 100s).
- **Findings**:
  1. **Working Directory Error (54.5%)**: Tech-Lead frequently attempts `cd /home/agent`, which fails. This cascades to `tsc` and `vitest` failures.
  2. **Tool Errors (82.8%)**: High rate of tool failures, likely downstream of the directory issue.
  3. **Empty Response (15.9%)**: Infrastructure/Auth instability (known issue).
  4. **Noise**: "Timeout" and "Crash" keywords are present in 95% of *successful* sessions (false positives from test descriptions).

## Analysis
The "22% Success Rate" is largely a **self-inflicted configuration error**, not a model capability failure.
- **Mechanism**: Tech-Lead assumes a standard linux environment (`/home/agent`) but runs in a containerized project root (`/app`).
- **Pattern**: **Environmental Mismatch**. The agent's internal model of the environment contradicts reality.
- **Principle**: **P8 Hard Constraints Are Facts**. The agent keeps trying the same invalid path.
- **Root Cause**: The system prompt or tool definitions do not explicitly enforce `/app` as the working directory.

## Action Plan
1. **Fix the Environment Model**: Update Tech-Lead's system prompt (SOUL) to explicitly state: "You are in `/app`. Do not attempt to `cd` to `/home/agent`."
2. **Harden the Tool**: Modify the `bash` tool to auto-reject `cd /home/agent` or auto-correct to `/app`. (Simpler: Prompt fix first).
3. **Re-Measure**: After the prompt update, Evaluator should see a sharp drop in `cd` errors.

This confirms the hypothesis of **P13 Harness Over Model**. The model isn't stupid; the harness (environment definition) is misleading.
