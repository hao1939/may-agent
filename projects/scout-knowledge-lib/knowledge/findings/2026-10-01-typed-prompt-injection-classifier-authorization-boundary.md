<ai_context>
summary: "JevShield is an inspectable demonstration of a useful but limited pattern: a local model returns typed threat choices and probabilities, Python validates and normalizes them, and a deterministic threshold maps the highest score to ALLOW, REVIEW, or BLOCK. Typed output removes free-form parsing ambiguity and malformed responses fail closed, but it does not make the classifier an authorization system. At the inspected revision, source provenance is reported but does not affect the policy, taint is derived after classification, and the simulated ToolGuard executes every ALLOW result—including the code-representable case where threat_type is non-safe and therefore tainted but all numeric risks remain below review threshold. Independent capability, identity, scope, and effect policy must remain the final tool gate."
triggers: ["JevShield", "typed security decisions", "prompt injection classifier", "Nimble System One", "tool authorization", "taint tracking", "classifier policy boundary"]
last_updated: "2026-10-01"
source_basis: "HN item 49916630 and static inspection of rajatrao/jevshield at pinned revision ec3d87a5ab6fda5f492d2611b548a94f07386694. Scout read the complete repository tree, README, decision client, models, risk normalization, policy, taint, firewall, ToolGuard, API routes, attack corpus, benchmark, and relevant tests. Scout did not install dependencies, run the test suite, run Ollama/Nimble, execute the live benchmark, or validate detection accuracy."
</ai_context>

# Typed prompt-injection decisions are not tool authorization

**Date:** 2026-10-01  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=49916630  
**Repo:** https://github.com/rajatrao/jevshield  
**Inspected revision:** [`ec3d87a5ab6fda5f492d2611b548a94f07386694`](https://github.com/rajatrao/jevshield/commit/ec3d87a5ab6fda5f492d2611b548a94f07386694)

## Question

What does JevShield's typed local classifier make safer and more verifiable, and where does classification stop short of authorization for agent tool calls?

## Source-grounded architecture

JevShield sends five typed questions to Ollama's `/v1/systemone` endpoint for a configured Nimble decision model: threat type, injection strength, jailbreak strength, exfiltration probability, and tool-manipulation probability. The Python layer then:

1. parses the response into Pydantic choice, score, and `noul` answer types;
2. validates probability ranges and sums;
3. cross-checks reported score indices against their distributions;
4. normalizes four risk dimensions into `[0, 1]`;
5. chooses the maximum risk; and
6. maps it through configurable thresholds: below `0.50` is ALLOW, `0.50` through below `0.85` is REVIEW, and `0.85` or above is BLOCK.

Malformed responses, missing answers, invalid distributions, HTTP errors, and model failures return BLOCK by default. REVIEW requires approval and does not execute; BLOCK does not execute. The included tools are explicitly simulations, so the repository demonstrates gate placement without performing real email, filesystem, or shell effects.

This is a useful control shape. Typed answers remove the need to parse unconstrained model prose, deterministic normalization is testable, and evaluator failure is distinguishable from a substantive threat judgment. None of those properties establishes that the model classified the content correctly.

## Provenance and taint are labels, not enforcement in this revision

The README says untrusted text is data rather than instructions, and the source defines system/developer as trusted while web, documents, email, databases, retrieval, tools, and—by default—users are untrusted. However, static inspection shows two important boundaries:

- `Firewall.analyze` computes `trusted_source`, but that boolean is only returned as metadata; it is not an input to `apply_policy`.
- `is_tainted` runs after classification and marks content tainted only when the model's threat type is non-safe or a numeric risk reaches the review threshold. Merely coming from an untrusted source does not set taint.

The ToolGuard first rejects tainted content only when its decision is not ALLOW. It then executes every ALLOW result. Because policy uses only the four numeric risks while taint also uses the categorical threat type, the source explicitly permits a non-safe `threat_type` with all scores below `0.50` to be both **tainted and ALLOW**. In that representable case, ToolGuard reaches its ALLOW branch and executes the simulated tool.

That does not prove a live model will often emit this combination. It does show that the stated data/control separation is not a structural invariant of the enforcement code. It depends on classifier calibration and answer consistency.

## The reusable boundary

Typed model output improves the integrity of the **classifier-to-policy interface**. It does not supply the non-model facts needed for authorization:

- caller and credential identity;
- the exact capability and resource being requested;
- tenant, path, destination, amount, and other scope restrictions;
- whether the action was already approved or already performed;
- authoritative preconditions and idempotency identity; and
- a post-call receipt from the system of record.

A production tool gate should therefore combine model-derived risk with independent policy. A safe composition is:

`typed risk evidence + provenance + capability policy + current authority + explicit approval + effect reconciliation`

The model can raise scrutiny or block suspicious input. An ALLOW score should not widen authority beyond what deterministic identity, capability, and effect rules already permit. Taint should also be monotonic where the architecture promises a data/instruction distinction: untrusted provenance should survive low classifier scores rather than disappear when the model is confident.

## Evaluation evidence and limits

The repository contains 30 synthetic samples across benign, direct injection, indirect injection, jailbreak, exfiltration, and tool-manipulation categories. Its live benchmark reports accuracy, precision, recall, F1, false-positive and false-negative rates, exact decision match, and latency. Unit tests mock the decision client; the benchmark is the path that calls live `/v1/systemone`.

No benchmark result artifact is stored in the inspected tree, and the README publishes no measured scores. Scout attempted to run the unit tests from the pinned tarball, but the supplied environment lacked `pytest`, `pydantic`, `httpx`, and `fastapi`; Scout did not install packages. Presence of the corpus and tests therefore establishes inspectable evaluation machinery, not passing tests or effective detection. The project itself correctly labels the code a research/demonstration defense-in-depth layer and warns against treating classifier ALLOW as sufficient protection.

## Comparison with existing Scout knowledge

[Agent enforcement claims should be versioned by harness, event, and effect](./2026-09-30-verifiable-agent-enforcement-capabilities.md) separates pre-effect blocking from observation and post-effect replacement. JevShield adds a complementary boundary inside a pre-tool gate: even when the hook occurs before execution, typed classifier output is evidence for a decision, not authority for the effect. Both findings argue that “the guard returned ALLOW” is weaker than proving the caller was entitled to perform this exact operation.

## Sources reviewed

- [HN item 49916630](https://news.ycombinator.com/item?id=49916630)
- [Repository at the inspected revision](https://github.com/rajatrao/jevshield/tree/ec3d87a5ab6fda5f492d2611b548a94f07386694)
- [README](https://github.com/rajatrao/jevshield/blob/ec3d87a5ab6fda5f492d2611b548a94f07386694/README.md)
- [Decision client](https://github.com/rajatrao/jevshield/blob/ec3d87a5ab6fda5f492d2611b548a94f07386694/app/security/decision_client.py)
- [Risk normalization](https://github.com/rajatrao/jevshield/blob/ec3d87a5ab6fda5f492d2611b548a94f07386694/app/security/risk.py)
- [Deterministic policy](https://github.com/rajatrao/jevshield/blob/ec3d87a5ab6fda5f492d2611b548a94f07386694/app/security/policy.py)
- [Taint logic](https://github.com/rajatrao/jevshield/blob/ec3d87a5ab6fda5f492d2611b548a94f07386694/app/security/taint.py)
- [Firewall orchestration](https://github.com/rajatrao/jevshield/blob/ec3d87a5ab6fda5f492d2611b548a94f07386694/app/security/firewall.py)
- [ToolGuard](https://github.com/rajatrao/jevshield/blob/ec3d87a5ab6fda5f492d2611b548a94f07386694/app/security/tool_guard.py)
- [Live benchmark](https://github.com/rajatrao/jevshield/blob/ec3d87a5ab6fda5f492d2611b548a94f07386694/benchmarks/evaluate.py)
- [ToolGuard tests](https://github.com/rajatrao/jevshield/blob/ec3d87a5ab6fda5f492d2611b548a94f07386694/tests/test_tool_guard.py)

## Discovery coverage

The live HN Algolia `search_by_date` query for `AI agent` stories newer than Unix time `1790813231` returned four items: 49916751, 49916630, 49916222, and 49916205. JevShield was selected because its complete repository exposed a concrete classifier, policy, taint, tool-gate, test, and benchmark boundary. The other items were an evidence-light Ask HN post, a social-media claim about agent fraud, and a video interview; their feed metadata alone did not justify durable claims.
