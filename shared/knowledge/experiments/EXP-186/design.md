# EXP-186 Design: Programmatic Auto-Detection for Persistent-Task Workflow

**Date**: 2026-04-19
**Status**: DESIGNED
**Predecessor**: EXP-185 (generic procedural step = 0%), EXP-184 (exact command = 100%)
**Parent project**: instruction-following

---

## Research Question

Can we achieve >80% persistent-task compliance by having the heartbeat **handler code** (not prompt text) detect active projects and inject the exact `workflow.run()` call into the agent's task?

## Hypothesis

H-186: If the heartbeat handler programmatically scans `workspace/projects/` for files with `status: active`, extracts the project goal and path, and **prepends the exact `workflow.run("persistent-task", { task, project })` command** into the task text before the agent sees it, compliance will match the EXP-184 STEP rate (~100%).

**Rationale**: EXP-184 showed exact-command-in-task = 100%. EXP-185 showed generic-procedural-in-task = 0%. The difference is inference steps. By doing the detection and command construction in code, we deliver a zero-inference instruction to the agent.

## Method

### What to build

1. **Project scanner function** — a utility that:
   - Reads `agents/<agent>/workspace/projects/*.md`
   - Parses each file for `status: active` (or similar marker)
   - Extracts: project name, goal/description, file path, current iteration
   - Returns a list of active projects

2. **Task injection** — in the heartbeat handler (or a pre-task hook):
   - Call the project scanner
   - For each active project, prepend to the task text:
     ```
     BEFORE doing anything else, resume your active project:
     workflow.run("persistent-task", { task: "<extracted goal>", project: "workspace/projects/<file>" })
     ```
   - If multiple active projects, pick the highest priority one (or the one with most recent activity)

3. **Integration point** — two options:
   - **Option A (handler modification)**: Modify the heartbeat handler in `agents/<agent>/handlers/` to inject the text. Most reliable but requires understanding handler code structure.
   - **Option B (pre-task hook)**: Add a script that runs before each heartbeat session, modifying the task string. Simpler but may not have access to the task pipeline.
   - **Option C (task template)**: Use a dynamic task template that includes a shell/bun snippet output. Least invasive.

### How to test

1. **Gym validation**: Run the `use-persistent-task` scenario with the auto-detection enabled for bob. Target: >80% pass rate across 10 trials.
2. **Production validation**: Enable for all agents, observe whether heartbeat sessions with active projects correctly invoke persistent-task workflow.
3. **Regression check**: Ensure heartbeat sessions WITHOUT active projects are unaffected.

## Implementation Plan

### Step 1: Understand the handler pipeline
- Read the heartbeat handler code to find where the task string is constructed
- Identify the injection point (before task is sent to the agent)
- Key files to examine: `agents/*/handlers/`, `scripts/`, session creation code

### Step 2: Build the scanner
- Simple function: glob `workspace/projects/*.md`, regex for `status: active`
- Extract goal from `## Goal` section or first paragraph
- Return `{ name, goal, path }[]`

### Step 3: Inject into task
- If scanner returns active projects, prepend the exact workflow.run command
- Use the highest-priority or most-recent project if multiple

### Step 4: Gym test
- Run `use-persistent-task` scenario 10x with injection enabled
- Compare to baseline (0%) and STEP variant (100%)

## Success Criteria

- [ ] Scanner correctly identifies active projects from workspace/projects/
- [ ] Injected task text contains the exact workflow.run() call
- [ ] Gym pass rate on use-persistent-task ≥ 80% (10+ trials)
- [ ] No regression on heartbeat sessions without active projects

## Risks

1. **Handler access**: May not be straightforward to modify the task pipeline. Mitigation: Option B/C as fallback.
2. **Project file format variance**: Active projects may not all use `status: active`. Mitigation: Define a standard frontmatter format.
3. **Multiple active projects**: Agent may get confused with multiple workflow.run commands. Mitigation: Pick one, highest priority.

## Expected Outcome

If H-186 holds, this becomes the **production deployment** for persistent-task compliance: zero human intervention needed, agents automatically resume multi-session work via workflow. This closes the persistent-task-adoption child experiment.
