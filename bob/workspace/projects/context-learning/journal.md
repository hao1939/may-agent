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

