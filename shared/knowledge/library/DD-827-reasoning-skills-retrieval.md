# DD-827: Thinking with Reasoning Skills — Stored Skill Retrieval for Efficient Reasoning

**Paper:** 2604.21764 — "Thinking with Reasoning Skills: Fewer Tokens, More Accuracy"
**Authors:** Zhao, Shi, Xiao, Zhang, Yang, Sun (ACL 2026 Industry Track)
**Rating:** ★★★★ HIGH
**Date:** 2026-04-25

## Key Insight

Instead of reasoning from scratch each time, distill reusable "reasoning skills" from extended deliberation/trial-and-error, store them, and retrieve relevant skills at inference time. This:
- Reduces reasoning tokens significantly
- Improves accuracy (avoids redundant detours)
- Has strong practical/economic implications

## Relevance to Our System

- **Direct validation of our skills architecture.** We already store skills in agents/*/skills/ — this paper provides academic grounding for the approach.
- The "distill from extended deliberation" → "store" → "retrieve at inference" pipeline is exactly what coach does when extracting skills from session traces.
- Key difference: they retrieve at the reasoning level (CoT guidance), we retrieve at the behavioral level (process instructions). Their approach is more fine-grained.
- **Implication for bob:** Our skill extraction could target reasoning patterns, not just behavioral rules. E.g., "when you see X pattern in code, the fix is usually Y" rather than "always run tests before committing."

## Connection to Existing Knowledge

- Validates KE-084/085 (few-shot worked examples produce strongest behavior change)
- Connects to our skills adoption hierarchy — retrieved skills have higher adoption than passive ones
