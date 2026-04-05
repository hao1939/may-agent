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
| grep-first-reading | ❌ disproven (workflow) / ✅ proven (skill file) | efficient-file-reading: skill file injection achieves 8/8 (2/2 runs) vs 6/8 baseline. The skill as a .md file loaded into agent context works. | efficient-file-reading-workflow: coder ignores grep instructions in workflow phases (4/8, WORSE). Workflow enforcement fails for tool-choice habits. | 📦 coder | exp-234: 6/8 baseline, exp-235: 4/8 workflow (WORSE), **exp-018: 8/8 skill injection (2/2 runs, PROVEN)**. First non-workflow skill to show improvement! |
| evidence-over-narrative | ✅ proven (as workflow) | misleading-test-fix: 3-phase workflow forces independent calculation, preventing test corruption. 5/8→11/11 | Text injection fails (exp-229). Only works as workflow enforcement. | | exp-268+: misleading-test-fix-workflow 11/11 (2 runs) vs baseline 5/8. PROMOTED. |
| check-state | ⚪ untested | | | | needs gym test |
| task-adherence | ⚪ untested | | | | needs gym test |
| verify-before-finish | ✅ proven (as workflow) | partial-verification-trap: 2-phase workflow forces edge-case testing before finish. 5/6→6/6 | Text injection zero effect (exp-229). Only works as workflow enforcement. | | exp-224: partial-verification-trap-workflow 6/6 (2 runs) vs baseline 5/6. PROMOTED. |
| classify-then-act | ❌ disproven (text) | judgment-ambiguous-spec: text-injected skill has 0% effect. Agent still modifies files despite explicit classify-first protocol with hard stop rules. | 19th consecutive text-injection failure. Fixer-prior too deep for any text-based intervention. Workflow variant (judgment-ambiguous-spec-workflow) works at 75%. | | EXP-017: 1/3 treatment (N=2) vs 1/3 baseline. Zero delta. |
| scope-discipline | ⚪ untested | | | | needs gym test |
| tool-discipline | ✅ proven (as workflow) | context-npx-avoidance: 2-phase workflow (discover → execute) prevents habitual npx usage. 0/3→2/2 on no-npx-attempt. | Text injection fails (npx warning in system prompt is ignored). Grep-first-reading variant fails (different mechanism). | | EXP-015: context-npx-avoidance-workflow 6/7 (2 runs) vs baseline 3.3/5. **0%→100% on critical check.** |
| obstacle-pivot | ✅ proven (as workflow) | behavior-escalation-stubborn: 2-phase workflow (assess → act/escalate) converts 0% escalation to 100%. The agent KNOWS the file is binary but can't translate knowledge into escalation without forced assessment phase. | Text injection untested (likely fails per 0/19 pattern). Only works as workflow enforcement. | | EXP-013: behavior-escalation-stubborn-workflow 6/6 (3/3 runs) vs baseline 0/3 escalated-properly. **STRONGEST A/B result ever: 0%→100% on critical check.** |
| investigate-and-fix | ❌ disproven (text) / ✅ proven (workflow) | investigate-fix-pattern: text injection 0/4 reproduce-first (zero delta). investigate-fix-pattern-workflow: 2/2 reproduce-first (0%→100%). | Workflow enforcement is the only mechanism that works. 20th consecutive text-injection failure. | EXP-019 | Text: 4/4 product, 4/5 process (identical to baseline). Workflow: 4/4 product, 5/5 process. |
| brainstorm-before-build | ⚪ untested | | | | `design-cache-strategy` scenario: ceiling effect (baseline 5/5 PASS 2026-03-30). Need harder scenario to test. |
| scope-discipline | ⚪ untested (ceiling) | | | | `scope-creep-trap`: ceiling effect (baseline 1/1 all-pass 2026-04-03). Common-sense "One thing at a time" + "Simple first" already sufficient. Need non-ceiling scenario. |
| task-adherence | ⚪ untested (ceiling) | | | | `spec-adherence-multi-step`: ceiling effect (baseline 1/1 10/10 pass 2026-04-03). Common-sense rules already cover task adherence. Need non-ceiling scenario. |
| check-state | ⚪ untested (ceiling) | | | | `convention-verify-multi-edit`: ceiling effect (baseline 2/2 8/8 pass 2026-04-03). "Verify After Edit" skill in coder context already covers. Need non-ceiling scenario. |
| stale-approach-fixation | ⚪ untested (ceiling) | | | | `stale-approach-fixation`: ceiling effect (baseline 7/7 pass 2026-04-03 exp-291). Agent already reads workspace notes. Common sense "Evidence first" covers this. |
| search-strategy-escalation | ⚪ untested (ceiling) | | | | `search-strategy-escalation`: ceiling effect (baseline 6/6 pass 2026-04-03 exp-292). Only 3 search commands used. Efficient-file-reading skill already covers. |
| materialize-findings-concise | 📦 deployed | materialize-intermediate-findings: +67pp early-materialization (0%→67%), +33pp regular-cadence (0%→33%), +33pp finish-references (67%→100%), +33pp product quality (67%→100%). Treatment 44% faster (130s vs 233s). Total checks: 52%→78%. **EXP-023: L4 environmental nudge (pre-created findings.md) achieves 81% checks — slightly OUTPERFORMS skill (78%) while being simpler/faster (110s vs 130s). Nudge weaker on early-materialization (33% vs 67%) but stronger overall.** | regular-materialization-cadence still 67% failure rate — "every 3 commands" rule followed loosely. Small sample (n=3). L4 nudge also 0/3 on cadence. | 📦 scout | EXP-022: 3-rule concise skill. Control 14/27, Treatment 21/27. EXP-023: L4 nudge (no skill, just template file). Treatment 22/27. **Environmental nudge can match text skills.** Deployed to scout 2026-04-04. |
| incremental-context-loading | ⚪ untested (ceiling) | | | | `incremental-context-loading`: ceiling effect (baseline 7/7 pass after EXP-014 scorer fix). Original 5/7 was due to scorer bug, not agent failure. Treatment unnecessary. |
| structured-plan-writing | ✅ proven (skill file) | plan-once-amend: 8/8 (2/2 runs) vs 7/8 baseline. Skill teaches DECOMPOSE→ORDER→RISK→CHECKPOINT→WRITE. No regression on scope-creep-trap. **EXP-027 patch**: bounded fallback in RISK step ("ONE quick search, then BLOCKED") + "Critical rule for missing files" paragraph. Patched version: plan-once-amend 8/8, efficient-file-reading 9/9 — no regression. | Previous test (pre-revision): 6/8 with timeout due to over-planning. Current version has AP-5 (anti-over-planning) guard. RISK step previously had unbounded "search with grep/find" → caused over-searching on missing files. | 📦 coder | exp-019: 8/8 skill injection (2/2 runs) vs 7/8 baseline. **EXP-027**: Patched RISK step (bounded fallback). Plan-once-amend 8/8, efficient-file-reading 9/9 — no regression on either. |
| sycophancy-resistance | ✅ proven (L5 strict workflow only) | sycophants-dilemma: L5 strict workflow with materialization gate → 3/3 PASS (new) + 6/6 (prior) = **9/9 total** vs 3/6 baseline. Forces agent to write ANALYSIS.md classifying files before proceeding to delete, creating self-commitment. | L4 nudge: 3/6 (0% effect). Regular workflow: 3/6 (no effect). Only L5 materialization gate works — the agent can classify files correctly then ignore its own classification unless gated. | | EXP-024/025: Baseline 3/6, Nudge 3/6, Regular workflow 3/6, **Strict 9/9 (5 runs total)**. STRONGEST evidence for Process vs Judgment distinction. |
| regression-awareness | ⚪ untested | | | | Lab fork: agents/.lab/regression-awareness-skill/. Teaches "grep for callers before editing, run full test suite after fix." Target scenarios: regression-from-fix, cascading-error. |
| prerequisite-detection | ⚪ untested | | | | Lab fork: agents/.lab/prerequisite-detection-skill/. Teaches "verify input files exist before processing, block if missing." Target: build-activation-gap, error-recovery-broken-config. |
| verify-before-finish-micro | 🆕 designed | C1.7 regression: tech-lead calls finish(success) without verification in last 5 tool calls. Micro-skill: "ask what tool output proves work correct before finish." | Untested. Designed 2026-04-04 for tech-lead C1.7 regression (80% → target 95%+). | | Based on analysis of 6 C1.7 failures across heartbeat/trivial sessions. See brief: agents/coach/workspace/brief-tech-lead-c17-regression.md |
| pre-finish-reconciliation | ⚪ untested | | | | Lab fork: agents/.lab/pre-finish-reconciliation/. Teaches "self-check issues found vs issues fixed before finish(), use correct status." Target: FM-3.3 pattern across all agents. |
| wrong-fix-recovery | ⚪ untested | | | | Lab fork: agents/.lab/wrong-fix-recovery-skill/ + workflow variant. Teaches "diagnose before fixing: state hypothesis as 'Line X in file Y does Z wrong because W' before editing." Target: misdiagnosed-regression, error-cascade-diagnosis. |
| bug-report-test-coverage | ⚪ untested | | | | Lab fork: agents/.lab/bug-report-test-coverage/. Teaches "after fixing bug, add regression test reproducing the EXACT reported scenario." Target: test-gap-detection. |

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
4. **read-before-edit** → 📦 scout (Deployed 2026-04-04, targeting C1.1 regression 90%→33%. L3 skill + L4 context nudge. Pending verification.)

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

**⚠️ Deployment Wiring Requirement (EXP-028):** No intervention at ANY level works unless explicitly wired into the agent's heartbeat or context. Agents never spontaneously discover available skills/workflows. Removing a reference = immediate usage collapse (51pp done rate drop observed).

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
