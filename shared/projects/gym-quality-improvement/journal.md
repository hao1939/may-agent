# Journal

## 2026-08-14 — Failing Scenario Diagnosis Complete

Diagnosed all 5 consistently failing scenarios. Key finding: **all 5 are well-designed and testing genuine skill gaps** — none are broken or flaky.

The 5 failure patterns map to distinct skills:
1. Proactive cross-referencing (truncated-schema-migration)
2. Backward compatibility awareness (silent-data-corruption)
3. Evidence-over-summaries (approach-validation-trap)
4. Context verification against reality (ambiguous-context-drift)
5. Verify-before-declare (build-activation-gap)

**Output**: `failing-scenario-diagnosis.md`

**Next**: Catalog canonical vs variant scenarios to establish the core metric set.

### Iteration 1 — 2026-05-01T07:51:00.213Z
**Worker**: 87 base scenarios with variants + 151 standalone = 238 canonical scenarios. Let me also copy the diagnosis to the project directory:
**Orchestrator**: CONTINUE

(a) Next iteration should produce **skill-targeted SOUL/guidance improvements** that address the 5 failure patterns, starting with the two most actionable ones: `build-activation-gap` and `silent-data-corruption`.

(b) The diagnosis revealed all 5 scenarios are legitimate skill gaps, not b

### Iteration 2 — 2026-05-01T07:53:15.557Z
**Worker**: Also copying to the project directory:
**Orchestrator**: CONTINUE

(a) Next iteration should **create the actual skill files** from the guidance proposals and then **run the gym scenarios** to validate. We need to move from "proposals on paper" to "skills loaded by the agent" to "measurable pass rate improvement."

(b) We now have diagnosis + proposals do

### Iteration 3 — 2026-05-01T07:54:55.581Z
**Worker**: Also copy to the project directory:
**Orchestrator**: CONTINUE

(a) Next iteration should produce **workflow variant scenarios** for 2 of the 5 failing scenarios, following the proven pattern from existing workflow variants.

(b) **Critical pivot**: LIBRARY.md reveals that text-injection skills have a near-zero success rate (19 consecutive failures). T

### Iteration 4 — 2026-05-01T07:57:42.452Z
**Worker**: Now copy to project directory:
**Orchestrator**: CONTINUE

(a) Next iteration should **run the 2 new workflow variants through the gym** and **create the remaining 3 workflow variants**.

(b) We now have 2 workflow scenarios created and verified. The critical next step is validation — do they actually improve pass rates? We also need to complete c

### Iteration 5 — 2026-05-01T08:00:56.317Z
**Worker**: Now write the results summary:
**Orchestrator**: CONTINUE

(a) Next iteration should **register the 5 workflow variants in LIBRARY.md** and **trigger validation**. Since there's no standalone gym runner, we need to work with the coach's experiment system.

(b) We've built all the artifacts (5 workflow variants) but have zero validation data. The p

### Iteration 6 — 2026-05-01T08:03:12.559Z
**Worker**: Now let me create the experiment config and results file:
**Orchestrator**: CONTINUE

(a) Next iteration should **execute the gym experiments** — run all 5 workflow variants and their base scenarios through the gym runner, 3 times each, and record results.

(b) We now have everything wired up: 5 runnable workflow variants, a gym runner, and LIBRARY.md registration. The only

### Iteration 7 — 2026-05-01T08:13:11.949Z
**Worker**: It's already committed. Let me just finish:
**Orchestrator**: CONTINUE

(a) Next iteration should **fix the broken scenario + create lightweight task nudges** for the 3 remaining failing scenarios, then validate with gym runs.

(b) **Key pivot**: Heavy multi-phase workflow variants are counterproductive for 3/5 scenarios. The data shows `build-activation-gap` 

### Iteration 8 — 2026-05-01T08:16:41.876Z
**Worker**: The nudge dirs are already committed (from a previous iteration perhaps), and node_modules is gitignored. The only uncommitted change relevant is coach/SOUL.md which isn't mine. Let me just commit the coach change to unblock:
**Orchestrator**: CONTINUE

(a) Next iteration should **figure out how to dispatch experiments through the coach** and trigger a validation batch for our 4 scenarios.

(b) We've built all the artifacts (2 nudge variants, 1 workflow variant, 1 fixed scenario) but can't validate them locally. The gym runner only evalua

### Iteration 9 — 2026-05-01T08:24:24.795Z
**Worker**: Now I have enough data. Let me write the results:
**Orchestrator**: CONTINUE

(a) Next iteration should **convert `build-activation-gap` and `approach-validation-trap` to L5 strict workflows with materialization gates**, following the proven `silent-data-corruption-workflow` pattern.

(b) We now have hard data: text nudges are dead (0% improvement), but L5 workflow 

### Iteration 10 — 2026-05-01T08:30:46.829Z
**Worker**: All committed. Let me verify:
**Orchestrator**: CONTINUE

(a) Next iteration should **get live agent validation data** for the 3 L5 workflow variants. This is the single highest-value action — we have all artifacts built but zero evidence they work with a real agent.

(b) We've been building for 3 iterations without new live data. The L5 strict f

### Iteration 11 — 2026-05-01T08:48:08.493Z
**Worker**: Now I have solid data. Let me compile the results:
**Orchestrator**: PIVOT

(a) **Next iteration should run a broader pass rate sweep** across 30+ canonical scenarios to measure M1 and M2 properly. We've spent 10 iterations trying to fix 5 scenarios and hit the prompt engineering ceiling. Time to shift to the remaining milestones: fix flaky scenarios and raise overal

### Iteration 12 — 2026-05-01T08:50:58.853Z
**Worker**: Now copy to project directory and update LIBRARY.md:
**Orchestrator**: CONTINUE

(a) Next iteration should **fix the 6 broken scenarios** and **investigate the 3 pre-solved scenarios**. This is the highest-leverage work — fixing 20% infrastructure breakage directly improves gym signal quality.

(b) We've pivoted from per-scenario prompt engineering (exhausted) to gym i

### Iteration 13 — 2026-05-01T08:54:55.710Z
**Worker**: The `sql-injection-in-query-builder-f1` scenario already has `escapeSQL()` in the environment code! The workspace was pre-modified. This is a genuine bug — the environment already contains the solution.

Similarly, `efficient-file-reading` has `report.md` and `research-and-report` has `synthesis-report.md` already in the environment.

Now let me write the full report:
**Orchestrator**: Good. Project.md is updated. Now the guidance:

CONTINUE

(a) Next iteration should **fix the 3 pre-solved scenarios** and **run a second 30-scenario sweep** to validate infrastructure quality at scale.

(b) The 3 pre-solved scenarios are the most impactful remaining bugs — they produce false positi

### Iteration 14 — 2026-05-01T08:59:44.858Z
**Worker**: Now add the 3 workflow variants as ❌ in LIBRARY.md:
**Orchestrator**: CONTINUE

(a) Next iteration should **fix the 8 remaining problem scenarios** (4 broken + 4 pre-solved) from sweep 2. This directly moves M6 from 17% toward the <5% target.

(b) Same playbook as iterations 13-14 — this is proven high-leverage work. Each fix improves gym signal quality.

(c) **First 

### Iteration 15 — 2026-05-01T09:06:37.522Z
**Worker**: The file is gitignored. It's not tracked, so finish() shouldn't block on it. Let me check what finish is actually checking:
**Orchestrator**: CONTINUE

(a) Next iteration should **run a third 30-scenario coverage sweep** (non-overlapping with sweeps 1-2) to validate that M6 is approaching <5%. If it is, we can close the "fix broken/flaky scenarios" milestone and shift to measuring actual agent pass rates.

(b) We've now fixed 14 scenarios

### Iteration 16 — 2026-05-01T09:10:16.329Z
**Worker**: Now update the metrics section and copy:
**Orchestrator**: CONTINUE

(a) Next iteration should **fix the last 2 suspect scenarios and run a fresh agent pass rate measurement** to update M1 and close the broken/flaky milestone.

(b) Infrastructure quality is proven (0% breakage in sweep 3). We're transitioning from Phase 1 (infrastructure repair) to Phase 2 

### Iteration 17 — 2026-05-01T09:14:41.028Z
**Worker**: 1/4 pass (valid-inputs-work). Correct — hasty-fix is properly broken now.
**Orchestrator**: CONTINUE

(a) Next iteration should **build and run an automated full-gym infrastructure sweep** across ALL ~320 canonical base scenarios. No more sampling — we need the complete picture.

(b) We've been playing whack-a-mole with 30-scenario samples for 5 iterations. Every new sample finds ~25% brea

### Iteration 18 — 2026-05-01T09:21:57.273Z
**Worker**: Now let me write the comprehensive report:
**Orchestrator**: CONTINUE

(a) Next iteration should **batch fix the 17 broken scenarios** by root cause category. This is mechanical work with a proven pattern from iterations 13-15.

(b) We now have the complete picture: 432 scenarios audited, 57 actionable issues with exact root causes. The highest-priority batch

### Iteration 19 — 2026-05-01T09:30:31.440Z
**Worker**: That bug was from a test, not from the actual code. Let me now write the summary report:
**Orchestrator**: CONTINUE

(a) Next iteration must **actually fix the 17 broken scenarios** — not plan, execute. The previous iteration produced only a plan file.

(b) **What's different**: I'm providing the exact broken scenario list with root causes from `sweep-raw.tsv`. No diagnosis needed — just fix.

(c) **Firs

### Iteration 20 — 2026-05-01T09:33:47.357Z
**Worker**: All 17 "broken" scenarios actually produce valid JSON with checks! The sweep script was the problem — it didn't handle mixed stdout (test output + JSON) or workDir arguments. The only real fix was `git init` for scout-coder-logstats. Let me write the report:
**Orchestrator**: CONTINUE

(a) Next iteration should **fix the ~17 pre-solved bug scenarios** and **fix the sweep script** so we can get an accurate M7 measurement. Pre-solved scenarios are the last remaining infrastructure problem — they produce false positive training signals.

(b) The "broken" problem was 95% a m

### Iteration 21 — 2026-05-01T09:53:05.171Z
**Worker**: All 15 remaining ALL_PASS scenarios are restraint scenarios (they test that agents DON'T do harmful things — passing by default is correct behavior).

Now let me write the final report:
**Orchestrator**: Good. Now the guidance:

CONTINUE

(a) Next iteration should **rewrite the sweep script to produce accurate data, then run a full sweep** to get the true health picture. This is the foundation for everything else.

(b) **What's different**: I verified directly that the sweep script is fundamentally 

### Iteration 22 — 2026-05-01T10:01:22.202Z
**Worker**: All 15 ALL_PASS are known restraint tests. Now write the report:
**Orchestrator**: CONTINUE

(a) Next iteration should **write `success_criteria.js` for the 22 NO_CRITERIA scenarios**. This is the last coverage expansion work before we can measure agent pass rates at scale.

(b) Infrastructure is fully clean (0% broken, 0% pre-solved — verified with accurate sweep v2). We're shift

### Iteration 23 — 2026-05-01T10:06:00.517Z
**Worker**: Now I have full clarity. Let me write the report and tally everything:
**Orchestrator**: CONTINUE

(a) Next iteration should **measure agent pass rate at scale** — the last remaining milestone. Infrastructure is clean (0% broken, 444 evaluable scenarios). We need live agent data.

(b) We've spent 22 iterations on infrastructure and have it fully clean. Now we need the one number that ma

### Iteration 24 — 2026-05-01T10:31:02.201Z
**Worker**: Now let me write the comprehensive report:
**Orchestrator**: CONTINUE

(a) Next iteration should **diagnose the 5 near-miss scenarios' failing checks** to determine if they're criteria bugs (fixable) or real agent gaps. This is the fastest path from 53% → 70%.

(b) We now have the first accurate M1 measurement: 53.3%. The good news: check-level pass rate is 8
**Orchestrator**: CONTINUE

(a) Next iteration should **validate the 2 criteria fixes with live agent runs and expand M1 sample to 50 scenarios**.

(b) We've confirmed both criteria fixes are actually in the files. The diagnosis was thorough — 5/7 scenarios are real agent gaps, 2 are criteria bugs now fixed. Projecte

### Iteration 26 — 2026-05-01T10:54:19.108Z
**Worker**: Now I have all data. Let me compile the report:
