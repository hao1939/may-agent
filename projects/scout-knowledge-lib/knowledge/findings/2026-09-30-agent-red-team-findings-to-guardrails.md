<ai_context>
summary: "Humanbound connects multi-turn adversarial tests of a live agent endpoint to two distinct deployment artifacts: a scope policy for an LLM firewall and a local list distilled from failed judge insights. The useful pattern is to preserve test evidence, policy, and enforcement as separate layers; an exported rule is not proof that an enforcement point matches attacks correctly or that the judge verdict was valid."
triggers: ["Humanbound", "agent red teaming", "test-to-guardrail", "adversarial agent testing", "guardrail export", "LLM-as-a-judge", "security policy export", "humanbound-firewall"]
last_updated: "2026-09-30"
source_basis: "Static inspection of the Humanbound README, guardrail documentation, export implementation, and mocked unit tests at commit b55d6677270118a299b3f4904563187bb61cbd7e, surfaced by Hacker News item 49907551. Scout did not install or execute Humanbound, attack an agent, inspect the hosted platform, or validate the separate firewall runtime."
</ai_context>

# Keep red-team evidence, policy, and enforcement separate in a test-to-guardrail loop

**Date:** 2026-09-30  
**Disposition:** New knowledge  
**Repo:** https://github.com/humanbound/humanbound/tree/b55d6677270118a299b3f4904563187bb61cbd7e  
**HN:** https://news.ycombinator.com/item?id=49907551

## Observation

Humanbound is an Apache-2.0 adversarial-testing CLI and SDK for AI agents. Its local runner can drive multi-turn conversations against a live agent endpoint, optionally create a fresh thread for each conversation, and use a declared scope to target prohibited behavior such as tool abuse. The project documents an LLM judge that assigns pass/fail verdicts, confidence, and explanations for scope adherence, disclosure, instruction following, and safety boundaries.

The interesting design is the handoff from a test result to a runtime-defense artifact. Static inspection at pinned commit `b55d6677270118a299b3f4904563187bb61cbd7e` shows that `hb guardrails` actually exposes two different handoffs:

1. **Policy export:** local YAML carries the scope saved with the latest run—or an explicitly supplied scope—into an `agent.yaml` containing business scope, permitted and restricted intents, and enabled capabilities. The documentation says a separate firewall's Tier 3 judge consumes that policy.
2. **Finding-derived rule export:** local JSON reads the latest experiment's insights, retains only entries whose result is `fail`, and emits one blocking rule per failed insight. The rule carries the insight category as `threat_class`, up to 200 characters of its explanation as `pattern`, its severity, and the source experiment identifier.

The unit tests confirm the serialization and compatibility boundaries rather than the security outcome: mocked tests check failed-insight conversion, legacy insight fallback, scope selection, error handling, and that an exported YAML file can be loaded by an installed firewall package. They do not show that the generated local pattern detects a future attack, that blocking it avoids false positives, or that the judge's original verdict was correct.

## Reusable pattern

A test-to-defense loop should retain at least four separately inspectable layers:

1. **Test evidence:** target revision, endpoint configuration, full adversarial conversation, tool effects, attacker and judge model/configuration, and raw verdict.
2. **Policy intent:** the stable business scope, prohibited actions, capabilities, and trust classes against which behavior should be judged.
3. **Derived artifact:** the exact rule, classifier sample, or judge example generated from a failure, linked back to its experiment and evidence.
4. **Enforcement validation:** a replay showing that the deployment control blocks the failed case plus nearby variants while preserving allowed behavior.

Humanbound already includes some useful identity: local rules name their source experiment, and policy export uses the scope attached to the latest run. But the local rule artifact does not include a log identifier, judge configuration, confidence, full attack text, target revision, or a validation result. A production loop should add those links rather than treating `hb guardrails` success as evidence that the vulnerability is fixed.

The two export modes also should not be collapsed conceptually. A scope policy is a general statement of allowed behavior; a failed-insight rule is a narrow observation derived from one test. Policy changes need review for intended authority, while finding-derived controls need regression and false-positive evaluation. Both can feed enforcement, but they carry different provenance and generalization claims.

## What this does and does not establish

The repository provides an inspectable example of transporting red-team results toward deployment controls. It does **not** establish an automatic security fix:

- the documented judge is itself an LLM, so verdict quality and calibration remain model- and rubric-dependent;
- local `pattern` is the judge's truncated natural-language explanation, not demonstrated matching logic or an executable detector in the inspected command;
- the YAML compatibility test proves that the separate firewall can parse the exported schema, not that its runtime decision is correct;
- documentation says few-shot examples are not yet included in the policy export, leaving part of the described learning loop outside the artifact;
- local export selects the lexicographically latest results directory, so run naming and evidence retention affect which experiment supplies a rule or scope; and
- the README's phrase “the same run that finds a hole also patches it” is therefore stronger than the inspected evidence supports.

## Evidence limits

- Scout statically inspected the README, guardrail documentation, LLM-judge documentation, `humanbound_cli/commands/guardrails.py`, and `tests/unit/test_guardrails.py` at the pinned revision.
- Scout did not install the package, run its tests, attack a live endpoint, reproduce a judge verdict, inspect the hosted platform's policy recommendations, or inspect and execute the separate `humanbound-firewall` repository.
- The inspected guardrail tests use mocks for platform calls. They provide implementation-contract evidence, not an end-to-end security evaluation.
- HN item 49907551 had 1 point and no comments when checked, so Hacker News supplied discovery rather than independent corroboration.

## Sources

- Humanbound repository at pinned revision: https://github.com/humanbound/humanbound/tree/b55d6677270118a299b3f4904563187bb61cbd7e
- Guardrails documentation at pinned revision: https://github.com/humanbound/humanbound/blob/b55d6677270118a299b3f4904563187bb61cbd7e/docs/docs/defense/guardrails.md
- Guardrail export implementation at pinned revision: https://github.com/humanbound/humanbound/blob/b55d6677270118a299b3f4904563187bb61cbd7e/humanbound_cli/commands/guardrails.py
- Guardrail unit tests at pinned revision: https://github.com/humanbound/humanbound/blob/b55d6677270118a299b3f4904563187bb61cbd7e/tests/unit/test_guardrails.py
- LLM-as-a-judge documentation at pinned revision: https://github.com/humanbound/humanbound/blob/b55d6677270118a299b3f4904563187bb61cbd7e/docs/docs/concepts/llm-as-judge.md
- Hacker News item 49907551: https://news.ycombinator.com/item?id=49907551
