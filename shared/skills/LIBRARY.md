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
| grep-first-reading | ❌ disproven | N/A | efficient-file-reading: coder ignores grep instructions even in explicit workflow phases. Text injection and workflow enforcement both fail. Tool usage habits are not changeable via prompting. | | exp-234: 6/8 baseline (stable), exp-235: 4/8 workflow (WORSE). The skill concept is valid but undeployable. |
| evidence-over-narrative | ✅ proven (as workflow) | misleading-test-fix: 3-phase workflow forces independent calculation, preventing test corruption. 5/8→11/11 | Text injection fails (exp-229). Only works as workflow enforcement. | | exp-268+: misleading-test-fix-workflow 11/11 (2 runs) vs baseline 5/8. PROMOTED. |
| check-state | ⚪ untested | | | | needs gym test |
| task-adherence | ⚪ untested | | | | needs gym test |
| verify-before-finish | ✅ proven (as workflow) | partial-verification-trap: 2-phase workflow forces edge-case testing before finish. 5/6→6/6 | Text injection zero effect (exp-229). Only works as workflow enforcement. | | exp-224: partial-verification-trap-workflow 6/6 (2 runs) vs baseline 5/6. PROMOTED. |
| classify-then-act | ❌ disproven (text) | judgment-ambiguous-spec: text-injected skill has 0% effect. Agent still modifies files despite explicit classify-first protocol with hard stop rules. | 19th consecutive text-injection failure. Fixer-prior too deep for any text-based intervention. Workflow variant (judgment-ambiguous-spec-workflow) works at 75%. | | EXP-017: 1/3 treatment (N=2) vs 1/3 baseline. Zero delta. |
| scope-discipline | ⚪ untested | | | | needs gym test |
| tool-discipline | ✅ proven (as workflow) | context-npx-avoidance: 2-phase workflow (discover → execute) prevents habitual npx usage. 0/3→2/2 on no-npx-attempt. | Text injection fails (npx warning in system prompt is ignored). Grep-first-reading variant fails (different mechanism). | | EXP-015: context-npx-avoidance-workflow 6/7 (2 runs) vs baseline 3.3/5. **0%→100% on critical check.** |
| obstacle-pivot | ✅ proven (as workflow) | behavior-escalation-stubborn: 2-phase workflow (assess → act/escalate) converts 0% escalation to 100%. The agent KNOWS the file is binary but can't translate knowledge into escalation without forced assessment phase. | Text injection untested (likely fails per 0/19 pattern). Only works as workflow enforcement. | | EXP-013: behavior-escalation-stubborn-workflow 6/6 (3/3 runs) vs baseline 0/3 escalated-properly. **STRONGEST A/B result ever: 0%→100% on critical check.** |
| investigate-and-fix | ⚪ untested | | | | needs gym test |
| brainstorm-before-build | ⚪ untested | | | | `design-cache-strategy` scenario: ceiling effect (baseline 5/5 PASS 2026-03-30). Need harder scenario to test. |

> **Note**: Only the top 10 most-referenced skills listed above. Full inventory in the skills/ subdirectories.
> Coach: when you test a skill, fill in "Works When" and "Fails When" — these are the most valuable columns.

### ⚠️ Deployment Reality (2026-04-02, updated with EXP-016 meta-analysis)
**Text injection does NOT change agent behavior** — 0/19+ experiments showed improvement from adding skill text to prompts. The only proven deployment method is **Method #15: Workflow Enforcement** — structuring the task into phases that force the desired behavior.

**Meta-analysis (EXP-016)**: Across 20 scenario pairs, workflows help 40%, hurt 40%, neutral 20%. Mean benefit when helps: +32%. Mean cost when hurts: -13%.

**Routing rule**: Use Decision Topology R ratio (EXP-011) to predict. R > 0.5 → workflow helps. R < 0.3 → workflow hurts.
- ✅ Works for: assessment/discovery/verification (escalation 0→100%, npx avoidance 0→100%, test diagnosis 63→100%)
- ❌ Fails for: materialization cadence, tool habits (grep-first), already-ceiling scenarios
- 🔍 Untested: scope discipline, task adherence
- ❌ Disproven (text): classify-then-act (EXP-017: 0% effect on fixer-prior)
Three skills are now PROMOTED as workflows, ready for deployment consideration:
1. **verify-before-finish** (partial-verification-trap-workflow: 5/6→6/6)
2. **evidence-over-narrative** (misleading-test-fix-workflow: 5/8→11/11)
3. **obstacle-pivot** (behavior-escalation-stubborn-workflow: 0/3→3/3 escalation — strongest result)
4. **tool-discipline** (context-npx-avoidance-workflow: 0/3→2/2 npx avoidance — EXP-015)

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
