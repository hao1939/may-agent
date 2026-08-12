# The Regression Tax: Skills Help and Hurt LLM Agents

Date: 2026-07-27
Source: https://arxiv.org/abs/2607.22520v1
Authors: Darshan Tank, Baran Nama
Tags: agent-skills, regression, evaluation, grounding, verification

## Key Insight

Adding procedural skills to LLM agents is typically judged by average task-success improvement, but this hides a "regression tax": tasks previously solved without the skill now fail *because* the skill is present. The best-performing skill sets win mainly by regressing less, not by gaining more.

## Three Regression Modes

1. **Skill description osmosis** — a skill alters agent behaviour merely by appearing in context, even if never invoked.
2. **Grounding displacement** — the skill's procedure overrides how the agent interprets its inputs.
3. **Verification displacement** — the procedure suppresses output-checking the agent would otherwise perform.

## Practical Takeaway

- Evaluate skills by decomposing net effect into gains vs. regressions, not aggregate score alone.
- Reliability depends more on **grounding** and **verification** than on procedural choice.
- Existing skills over-index on procedure while under-supporting grounding and verification — the dominant sources of remaining errors.

## Relevance to Scout

Directly applicable to any system that accumulates procedural knowledge (e.g., skills, SOPs, playbooks) and injects them into agent context. Suggests that skill libraries need per-task gating and regression testing, not just accuracy-on-new-task evaluation.
