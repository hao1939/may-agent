# KE-700: When Text Rules Work (Conditions for Text-Based Behavior Change)

## Date: 2029-07-28
## Source: Meta-analysis of EXP-018, EXP-345, EXP-350, EXP-280, EXP-645
## Extends: KE-350 (Text Cannot Enforce Verify), KE-645 (Cognitive Skills Fail Without Gates)

## Finding

Text-based instructions (skill files, context.md rules, coaching prompts) change agent behavior **only** under specific conditions. Outside these conditions, text has 0% effect regardless of framing.

## Conditions Where Text Works

### 1. Simple Tool-Choice Habits (EXP-018)
- **What**: "Use grep before reading large files"
- **Effect**: +25pp (6/8 → 8/8)
- **Why it works**: Concrete trigger ("before ANY read()"), single alternative action, no competing prior to override

### 2. Judgment Checklists for Novel Situations (EXP-345)
- **What**: "Check for requirement conflicts before implementing"
- **Effect**: +67pp on full pass; eliminated catastrophic failures (0/3 checks → 2/3 minimum)
- **Why it works**: Agent has no strong prior for how to handle conflicting requirements. The skill FILLS A GAP rather than fighting an existing habit.

## Conditions Where Text Fails

### 1. Mechanical Compliance Against Priors (EXP-280, 340, 350)
- **What**: "Verify your edit by reading the file back"
- **Effect**: 0pp across 3 different text approaches
- **Why it fails**: Agent has strong "fix and move on" prior. Text cannot override habitual execution patterns.

### 2. Production Transfer of Any Text Skill (EXP-645)
- **What**: Cognitive skills that work in gym
- **Effect**: ~0pp in production (6% compliance vs 100% in gym)
- **Why it fails**: Task prompt dominates, context.md is background noise, time pressure favors defaults

## The Decision Rule

Before designing a text-based intervention, ask:

| Question | Yes → Text may work | No → Need structural gate |
|----------|---------------------|--------------------------|
| Is the agent's current behavior "no behavior" (gap) rather than "wrong behavior" (habit)? | ✅ | ❌ |
| Is it a single concrete action with an obvious trigger? | ✅ | ❌ |
| Does it require restraint or slowing down? | ❌ | ❌ |
| Is it needed in production (not just gym)? | ❌ (text fails in production) | ❌ |

**Summary heuristic**: Text works for **"what to think about"** (judgment checklists). Text fails for **"what to do mechanically"** (compliance actions).

## Practical Guidance

1. **Judgment gaps** (conflicting requirements, tradeoff analysis): Try text FIRST. It's cheaper.
2. **Mechanical habits** (verify-after-edit, test-before-commit): Skip text, go directly to structural gates.
3. **Production deployment**: Even judgment skills need structural reinforcement for production transfer.
4. **Experiment triage**: If the target behavior requires restraint or fights an existing pattern, don't waste an experiment on text.

## Status: WRITTEN ✅
