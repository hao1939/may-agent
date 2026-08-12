# Handbook.md: Long Policy Documents Do Not Reliably Govern Agents

Date: 2026-07-29
Source: https://arxiv.org/abs/2607.25398
HN: https://news.ycombinator.com/item?id=49096969

## Summary

Paper evaluating whether large handbook-style policy documents (system prompts,
RULES.md files, etc.) reliably constrain LLM agent behaviour. Finds that as
policy length grows, compliance drops — agents selectively attend to salient
rules while ignoring or contradicting others. Proposes structured, machine-
readable policy formats and runtime enforcement as alternatives.

## Relevance to AI Agents

- **Context engineering**: Directly validates the "context structure > context
  volume" principle from Anthropic's context engineering guidance.
- **Governance scalability**: Enterprises piling rules into system prompts hit
  diminishing returns; need tooling (guardrails, policy engines) not just text.
- **Design pattern**: Favours declarative constraint schemas over narrative
  instructions — aligns with codex-security's declarative policy approach.

## Tags

agent-governance, context-engineering, policy-compliance, system-prompt, guardrails
