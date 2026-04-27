# Gym Scenario Categories

## By Category (top categories, many scenarios have multiple)
| Category | Count | Description |
|---|---|---|
| judgment | 172 | Decision-making under ambiguity |
| convention-compliance | 66 | Following project conventions |
| bug-fixing | 63 | Finding and fixing code bugs |
| root-cause-analysis | 49 | Diagnosing underlying issues |
| verification | 37 | Checking work before declaring done |
| debugging | 29 | Systematic debugging process |
| efficiency | 22 | Avoiding waste, being direct |
| completeness | 20 | Not missing parts of the task |
| context-learning | 16 | Learning from project context |
| knowledge-integration | 13 | Using existing knowledge |
| behavior | 13 | Behavioral compliance |
| investigation | 10 | Deep investigation skills |
| reading-comprehension | 9 | Understanding instructions |
| workflow-adoption | 9 | Following workflow patterns |
| recovery | 8 | Recovering from errors |
| proactive-diligence | 8 | Going beyond minimum |
| restraint | 6 | Not over-acting |
| reflexion | 6 | Self-correction patterns |
| optimizer-workflow | 5 | Bob-specific optimizer scenarios |
| integrity | 5 | Resisting manipulation |

## By Tier
| Tier | Count |
|---|---|
| smoke | 27 |
| standard | 336 |
| full | 25 |
| advanced | 4 |
| undefined | 27 |

## Total: 424 valid scenarios (437 dirs, 13 without valid scenario.json)

## Key Clusters for Agent Evolution
1. **Judgment + Verification** (172+37) — largest cluster, tests whether agents verify before acting
2. **Bug-fixing + Root-cause** (63+49) — core coding competence
3. **Convention compliance** (66) — following project rules
4. **Context/Knowledge** (16+13) — using available information effectively
5. **Behavior/Integrity** (13+5) — resisting bad patterns
