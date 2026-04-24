# Gym Leverage — Journal

## 2026-04-24 — Project Created
- 431 gym scenarios exist, untapped potential for agent improvement
- Runner at test/gym/gym-runner.ts, scenarios at agents/gym/scenarios/
- Three phases: explore/fix → review/benchmark → evolution loop
- Using active-reviewer feature for hands-on investigation
### Iteration 1 — 2026-04-24T14:52:08.239Z
**Worker**: Good data. 8 pass in stub mode (meaning environment already satisfies criteria or scorers are lenient), 19 fail (these actually need agent work). Now let me write the deliverable.
**Reviewer**: CONTINUE — The worker has made good progress — ran scenarios in stub mode, found 8 pass/19 fail. Now we need to capture this as documented deliverables and push through multiple milestones.

**(a) Concrete output:** Produce `.state/gym-analysis.md` containing:
1. **Architecture doc**: runner → adapter → scenario → scorer pipeline (read the actual source files to document this)
2. **Scenario categorization**: Categorize all 431 scenarios by type (scan the scenario directories/files)
3. **Run results**: Document the 3+ scenarios already run, what worked, what broke
4. **Core 20 selection**: Pick 20 diverse scenarios covering key capabilities

**(b) What's different:** First attempt — consolidating the exploration work into documented artifacts that check off multiple milestones at once.

**(c) First step:** Run `find packages/gym -type f -name '*.ts' | head -40` and `ls packages/gym/scenarios/ | head -50` to understand the gym structure, then read the runner entry point to document the architecture.

### Iteration 2 — 2026-04-24T14:54:57.476Z
**Worker**: Good, I have everything I need. Let me now produce the comprehensive `.state/gym-analysis.md` deliverable.
**Reviewer**: CONTINUE — **(a) Concrete output:** `.state/gym-analysis.md` — the same deliverable requested last iteration, which the worker said it was about to produce but the session ended before it was written.

**(b) What's different:** Last iteration the worker explored and analyzed but ran out of time before writing the file. This time, **write the file FIRST** using what's already known, then enrich it. Don't re-explore — go straight to producing output.

**(c) First step:** Immediately read `.state/` to check if `gym-analysis.md` was partially created. If not, read the key source files (`packages/gym/src/runner.ts`, `packages/gym/src/adapter.ts`, and one scenario file) in parallel, then write the complete `gym-analysis.md` in one shot covering architecture, run results, scenario categories, and core 20 selection.

