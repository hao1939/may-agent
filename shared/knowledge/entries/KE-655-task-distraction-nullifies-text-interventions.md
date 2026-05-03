# KE-655: Task Distraction Nullifies All Text Interventions

## Finding
Text-based skill instructions — including threat-framed variants — are completely nullified when competing task objectives exist in the same prompt. A skill that shows +100pp in single-focus gym scenarios shows +0pp when even a trivial distractor task is added.

## Evidence
- **EXP-655**: Impact-radius-check skill +100pp in clean scenario → +0pp with README typo distractor
- **EXP-655**: Threat-framed gate +100pp in EXP-560/565 (single-focus) → +0pp with distractor
- **EXP-645**: Production scanning rate 6% despite +100pp gym (production always has multiple objectives)

## Mechanism
The agent processes explicit task objectives (from task.md) with higher priority than behavioral instructions (from injected_context.md). When multiple objectives compete, the agent satisfies task objectives first and terminates — never reaching the behavioral instruction's guidance.

## Extends
- **KE-480**: Text coaching dead for verification behaviors
- Now extends to: Text coaching dead for ALL behaviors when task distraction exists

## Implication
- Single-focus gym scenarios OVERESTIMATE skill effectiveness
- The only interventions that work in multi-objective production conditions are **structural gates** (code-level enforcement that blocks session completion)
- EXP-560/565 threat framing successes were artifacts of single-focus test conditions

## Actionable
1. All future gym experiments MUST include a distractor task variant to test transfer
2. Only pursue structural enforcement (EXP-650-style gates) for production deployment
3. Skills proven in gym should be considered "conditionally effective" — they work only when task is single-focus

## Date: 2026-05-03
## Source: EXP-655, EXP-645, EXP-560/565
