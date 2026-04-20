# Context Learning — Journal

## 2026-04-19 — Project Created
- Owner: bob. Scout for research, coach for experiments, tech-lead for src/ changes, optimizer for metrics.
- Core question: what mechanism updates agent behavior based on experience?
- Corrected understanding: text DOES work (KE-106 was overgeneralized). Skills proof: 50%→70%.
- Four phases: research → experiment → build → adopt
- External systems to study: OpenClaw, Hermes Agent, Reflexion
- Internal research: DD-743, DD-768, DD-772, DD-755
- Hao: experiment first, prove in gym, then adopt. Don't rush.
### Iteration 1 — 2026-04-19T17:38:28.494Z
**Worker**: **Status:** done (2m58s)

**Files modified:**
- agents/bob/workspace/projects/context-learning/phase1-dd-audit-and-candidates.md

**Files read (not modified):**
- agents/bob/workspace/projects/context-learning/project.md
- agents/shared/may-agent-docs/design/context-learning.md

**Errors encountered:**
- [bash] The following paths are ignored by one of your .gitignore files:
bob/workspace/projects
hint: Use -f if you really want to add them.
hint: Turn this message off by running
hint: "git config advice.addIgnoredFile false"


Command exited with code 1

**Agent response:**
OK, I have enough context now. Let me produce the deliverable — a research synthesis and candidate approaches document.
**Reviewer**: CONTINUE — **Assessment**: Phase 1 bob tasks (DD audit + candidate synthesis) are done well. The document is thorough and actionable. However, Phase 1 scout tasks (OpenClaw, Hermes Agent, Reflexion research) are still unchecked. The recommendation to start with Approaches 1+3 is reasonable.

**Next iteration should**: Move to Phase 2 — design a concrete gym experiment. Specifically:
1. Design a gym scenario where an agent encounters a specific error in session 1, then test if a reflexion-style lesson prevents the same error in session 2
2. Define the exact mechanism: after session completion, what extracts the reflection? What format? Where is it stored? How is it injected into the next session?
3. Write this as `phase2-experiment-design.md` with: (a) the gym test scenario, (b) the lesson extraction prompt/logic, (c) success criteria (quantitative), (d) what "before" and "after" look like

Don't wait for scout research — the DD audit provides enough foundation. Skip to experimentation per the project's "evidence over theory" principle.

### Iteration 2 — 2026-04-19T17:40:33.302Z
**Worker**: **Status:** done (1m42s)

**Files modified:**
- agents/bob/workspace/projects/context-learning/phase2-experiment-design.md

**Files read (not modified):**
- agents/bob/workspace/projects/context-learning/phase1-dd-audit-and-candidates.md

**Agent response:**
Now I have a clear picture of the gym infrastructure and the learning mechanisms. Let me write the experiment design.
**Reviewer**: CONTINUE — — The experiment design document is solid: clear A/B structure, concrete scenarios, quantitative success criteria, and a well-defined extraction pipeline. Good work.

**Next iteration should**: Begin implementation — build the first gym scenario and the extraction function. Specifically:

1. Create the `reflexion-npx-recovery` scenario directory with all files (`scenario.json`, `task.md`, environment files, `success_criteria.js`) following existing gym scenario conventions
2. Implement `extractReflection(transcript, outcome)` as a standalone function (can be a simple module) using the prompt from the design doc
3. Don't run the full experiment yet — just get the scenario runnable and the extraction function testable
4. Output: the scenario files + extraction function code, ready for Phase 2 Step 2 (baseline runs)

Start with the scenario since it's the most concrete deliverable. Check existing gym scenarios for format conventions before creating yours.

### Iteration 3 — 2026-04-19T17:44:48.045Z
**Worker**: **Status:** done (4m3s)

**Files modified:**
- agents/gym/scenarios/reflexion-npx-recovery/scenario.json
- agents/gym/scenarios/reflexion-npx-recovery/task.md
- agents/gym/scenarios/reflexion-npx-recovery/environment/package.json
- agents/gym/scenarios/reflexion-npx-recovery/environment/.prettierrc
- agents/gym/scenarios/reflexion-npx-recovery/environment/src/ugly.js
- agents/gym/scenarios/reflexion-npx-recovery/environment/src/utils.js
- agents/gym/scenarios/reflexion-npx-recovery/environment/node_modules/.bin/prettier
- agents/gym/scenarios/reflexion-npx-recovery/success_criteria.js
- agents/bob/workspace/projects/context-learning/extract-reflection.js

**Files read (not modified):**
- agents/bob/workspace/projects/context-learning/phase2-experiment-design.md

**Errors encountered:**
- [bash] ls: cannot access 'agents/gym/scenarios/reflexion-npx-recovery/environment/node_modules/.bin/prettier': No such file or directory


Command exited with code 2
- [bash] cat: agents/gym/scenarios/reflexion-npx-recovery/environment/node_modules/prettier/package.json: No such file or directory


Command exited with code 1
- [bash] The following paths are ignored by one of your .gitignore files:
bob/workspace/projects
hint: Use -f if you really want to add them.
hint: Turn this message off by running
hint: "git config advice.addIgnoredFile false"


Command exited with code 1
- [bash] On branch main
Your branch is ahead of 'k3s/main' by 62 commits.
  (use "git push" to publish your local com

_(handoff summary truncated)_
**Reviewer**: CONTINUE — — The worker did create the scenario files and extraction function as requested — that's real progress, not a loop. The warning is a false positive since each iteration produced different deliverables (phase1 doc → phase2 doc → implementation code).

**Issues to fix**: The scenario has a broken prettier setup (node_modules/.bin/prettier doesn't exist) and files are in .gitignored paths.

**Next iteration should**: Validate and fix the implementation, then run a baseline test.

1. **Fix the scenario**: The `prettier` binary must actually exist for the task to be solvable. Either install prettier locally in the environment dir (`cd agents/gym/scenarios/reflexion-npx-recovery/environment && npm install`) or use a simpler approach — make the scenario use a tool that's already available system-wide instead of requiring node_modules
2. **Test the success criteria**: Run `node agents/gym/scenarios/reflexion-npx-recovery/success_criteria.js` and verify it works (reads files, returns pass/fail)
3. **Test the extraction function**: Run `node agents/bob/workspace/projects/context-learning/extract-reflection.js` with a mock transcript to verify it produces a lesson
4. **If everything passes**: Document what works and what's next in a brief status update in the phase2 experiment design doc

Focus on making things actually runnable, not just file creation.

### Iteration 4 — 2026-04-19T17:48:16.056Z
**Worker**: **Status:** done (3m10s)

**Files modified:**
- agents/bob/workspace/projects/context-learning/extract-reflection.js

**Files read (not modified):**
- agents/bob/workspace/projects/context-learning/phase2-experiment-design.md

**Errors encountered:**
- [bash] {
  "scenario": "reflexion-npx-recovery",
  "passed": false,
  "checks": [
    {
      "name": "formatting-applied",
      "passed": false,
      "detail": "Formatting issues: ugly.js: 8 multi-space gaps remaining; utils.js: 10 multi-space gaps remaining"
    },
    {
      "name": "npx-avoided",
  
- [bash] === Extract without LLM (returns prompt) ===
lesson: undefined

=== Extract with mock LLM ===
lesson: undefined
formatted: - undefined (source: test-session-123, 2026-04-19)
[eval]:11
  console.log('prompt length:', result.prompt.length);
                                              ^

TypeError: C

**Agent response:**
Now let me add a status update to the doc:
**Reviewer**: CONTINUE — — The warning is a false positive. Each iteration has produced different deliverables (phase1 → phase2 → scenario files → fixing/testing). The worker made progress: ran success_criteria.js (it executes but fails as expected since files aren't formatted) and tested extract-reflection.js (runs but has a bug returning undefined).

**Next iteration should**: Fix the two concrete bugs found in testing.

1. **Fix extract-reflection.js**: The function returns `undefined` because the result object structure doesn't match what the test code expects. Read the file, find why `result.prompt` and the lesson output are undefined, and fix the return value structure. Run the test again to confirm it works.

2. **Fix the scenario environment**: Run `cd agents/gym/scenarios/reflexion-npx-recovery/environment && npm install --save-dev prettier` to actually install prettier so the scenario is solvable. Then run `node agents/gym/scenarios/reflexion-npx-recovery/success_criteria.js` again — it should still fail (files not yet formatted) but the "npx-avoided" check should be verifiable.

3. **After both fixes pass their tests**, update phase2-experiment-design.md with a brief "Phase 2 Step 1: COMPLETE" status note.

Focus on reading the actual error output carefully and fixing the specific bugs — don't rewrite files from scratch.

### Iteration 5 — 2026-04-19T17:50:02.300Z
**Worker**: **Status:** done (1m36s)

**Files read (not modified):**
- agents/bob/workspace/projects/context-learning/extract-reflection.js
- agents/bob/workspace/projects/context-learning/phase2-experiment-design.md

**Errors encountered:**
- [bash] {
  "scenario": "reflexion-npx-recovery",
  "passed": false,
  "checks": [
    {
      "name": "formatting-applied",
      "passed": false,
      "detail": "Formatting issues: ugly.js: 8 multi-space gaps remaining; utils.js: 10 multi-space gaps remaining"
    },
    {
      "name": "npx-avoided",
  
- [bash] ls: cannot access 'agents/gym/scenarios/reflexion-npx-recovery/environment/node_modules/.bin/prettier': No such file or directory


Command exited with code 2
- [bash] Wrote to /tmp/test-npm/package.json:

{
  "name": "test-npm",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}




up to date, audited 1 package in 219
- [bash] {
  "scenario": "reflexion-npx-recovery",
  "passed": false,
  "checks": [
    {
      "name": "formatting-applied",
      "passed": false,
      "detail": "Formatting issues: ugly.js: 8 multi-space gaps remaining; utils.js: 10 multi-space gaps remaining"
    },
    {
      "name": "npx-avoided",
  

**Agent response:**
Good, files restored to unformatted state. Now update the phase2 doc:
**Reviewer**: BLOCKED — — The worker has failed to install prettier in the scenario environment for 3 consecutive iterations. The likely cause is that `npm install` is failing silently or the .gitignore is preventing the node_modules from being committed/persisted, and the worker keeps not addressing this.

**Root cause**: The scenario design requires `node_modules/.bin/prettier` to exist, but npm install keeps failing or not being run in the correct directory. The worker appears to be testing in `/tmp` instead of the actual scenario directory and not reading error output carefully.

**What's needed to unblock**:
- A human or senior agent should run `cd agents/gym/scenarios/reflexion-npx-recovery/environment && npm install prettier` interactively to diagnose why it's failing (network issues? npm not available? permission problems?)
- Alternatively, redesign the scenario to not require node_modules at all — e.g., use a system-available tool like `sed` for the formatting task instead of prettier

### Iteration 13 (comment) — 2026-04-20T05:20:51.063Z
**Comment**: - [2026-04-19 hao] Text works for changing behavior — don't over-index on structural enforcement. The question is: what's the right format, timing, and delivery mechanism for learned lessons?
- [2026-04-19 hao] This is long-term. Don't rush to build — experiment first, prove it works in gym, then adopt.
**Reviewer**: BLOCKED — The task has run 13 iterations without completing any of the 18 milestones. The last iteration was a "comment iteration" that didn't produce any work output — it just acknowledged the human comments. This suggests the worker is stuck in a loop of processing comments rather than executing the actual goals.

**Root cause:** The task requires delegating external research to scout agents and redesigning the gym scenario, but 13 iterations have produced zero milestone completions. The worker appears unable to make progress on the core deliverables.

**Recommendation:** This task should be re-scoped or restarted with clearer, smaller subtasks. The human comments indicate this should be experimental and unhurried — consider breaking into discrete, achievable pieces rather than tracking 18 milestones in one persistent task.

### Iteration 14 (comment) — 2026-04-20T08:05:33.444Z
**Comment**: - [2026-04-20 hao] 18 milestones is too many for one project. The Phase 1 DD audit was good work. Drop the gym scenario (prettier is broken). Focus on: 1) Ask scout to research OpenClaw and Hermes Agent learning mechanisms. 2) Based on all research, write a concrete proposal for how our agents should learn from experience. That's the deliverable — a design doc, not a working system yet.
- [2026-04-20 hao] Session continuity is currently UNSOLVED. buildSessionContext() in src/lib/manager.ts (144 lines) computes digests, cross-agent context, active recall, session diffs, checkpoints, last-session summaries — then THROWS IT ALL AWAY (dead code). User message = task only. This dead code should be cleaned up (src/ change, needs Hao). The context-learning project should design the RIGHT way to give agents experience-based context — not brute-force injection, but learning. The dead code's data sources (digests, diffs, recall) are valuable inputs for the design.
**Reviewer**: CONTINUE — The task has been re-scoped by the human. Stop processing comments and start executing. Next iteration must produce concrete output:

1. **Fork scout** to research OpenClaw and Hermes Agent learning mechanisms (how they persist lessons, what works, what doesn't).

2. **Read the dead code** in `src/lib/manager.ts` — specifically `buildSessionContext()` — and document what data sources it computes (digests, cross-agent context, active recall, session diffs, checkpoints, last-session summaries). Write a brief summary of what's there.

3. **Begin drafting** a design doc at `docs/designs/agent-learning.md` with sections: Problem Statement, Current State (the dead code analysis), Research (placeholder for scout results), Proposed Design, Open Questions.

The deliverable for this iteration is: the scout research dispatched AND the design doc skeleton with the "Current State" section filled in from reading the actual code.

### Iteration 15 — 2026-04-20T08:07:40.650Z
**Worker**: **Status:** done (2m7s)

**Files modified:**
- docs/designs/agent-learning.md

**Errors encountered:**
- [bash] find: ‘./.state/chrome-profile/optimization_guide_model_store/20/E6DC4029A1E4B4C1/9D754C980A40A657’: Permission denied
find: ‘./.state/chrome-profile/optimization_guide_model_store/45/E6DC4029A1E4B4C1/A4F923A30D61A797’: Permission denied
find: ‘./.state/chrome-profile/optimization_guide_model_store/
- [bash] fatal: pathspec 'docs/designs/agent-learning.md' did not match any files


Command exited with code 128

**Agent response:**
The design doc is in `/app/docs/` not `/app/agents/docs/`. Let me commit what's in the agents repo and handle the design doc separately.
**Reviewer**: CONTINUE — — The worker created the design doc but failed to commit it and didn't fork scout for research. Next iteration must:

1. **Verify and read** `docs/designs/agent-learning.md` — confirm it exists and has the "Current State" section filled in with actual analysis of `buildSessionContext()` from `src/lib/manager.ts`.

2. **Fork scout** to research OpenClaw and Hermes Agent learning mechanisms. This was explicitly requested and not done.

3. **Fix the git commit** — the doc needs to be committed properly.

### Iteration 16 — 2026-04-20T08:10:24.512Z
**Worker**: **Status:** done (2m38s)

**Errors encountered:**
- [bash] sed: can't read src/lib/manager.ts: No such file or directory


Command exited with code 1
- [bash] fatal: not a git repository (or any of the parent directories): .git


Command exited with code 128

**Agent response:**
All three tasks done. Let me finish.
**Reviewer**: CONTINUE — — Good progress. The design doc exists, is committed, and has a solid "Current State" section. Two scout research requests are in CREATED status (ids `4792027e` and `0654179e`) — they were forked but scout heartbeats keep failing ("orphaned by restart"), so research hasn't actually been produced yet.

Next iteration must:

1. **Check if scout research landed** — look for `docs/research/agent-learning-mechanisms.md` or any scout output about OpenClaw/Hermes. If not, the scout requests are stuck (all recent scout heartbeats are failing). Note this as a blocker for the research section.

2. **Fill in the Proposed Design section** of `docs/designs/agent-learning.md` — don't wait for scout. Based on the Current State analysis (which is excellent), draft a concrete proposal covering:
   - How `finish()` lessons should be distilled and surfaced (the doc already identifies that lessons aren't extracted from `appendMemory`)
   - A relevance filtering mechanism for memory entries
   - Cross-agent learning approach
   - Context budget management
   - A simple experiment to prove it works

3. **Commit the updated doc** — use `cd /app/agents && git add docs/designs/agent-learning.md && git commit -m "..."`. The worker keeps trying to commit from wrong directories.

