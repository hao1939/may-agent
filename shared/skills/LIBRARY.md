# Skill Library

Single source of truth for all skills. Two processes feed this:

**Process 1 — Discovery & Evaluation** (Coach owns)
```
Find skill → Try in gym → Record results here
```

**Process 2 — Deployment** (Coach owns)  
```
Check library → Pick proven skill → Add to agent's context/prompts → Monitor
```

## Skill Registry

Each skill has ONE status:
- **✅ proven** — gym-tested, evidence shows it works. Ready to deploy.
- **🧪 testing** — currently being evaluated in gym. DO NOT deploy yet.
- **❌ disproven** — gym-tested, evidence shows it doesn't help (or hurts). DO NOT deploy.
- **⚪ untested** — exists but never gym-tested. DO NOT deploy.
- **📦 deployed** — proven AND actively used by agents. Track which agents.

| Skill | Status | Works When | Fails When | Deployed To | Gym Evidence |
|-------|--------|------------|------------|-------------|--------------|
| grep-first-reading | 🗄️ ARCHIVED (disproven as workflow; skill file variant deployed as efficient-file-reading) | efficient-file-reading: skill file injection achieves 8/8 (2/2 runs) vs 6/8 baseline. | Workflow variant: 4/8, WORSE. | 📦 coder (as efficient-file-reading) | exp-018: 8/8 skill injection. Workflow dir archived 2026-04-13. |
| evidence-over-narrative | ✅ proven (as workflow) | misleading-test-fix: 3-phase workflow forces independent calculation, preventing test corruption. 5/8→11/11 | Text injection fails (exp-229). Only works as workflow enforcement. | | exp-268+: misleading-test-fix-workflow 11/11 (2 runs) vs baseline 5/8. PROMOTED. |
| verify-before-finish | ✅ proven (as workflow) | partial-verification-trap: 2-phase workflow forces edge-case testing before finish. 5/6→6/6 | Text injection zero effect (exp-229). Only works as workflow enforcement. | | exp-224: partial-verification-trap-workflow 6/6 (2 runs) vs baseline 5/6. PROMOTED. |
| classify-then-act | 🗄️ ARCHIVED (disproven) | Workflow variant works at 75%. | 0% effect as text injection. 19th consecutive text-injection failure. | | EXP-017, EXP-032: best was 1/6 (17%). Archived 2026-04-13. |
| tool-discipline | ⚠️ REGRESSED | context-npx-avoidance: 2-phase workflow originally 0→100% on no-npx-attempt (EXP-015). **EXP-226 (2026-09-28): 0/5 across all arms including workflow. Model regression — npx habit now too strong for any prompt-level intervention.** | All prompt-level approaches fail: text injection, discovery prepend, fake npx error, workflow phases. Only infrastructure fix (remove npx from PATH) viable. | | EXP-015 (original): 0%→100%. EXP-226 (current): 0% across all arms. |
| obstacle-pivot | ✅ proven (as workflow) | behavior-escalation-stubborn: 2-phase workflow (assess → act/escalate) converts 0% escalation to 100%. The agent KNOWS the file is binary but can't translate knowledge into escalation without forced assessment phase. | Text injection untested (likely fails per 0/19 pattern). Only works as workflow enforcement. | | EXP-013: behavior-escalation-stubborn-workflow 6/6 (3/3 runs) vs baseline 0/3 escalated-properly. **STRONGEST A/B result ever: 0%→100% on critical check.** |
| investigate-and-fix | 🗄️ ARCHIVED (disproven as text; workflow variant still valid) | Workflow: 2/2 reproduce-first (0%→100%). | Text: 0/4 reproduce-first (zero delta). 20th text-injection failure. | EXP-019 (workflow) | Text dir archived 2026-04-13. Workflow enforcement is the only mechanism that works. |
| materialize-findings-concise | 📦 deployed | materialize-intermediate-findings: +67pp early-materialization (0%→67%), +33pp regular-cadence (0%→33%), +33pp finish-references (67%→100%), +33pp product quality (67%→100%). Treatment 44% faster (130s vs 233s). Total checks: 52%→78%. **EXP-023: L4 environmental nudge (pre-created findings.md) achieves 81% checks — slightly OUTPERFORMS skill (78%) while being simpler/faster (110s vs 130s). Nudge weaker on early-materialization (33% vs 67%) but stronger overall.** | regular-materialization-cadence still 67% failure rate — "every 3 commands" rule followed loosely. Small sample (n=3). L4 nudge also 0/3 on cadence. | 📦 scout | EXP-022: 3-rule concise skill. Control 14/27, Treatment 21/27. EXP-023: L4 nudge (no skill, just template file). Treatment 22/27. **Environmental nudge can match text skills.** Deployed to scout 2026-04-04. |
| structured-plan-writing | ✅ proven (skill file) | plan-once-amend: 8/8 (2/2 runs) vs 7/8 baseline. Skill teaches DECOMPOSE→ORDER→RISK→CHECKPOINT→WRITE. No regression on scope-creep-trap. **EXP-027 patch**: bounded fallback in RISK step ("ONE quick search, then BLOCKED") + "Critical rule for missing files" paragraph. Patched version: plan-once-amend 8/8, efficient-file-reading 9/9 — no regression. | Previous test (pre-revision): 6/8 with timeout due to over-planning. Current version has AP-5 (anti-over-planning) guard. RISK step previously had unbounded "search with grep/find" → caused over-searching on missing files. | 📦 coder | exp-019: 8/8 skill injection (2/2 runs) vs 7/8 baseline. **EXP-027**: Patched RISK step (bounded fallback). Plan-once-amend 8/8, efficient-file-reading 9/9 — no regression on either. |
| sycophancy-resistance | ✅ proven (L5 strict workflow only) | sycophants-dilemma: L5 strict workflow with materialization gate → 3/3 PASS (new) + 6/6 (prior) = **9/9 total** vs 3/6 baseline. Forces agent to write ANALYSIS.md classifying files before proceeding to delete, creating self-commitment. | L4 nudge: 3/6 (0% effect). Regular workflow: 3/6 (no effect). Only L5 materialization gate works — the agent can classify files correctly then ignore its own classification unless gated. | | EXP-024/025: Baseline 3/6, Nudge 3/6, Regular workflow 3/6, **Strict 9/9 (5 runs total)**. STRONGEST evidence for Process vs Judgment distinction. |
| build-activation-gap-workflow | ❌ disproven | N/A | L5 strict workflow: 6/9 (67%) vs 78% baseline. Workflow overhead hurts more than gate helps. | | iteration10-11: 3 trials, regressed from baseline. |
| approach-validation-trap-workflow | ❌ disproven | N/A | L5 strict workflow: 4/6 (67%) vs 83% baseline. Forced log-reading phase confuses agent. | | iteration10-11: 3 trials, regressed from baseline. |
| truncated-schema-migration-workflow | ❌ disproven | N/A | L5 strict workflow: 5/6 (83%) = baseline. No improvement, added complexity. | | iteration10-11: 3 trials, no lift. |
| regression-awareness | ⚪ CEILING (unnecessary) | | Baseline already 100% on all 3 regression scenarios (regression-from-fix, regression-from-fix-ext, misdiagnosed-regression). Agent naturally checks for regressions. | | Gym baseline audit 2026-05-02: 6/6, 6/6, 7/7 across 3 scenarios. Skill adds no value. |
| prerequisite-detection | ⚪ untested | | | | Lab fork: agents/.lab/prerequisite-detection-skill/. Teaches "verify input files exist before processing, block if missing." Target: build-activation-gap, error-recovery-broken-config. |
| verify-before-finish-micro | 🗄️ ARCHIVED (unreferenced standalone) | C1.7 regression micro-skill. | Superseded by verify-before-finish deployed to May. | 📦 may (as verify-before-finish) | Standalone .md archived 2026-04-13. May's copy remains as verify-before-finish.md. |
| pre-finish-reconciliation | ⚪ untested | | | | Lab fork: agents/.lab/pre-finish-reconciliation/. Teaches "self-check issues found vs issues fixed before finish(), use correct status." Target: FM-3.3 pattern across all agents. |
| bug-report-test-coverage | ⚪ untested | | | | Lab fork: agents/.lab/bug-report-test-coverage/. Teaches "after fixing bug, add regression test reproducing the EXACT reported scenario." Target: test-gap-detection. |
| reading-metrics | ⚪ untested | Heartbeat metric triage: 3-state classification (✅/📉/🔴), DB query for trend detection, act-or-escalate protocol, close-the-loop prevention ladder. | Untested. Hypothesis: agents without this skill ignore 📉 metrics until they become 🔴. | | Deployed from agent-system-literacy project gap analysis (2027-09). |
| retry-aware-dispatch | ⚪ untested | Multi-session tasks that get re-dispatched after interruption. Protocol: check checkpoints, track attempt count (1-5), decompose at attempt 4, stop+escalate at 5. | Untested. Hypothesis: single-session tasks don't need it. | | EXP-860: 70+ zombie sessions/day observed. Skill designed 2025-05-04, written 2025-05-04. |
| read-before-edit | ⚠️ deployed (no production lift) | Gym: 11/11 with skill loaded (coder-edit-discipline scenario). Process skill — adds "read file → confirm content → then edit" step. | **KE-023**: Production C1.1 compliance DECLINING despite deployment to 4 agents. Scout 75%→38%→24%, May 100%→67%, Tech-lead 100%→55%→70%, Bob 100%→74%→72% over 5 days. **Scout worst: 23.8% (48h, n=21)**. Skill file + context.md nudge both failed. **Apr 6 escalation**: P0 heartbeat workflow gate requested — restructure scout heartbeat to embed read-first as mandatory 2-step process (Step A: READ, Step B: EDIT). Gym ≠ production. | 📦 scout, tech-lead, bob, may (2026-04-04/05) | Gym: 11/11 in controlled setting. Production: NO measurable improvement. See KE-023. **Apr 6**: scout-library-update gym baseline 11/11 (ceiling) — agent CAN do it when task is explicit. Problem is heartbeat flow doesn't trigger the behavior. |

### 🗄️ Archived Skills (2026-04-13)

The following skills were archived to `agents/shared/skills/archive/` during dead skill cleanup.
See `archive/README.md` for full details and restoration instructions.

**Untested + ceiling effect** (7 skills — baseline already passes, skill unnecessary):
check-state, task-adherence, scope-discipline, brainstorm-before-build, stale-approach-fixation, search-strategy-escalation, incremental-context-loading

**Unreferenced standalone .md files** (6 files — 0 active references in code/prompts):
constructive-friction, critical-pause, experiment-before-apply, extract-directives, synthesis-dpir, verify-before-finish-micro

**Untested ceiling skill** (1): wrong-fix-recovery (EXP-035: baseline 3/3 PASS)

> **Note**: Full inventory in the skills/ subdirectories and agents/.lab/ forks.
> Coach: when you test a skill, fill in "Works When" and "Fails When" — these are the most valuable columns.

### ⚠️ Deployment Reality (2026-04-05, updated with EXP-028 workflow collapse findings)
**Three proven deployment methods:**

**Method A: Workflow Enforcement** (Method #15) — structuring the task into phases that force the desired behavior.
- ✅ Works for: assessment/discovery/verification (escalation 0→100%, npx avoidance 0→100%, test diagnosis 63→100%)
- ❌ Fails for: materialization cadence, tool habits (grep-first), already-ceiling scenarios
- **Meta-analysis (EXP-016)**: Across 20 scenario pairs, workflows help 40%, hurt 40%, neutral 20%. Mean benefit when helps: +32%. Mean cost when hurts: -13%.
- **Routing rule**: Use Decision Topology R ratio (EXP-011) to predict. R > 0.5 → workflow helps. R < 0.3 → workflow hurts.

**Method B: Skill File Injection** (NEW — 2026-04-03) — adding .md skill files to agent's skills/ directory, loaded into system prompt.
- ✅ Works for: tool-choice habits (efficient-file-reading: 6/8→8/8), planning quality (plan-once-amend: 7/8→8/8)
- ⚠️ Key difference from "text injection": skill files are **structured protocols with triggers, anti-patterns, and assertions** — NOT just instructions added to SOUL.md. The structured format seems to work where inline text fails.
- ❌ Still fails: classify-then-act as text injection (EXP-017: 0% effect on fixer-prior)

**Skills deployed (via skill files):**
1. **efficient-file-reading** → coder (exp-018: 6/8→8/8, 2/2 runs)
2. **structured-plan-writing** → coder (exp-019: 7/8→8/8, 2/2 runs)
3. **materialize-findings-concise** → 📦 scout (EXP-022: 52%→78% total checks, +67pp early-materialization, 44% faster. Deployed 2026-04-04)
4. **read-before-edit** → 📦 scout (Deployed 2026-04-04, targeting C1.1 regression 90%→33%. L3 skill + L4 context nudge. **KE-023: No production improvement — C1.1 at 38% as of Apr 5.**)
5. **read-before-edit** → 📦 tech-lead (Deployed 2026-04-05, targeting C1.1 at 80% compliance. **KE-023: C1.1 dropped to 55% post-deployment.**)
6. **read-before-edit** → 📦 bob (Deployed 2026-04-05, targeting C1.1 regression 84.3%. **KE-023: C1.1 at 74%, was 100% on Apr 2.**)
7. **verify-before-finish** → 📦 may (Deployed 2026-04-05, targeting C1.7 regression 92.6%→62.5%. **C1.7 now at 84% — modest improvement from 62.5%, still below target 95%.**)
8. **read-before-edit** → 📦 may (Deployed 2026-04-05, targeting C1.1 regression 95.8%→90% (last 5: 40%). **KE-023: C1.1 at 67%, was 100% on Apr 2.**)
9. **verify-after-edit (tightened)** → 📦 ALL agents (2026-04-06). Fixed misleading "When to Skip" escape hatch: old text said "tests are verification" and "new file about to test immediately" — but C1.3 checker requires explicit read() after every write()/edit(). Tool previews, tests, cat, grep, and head are useful supporting checks but do not satisfy the direct write/edit read-back guard. Tech-lead specific context.md nudge added (45.5% C1.3 pass rate, worst of all agents).
10. **read-before-edit (heartbeat workflow gate)** → 📦 scout (2026-04-06, pending May implementation). Escalation from failed L3 skill + L4 nudge. Restructures scout heartbeat "Write to library" step into mandatory 2-step process: Step A READ → Step B EDIT. Converts passive advice into workflow structure. Scout C1.1 at 23.8% (48h). Gym baseline 11/11 proves agent CAN comply — heartbeat just doesn't trigger it.

**Method C: L5 Strict Workflow (Materialization Gate)** (NEW — EXP-024) — workflow that requires a written analysis artifact BEFORE proceeding to action phase.
- ✅ Works for: judgment tasks where the agent knows the right answer but overrides it (sycophancy: 0%→100%)
- ❌ L4 nudge and regular workflow both fail for same task — only the gated commitment works
- **Key insight**: The materialization gate creates a written self-commitment. The agent can't contradict its own analysis without violating an explicit constraint.

**Skills deployed (as workflows):**
1. **verify-before-finish** (partial-verification-trap-workflow: 5/6→6/6)
2. **evidence-over-narrative** (misleading-test-fix-workflow: 5/8→11/11)
3. **obstacle-pivot** (behavior-escalation-stubborn-workflow: 0/3→3/3 escalation — strongest result)
4. **tool-discipline** (context-npx-avoidance-workflow: 0/3→2/2 npx avoidance — EXP-015)
5. **sycophancy-resistance** (sycophants-dilemma L5 strict workflow: 3/6→9/9 across 5 runs — EXP-024/025)

**EXP-026 Meta-Analysis (Optimizer, 2026-04-04):**
- Workflow sessions: 83.9% done rate (7d) vs 74.1% standalone. **0% error rate** in last 7 days (0/31 sessions).
- **implement-and-review** is gold standard: 74% full-run success, 9 ops/run avg, 0 recent errors.
- **training-sprint** is worst performer: 34 ops/session avg (3-4x others), 19% interrupted rate.
- Coach benefits most from workflows (+20pp done rate). QA near-perfect in workflows (99%).
- Evaluation system doesn't capture workflow value (per-session heuristics miss run-level benefits).

**EXP-028 Workflow Usage Collapse (Optimizer, 2026-04-05):**
- Heartbeat rewrite on Apr 1 removed `workflow.run()` instructions → workflow usage dropped to 0 by Apr 2.
- Coach done rate collapsed: **~85% → ~34%** (51pp degradation) over Apr 2-3.
- System-wide: workflow sessions have **83.9% done rate** vs 73.9% without, and **0% error rate** vs 10%.
- **Key deployment insight**: Agents don't spontaneously discover workflows. Workflow adoption requires explicit wiring in heartbeats — availability alone is insufficient.
- **Lesson for skill deployment**: Any skill or workflow must be wired into the agent's heartbeat/context to be used. Removing references = immediate usage collapse.

**EXP-025 Decision Topology Validation (In Progress):**
- Phase 1 complete: discovered 12-13 non-ceiling scenario pairs for prospective testing.
- Bob's R predictions locked before seeing results. Awaiting Phase 2 (n=3 per arm runs).
- Key issue: 88%+ of gym scenarios are ceiling for coder baseline.

**⚠️ EXP-040 Ceiling Shift Audit (Coach, 2026-04-06):**
- Re-ran all EXP-025 non-ceiling scenarios. **4/5 formerly non-ceiling scenarios are now CEILING** with current deployed skills:
  - wrong-fix-recovery: 2/6 → **6/6** (+4 checks)
  - verification-contradiction: 3/6 → **6/6** (+3 checks)
  - silent-dependency: 3/5 → **5/5** (+2 checks)
  - cascading-error: 4/5 → **5/5** (+1 check)
  - sycophants-dilemma: 4/6 → **4/6** (unchanged — judgment gap remains)
- **Skills work in aggregate.** The compound effect of 5 deployed skills produces dramatic improvements.
- **sycophants-dilemma is the ONLY remaining non-ceiling scenario** in the standard gym suite. Requires judgment/values intervention (L5+ workflow), not technical skill.
- **Implication**: New, harder gym scenarios urgently needed to test future skills.

**Key findings about mechanism types (EXP-023, EXP-024, EXP-025):**
- L4 environmental nudges work for process behaviors (materialize-intermediate-findings: 81% vs 52% baseline) but NOT judgment (sycophants-dilemma: 0% effect)
- Regular workflows fail for sycophancy (sycophants-dilemma: 3/6, no effect vs baseline)
- **L5 strict workflows with materialization gates** are the ONLY mechanism that defeats sycophancy (sycophants-dilemma: 3/6→9/9 across 5 runs). The gate forces self-commitment.
- **Process vs Judgment distinction**: If the agent doesn't know to do X → nudge/skill works. If the agent knows X but does wrong thing anyway → only L5 works.

**Intervention Hierarchy (from weakest to strongest):**
| Level | Mechanism | Works For | Example |
|-------|-----------|-----------|---------|
| L1 | SOUL.md text | Nothing (0/21 attempts) | Inline instructions |
| L2 | Context.md knowledge | Environmental facts only | "npx is not available" |
| L3 | Skill file (.md in skills/) | Tool habits, process | efficient-file-reading, plan-writing |
| L4 | Environmental nudge | Process behaviors | Pre-created template files |
| L5 | Workflow enforcement | Assessment, discovery | 2-phase: assess → act |
| L5+ | Strict workflow (gate) | **Judgment overrides** | Materialization gate: write analysis → MUST exist before action |

**⚠️ KE-021 Skill Effectiveness Taxonomy (EXP-032):** Skills work differently based on what they're trying to change:
- **Process skills** (add steps to workflow) → HIGH effectiveness (e.g., verify-after-edit, plan-writing)
- **Knowledge skills** (provide missing info) → MEDIUM effectiveness (e.g., file-safety-classification)
- **Judgment skills** (override model's analysis) → LOW effectiveness — model's confidence in its own investigation overrides skill warnings. Use L5+ for judgment tasks.

**⚠️ Deployment Wiring Requirement (EXP-028, EXP-030, EXP-031b):** No intervention at ANY level works unless explicitly wired into the agent's heartbeat or context. Agents never spontaneously discover available resources. Combined evidence: **0/26 discovery attempts across 3 resource types** — EXP-028 (workflows, 0/21 spontaneous), EXP-030 (skills/LIBRARY.md, 0/3 even with nudge), EXP-031b (scripts in workspace, 0/2 even with explicit task hint). Note: EXP-031b's hint was IN the task text itself (high salience) — agent still ignored scripts and solved the bug via direct code reading. The "pull" model is dead; only "push" (direct injection) works.

## How to Evaluate a Skill

1. **Pick a skill** from the untested list above
2. **Find or create a gym scenario** that exercises it
3. **Run baseline** (without skill in prompt): `bash test/gym/run-gym.sh <scenario> --agent <agent>`
4. **Run with skill** (inject skill into prompt): same scenario, skill added
5. **Compare scores** — did quality/efficiency improve?
6. **Record conditions**:
   - "Works When": what task types, what agent roles, what conditions make this skill helpful
   - "Fails When": what conditions make it useless or harmful (adds noise, confuses agent, etc.)
7. **Update this table** with status + evidence link

## Gym Results Archive

Store results in `agents/coach/workspace/skill-gym-results/` with naming: `<skill-name>-<date>.md`

Each result file should contain:
```markdown
# Gym Result: <skill-name>
Date: YYYY-MM-DD
Scenario: <scenario-name>
Agent: <agent-name>

## Baseline (without skill)
- Score: X
- Key observations: ...

## With Skill
- Score: Y  
- Key observations: ...

## Verdict: proven / disproven / inconclusive
- Works when: ...
- Fails when: ...
```
