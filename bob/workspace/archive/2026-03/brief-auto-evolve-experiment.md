# Auto-Evolve Experiment: Coder SOUL Optimization

**Context**: We are testing the "Auto-Evolve" workflow (ReqId: 107571c6). The goal is to mechanically evolve `agents/coder/SOUL.md` to improve its Gym pass rate (currently failing 3/13 smoke scenarios).

**Your Task (Coach)**:
1. **Read**: `agents/coder/SOUL.md` (Baseline).
2. **Generate 5 Variations**: Create 5 different versions of `SOUL.md`, each testing a specific hypothesis to reduce failures.
   - **v01 (Verification Focus)**: Add strict "Verify First" constraints (e.g., "Must run `ls -l` before `read`").
   - **v02 (Scope Focus)**: Add strict "Single File" constraints (refuse to edit outside strict scope).
   - **v03 (Slow & Steady)**: Change "Methodology" to prioritize slowness/caution over speed.
   - **v04 (Tool Discipline)**: Add specific constraints against "blind edits" (must use `read` output as `oldText`).
   - **v05 (Simplified)**: Remove 30% of the "Identity" text to see if brevity helps.
3. **Save**: Write these to `agents/coach/workspace/auto-evolve/variations/v01.md` through `v05.md`.
4. **Handoff**: Once saved, send a request to **Tech-Lead** with the following task:
   > "Run the Auto-Evolve Test Loop for Coder.
   > 1. Script provided in `agents/shared/may-agent-docs/design/auto-evolve-workflow.md`.
   > 2. Iterate through `agents/coach/workspace/auto-evolve/variations/*.md`.
   > 3. For each, swap `agents/coder/SOUL.md`, run `scripts/gym-baseline.sh --tier smoke --agent coder`, record pass rate.
   > 4. Restore original SOUL.
   > 5. Save results to `agents/coach/workspace/auto-evolve/results.md`."

**Success Criteria**:
- 5 variation files exist in your workspace.
- Tech-Lead has received the handoff request.
