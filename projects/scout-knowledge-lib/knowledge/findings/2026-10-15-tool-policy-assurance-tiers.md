<ai_context>
summary: "StackOne's Tool Policies announcement usefully separates deterministic tool, value, and field rules from model-decided semantic classification, but supplies product claims rather than implementation or enforcement evidence."
triggers: ["StackOne Tool Policies", "tool gateway", "field-level policy", "semantic authorization", "Cedar policy", "monitor mode"]
last_updated: "2026-10-15"
source_basis: "Complete public StackOne launch article and HN item 50107215, observed 2026-10-15. Scout did not inspect product source, generated Cedar, policy tests, decision traces, model evaluations, or a live deployment."
</ai_context>

# Keep deterministic and model-decided tool policy in separate assurance tiers

**Date:** 2026-10-15  
**Disposition:** New knowledge  
**Source:** https://www.stackone.com/blog/tool-policies-launch/  
**HN:** https://news.ycombinator.com/item?id=50107215

## Question

What useful enforcement boundary—and what assurance gap—appears in StackOne's newly announced policy layer for agent tool calls?

## Source observation

StackOne describes a gateway that checks both the request before calling a connected business system and the response before returning it to an agent. Its policy surface has five rule types:

- tool-name rules, including patterns such as `*delete*`;
- numeric or other input-value limits, such as a payment range;
- field-path rules that protect request fields or mask response fields;
- PII redaction over payloads; and
- natural-language semantic questions, such as whether a field contains compensation.

Rules can be scoped by identity-provider user or group and by project, connector category, connector, or linked account. The article says fixed rules compile to Cedar, conflicting rules resolve to deny, and each rule can first run in Monitor mode to log a counterfactual decision without blocking the call. It also says semantic classification is performed by a decision model and leaves a field masked when that model cannot decide.

The HN submission's only comment at inspection is from a self-identified StackOne employee. It repeats that fixed Cedar rules, model-answered semantic rules, and a proprietary PII model are checked on each tool call's input and output; it adds no independent evaluation or implementation detail.

## Interpretation

The useful pattern is not simply “put policy in a gateway.” It is to keep assurance tiers visible inside that gateway:

1. deterministic identity, tool, argument, and field rules can be tested against exact inputs and expected decisions;
2. model-decided semantic classification is broader but probabilistic and needs its own abstention, false-negative, drift, and version evidence;
3. monitor-only decisions are rollout evidence, not proof that effects were blocked; and
4. an allow or deny verdict proves enforcement only if every equivalent effect route actually passes through the mediator.

A policy UI should therefore preserve rule type, evaluator version, monitor-versus-enforce mode, matched scope, decision, transformed fields, and the downstream call receipt. Otherwise a single “policy applied” log can blur deterministic authorization, semantic detection, redaction, and actual effect prevention.

## Limits

This is a vendor launch announcement for an early-access product, not independent security validation. Scout read the complete public article and HN item but did not inspect source code, generated Cedar, policy schemas, test suites, action logs, decision traces, deployment topology, or a live system. The article's comparative platform table, customer anecdotes, PII and prompt-injection benchmark figures, fail-closed semantic behavior, deny precedence, and claim that every relevant action traverses StackOne were not independently verified. A gateway can govern only calls routed through it; the source does not establish complete mediation across direct application access, other gateways, plugins, aliases, or equivalent effects.

## Evidence inspected

- [StackOne launch article](https://www.stackone.com/blog/tool-policies-launch/)
- [HN item 50107215](https://news.ycombinator.com/item?id=50107215)
