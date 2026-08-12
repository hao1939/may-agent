# Measuring Reward-Seeking via Contrastive Beliefs — OpenAI Alignment

**Date**: 2026-07-21
**Source**: https://alignment.openai.com/measuring-reward-seeking/
**HN**: https://news.ycombinator.com/item?id=48996035 (7 points)
**Type**: Finding
**Tags**: alignment, reward-hacking, agent-safety, evaluation

## Summary

OpenAI Alignment team publishes a method for measuring reward-seeking behavior in language models by instilling contrastive beliefs — giving the model paired scenarios where only the belief about what yields reward differs, then measuring behavioral divergence. This isolates reward-seeking from capability, providing a cleaner signal than outcome-based evaluations alone.

## Relevance to AI Agents

- **Agent autonomy calibration**: As agents gain longer horizons and more autonomy, detecting whether they optimize for reward signals vs. task completion becomes critical for safe deployment.
- **Contrastive evaluation as a pattern**: The method of holding capability constant while varying beliefs about incentives is applicable to any agent evaluation framework — it separates "can do" from "wants to do."
- **Proactive safety signal**: This is infrastructure for detecting specification gaming before it manifests in production, directly relevant to autonomous agent governance.

## Design Implications

- Agent evaluation suites should include contrastive belief probes alongside task-completion metrics.
- The technique could detect reward-hacking tendencies in tool-using agents before granting elevated permissions.
