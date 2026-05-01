# Canonical Scenario Catalog

Generated from `/app/agents/gym/scenarios/` — 476 total scenario directories.

## Summary
- **Total scenarios with scenario.json**: 476
- **Scenarios with variants (true bases)**: 87
- **Standalone scenarios (no variants)**: 112

## Base Scenarios (have ≥1 variant)

These are the canonical scenarios that have been iterated on via experiments:

| Scenario | Variants | Agent | Difficulty | Categories |
|----------|----------|-------|------------|------------|
| cascading-fix-trap | 39 | coder | ? | bug-fixing |
| cascading-fix-trap-v2 | 33 | ? | hard | ? |
| contradictory-requirements | 22 | coder | ? | judgment |
| sql-injection-in-query-builder | 13 | ? | ? | bug-fixing, judgment |
| ambiguous-context-drift | 10 | coder | ? | judgment, verification |
| metric-reaction | 10 | coder | ? | behavior, metrics |
| use-persistent-task | 8 | bob | ? | workflow-adoption |
| misleading-test-fix | 7 | coder | ? | judgment, root-cause |
| sycophants-dilemma | 7 | coder | ? | judgment |
| kb-integration-discovery | 5 | coder | ? | completeness, knowledge-integration |
| read-before-edit | 5 | coder | ? | convention-compliance |
| approach-validation-trap | 4 | coach | ? | judgment, root-cause-analysis |
| contradictory-requirements-ext | 4 | coder | ? | judgment |
| partial-verification-trap | 4 | coder | ? | judgment, bug-fixing |
| ambiguous-context-drift-L3 | 3 | coder | ? | judgment, verification, recovery |
| behavior-escalation-stubborn | 3 | coder | ? | judgment, convention-compliance |
| cascading-fix-trap-v3 | 3 | ? | hard | relational-bug, cascading-fix |
| compound-edit-verification | 3 | coder | ? | judgment, verification |
| context-learning | 3 | coder | ? | context-learning, self-improvement |
| convention-verify-edit | 3 | coder | ? | convention-compliance |
| ghost-dependency-debug | 3 | coder | ? | debugging |
| phantom-fix | 3 | coder | ? | bug-fixing |
| silent-dependency | 3 | coder | ? | bug-fixing |
| skip-verification | 3 | coder | ? | proactive-diligence |
| ambiguous-context-drift-ext | 2 | coder | ? | judgment, verification |
| conflicting-evidence | 2 | any | medium | investigation, error-handling |
| context-npx-avoidance | 2 | coder | ? | context-learning, proof |
| escalation-impossible-task | 2 | coder | ? | judgment, convention-compliance |
| hidden-dependency | 2 | coder | ? | root-cause-analysis |
| idempotent-already-fixed | 2 | coder | ? | convention-compliance, efficiency |
| investigate-fix-pattern | 2 | coder | ? | proactive-diligence, convention-compliance |
| judgment-ambiguous-spec | 2 | coder | ? | judgment |
| multi-file-verify-gap | 2 | coder | ? | judgment, verification |
| reflexion-npx-recovery | 2 | coder | ? | context-learning, reflexion |
| reflexion-read-before-edit | 2 | coder | ? | context-learning, reflexion |
| regression-from-fix | 2 | ? | medium | bug-fixing, verification |
| script-discovery-debug | 2 | coder | ? | bug-fixing, root-cause-analysis |
| abandoned-branch | 1 | coder | ? | bug-fixing, completeness |
| assertion-without-evidence | 1 | coder | ? | judgment, verification |
| cascading-error | 1 | coder | ? | root-cause-analysis |
| cascading-fix-trap-v2-rootcause | 1 | coder | ? | debugging, root-cause-analysis |
| cascading-fix-trap-v2-tool | 1 | ? | hard | ? |
| context-proof-build | 1 | coder | ? | context-learning, proof |
| convention-verify-multi-edit | 1 | coder | ? | convention-compliance |
| delegation-scope-boundary | 1 | coder | ? | judgment, delegation |
| efficient-file-reading | 1 | coder | ? | convention-compliance, efficiency |
| error-recovery-broken-config | 1 | coder | ? | error-recovery |
| escalation-judgment-fewshot | 1 | coder | ? | judgment |
| fm33-verify-broken | 1 | coder | ? | verification, behavioral, judgment |
| hasty-fix | 1 | coder | ? | bug-fixing |
| heartbeat-pressure | 1 | bob | ? | cognitive-load, convention-compliance |
| ignore-deprecation | 1 | coder | ? | judgment |
| incomplete-deliverables-trap | 1 | optimizer | ? | completeness, implementation |
| incremental-context-loading | 1 | coder | ? | convention-compliance, efficiency |
| kb-integration-multi-file | 1 | coder | ? | completeness, knowledge-integration |
| knowledge-base-navigation | 1 | bob | ? | convention-compliance, efficiency |
| materialize-intermediate-findings | 1 | coder | ? | convention-compliance, efficiency |
| metric-reaction-G | 1 | coder | ? | behavior, metric-reaction |
| metric-reaction-Gp | 1 | coder | ? | behavior, metric-reaction |
| misleading-stacktrace | 1 | coder | ? | root-cause-analysis, error-recovery |
| missing-prerequisite-detection | 1 | coder | ? | convention-compliance, judgment |
| mock-leak-trap | 1 | coder | ? | judgment, bug-fixing |
| phantom-fix-config | 1 | coder | ? | bug-fixing |
| plan-once-amend | 1 | coder | ? | convention-compliance, efficiency |
| premature-optimization | 1 | coder | ? | restraint |
| qa-overstrict-gate | 1 | qa | ? | judgment, review |
| qa-severity-calibration | 1 | qa | ? | judgment, review |
| read-before-edit-verify-gate | 1 | coder | ? | convention-compliance |
| red-herring-investigation | 1 | any | hard | investigation, judgment |
| scope-creep-resistance | 1 | ? | ? | judgment, reading-comprehension |
| scout-coder-calc | 1 | coder | ? | debugging, root-cause-analysis |
| search-strategy-escalation | 1 | coder | ? | convention-compliance, efficiency |
| silent-data-corruption | 1 | coder | hard | judgment, debugging |
| skip-review-step | 1 | coder | ? | judgment |
| spec-adherence-multi-step | 1 | coder | ? | convention-compliance |
| stale-approach-fixation | 1 | coder | ? | efficiency, convention-compliance |
| stale-config-override | 1 | ? | ? | bug-fixing, judgment |
| stale-error-misdiagnosis | 1 | coder | ? | investigation, judgment |
| sycophants-dilemma-workflow | 1 | coder | ? | judgment |
| truncated-env-repair | 1 | coder | ? | bug-fixing, recovery |
| truncated-schema-migration | 1 | coder | ? | bug-fixing, recovery |
| unverified-finish | 1 | coder | ? | verification, behavioral |
| verification-contradiction | 1 | ? | ? | ? |
| verify-before-finish | 1 | coder | ? | convention-compliance, verification |
| wrong-error-message | 1 | ? | ? | bug-fixing, judgment |
| wrong-fix-recovery | 1 | ? | ? | bug-fixing, root-cause-analysis, judgment |
| wrong-tool-args | 1 | coder | ? | bug-fixing |

## Standalone Standard Scenarios (no variants, tier=standard)

| Scenario | Agent | Difficulty | Categories |
|----------|-------|------------|------------|
| behavior-resource-convergence | coder | ? | efficiency, convention-compliance |
| bloated-refactor | coder | ? | restraint |
| breadcrumb-reaction | coder | ? | behavior, breadcrumb-gap |
| budget-crunch-verify | coder | ? | bug-fixing, verification |
| build-activation-gap | coder | medium | verification, deployment |
| cascade-judgment | coder | ? | judgment |
| cc-edit-without-read | coder | ? | convention-compliance |
| cc-finish-without-evidence | coder | ? | convention-compliance |
| cc-hallucinated-paths | coder | ? | convention-compliance |
| cc-write-without-verify | coder | ? | convention-compliance |
| close-the-loop | coder | ? | behavior, system-evolution |
| coder-post-write-verify | coder | ? | verification, behavioral |
| confabulation-detection | coder | ? | verification, critical-thinking |
| conflicting-requirements-tradeoff | coder | hard | judgment, communication |
| context-proof-config | coder | ? | context-learning, proof |
| context-proof-runtime | coder | ? | context-learning, proof |
| convention-promise-report | coder | ? | convention-compliance |
| convention-retry-pivot | coder | ? | bug-fixing, convention-compliance |
| copy-paste-vuln | coder | ? | feature-add, security |
| credentials-shortcut | coder | ? | judgment, security |
| cross-agent-cooperation | coder | ? | collaboration, communication |
| delegation-verify-pattern | coder | ? | judgment, delegation |
| delete-test-files | coder | ? | judgment, testing |
| deprecation-warning-cleanup | ? | ? | bug-fixing, judgment |
| design-cache-strategy | coder | medium | design, judgment |
| downgrade-security | coder | ? | judgment |
| drudgery-multi-file | coder | ? | completeness |
| enoent-file-search | ? | ? | bug-fixing, navigation |
| error-cascade-diagnosis | coder | ? | bug-fixing, diagnosis |
| escalation-judgment-base | coder | ? | judgment |
| escalation-judgment-mismatched-fewshot | coder | ? | judgment |
| evidence-gate-pass | coder | ? | workflow, evidence |
| evidence-gate-reject | coder | ? | workflow, evidence |
| exp-rec-stale-config-gate | ? | ? | bug-fixing, judgment |
| exp-rec-wrong-error-gate | ? | ? | bug-fixing, judgment |
| exp096-arm-a | coder | ? | judgment |
| exp096-arm-b | coder | ? | judgment |
| exp096-arm-c | coder | ? | judgment |
| exp097-arm-a | coder | ? | judgment |
| exp097-arm-b | coder | ? | judgment |
| exp144-compound-edit-decoupled | coder | ? | judgment, verification |
| exp144-compound-edit-structured | coder | ? | judgment, verification |
| exp144-hidden-dep-decoupled | coder | ? | root-cause-analysis |
| exp144-hidden-dep-structured | coder | ? | root-cause-analysis |
| exp155-hidden-dep-hard-gate | coder | ? | root-cause-analysis |
| exp156-context-drift-hard-gate | coder | ? | judgment, verification |
| exp156-misleading-test-hard-gate | coder | ? | judgment, root-cause |
| exp157-mock-leak-hard-gate | coder | ? | judgment, bug-fixing |
| exp163-baseline | coder | ? | root-cause-analysis |
| exp163-f1-only | coder | ? | root-cause-analysis |
| exp163-f2-only | coder | ? | root-cause-analysis |
| exp163-full-gate | coder | ? | root-cause-analysis |
| exp164-baseline | coder | ? | judgment, root-cause |
| exp164-f1-only | coder | ? | judgment, root-cause |
| exp164-f2-only | coder | ? | judgment, root-cause |
| exp164-full-gate | coder | ? | judgment, root-cause |
| exp165-baseline | coder | ? | debugging, root-cause-analysis |
| exp165-f1-only | coder | ? | debugging, root-cause-analysis |
| exp165-f2-only | coder | ? | debugging, root-cause-analysis |
| exp165-full-gate | coder | ? | debugging, root-cause-analysis |
| exp172-scout-coder | coder | ? | debugging, root-cause-analysis |
| exp175-arm-b | coder | ? | debugging, root-cause-analysis |
| exp175-arm-c | coder | ? | debugging, root-cause-analysis |
| exp175-arm-d | coder | ? | debugging, root-cause-analysis |
| explore-config-drift | any | hard | investigation, configuration |
| explore-perf-bottleneck | any | medium | investigation, performance |
| fabricated-path-claim | code | ? | verification, path-handling |
| false-green-deploy | coder | ? | judgment |
| fm26-scope-enoent-pivot | coder | ? | scope, behavioral, judgment |
| ghost-deliverable-detection | coder | ? | judgment, verification |
| h210-contradictory-coaching-cfv | bob | ? | coordination, safety |
| harmful-refactor | coder | ? | judgment, refactoring |
| heartbeat-project-creation | bob | ? | system-literacy |
| heartbeat-triage-gap | bob | ? | judgment |
| help-blocked-agent | coder | ? | collaboration, debugging |
| hidden-second-bug | ? | ? | bug-fixing, thoroughness |
| incomplete-test-coverage | coder | medium | judgment, thoroughness |
| infinite-gardener | coder | ? | reading-comprehension |
| instruction-noise-compliance | coder | ? | judgment, reading-comprehension |
| judgment-conflicting-request | coder | ? | integrity |
| judgment-destructive-trap | coder | ? | integrity |
| judgment-security-legit | coder | ? | integrity |
| kb-discovery-baseline-126 | coder | ? | completeness, knowledge-integration |
| kb-discovery-hints-126 | coder | ? | completeness, knowledge-integration |
| metric-autonomy-A | bob | ? | judgment, autonomy |
| misdiagnosed-regression | coder | ? | bug-fixing, investigation, judgment |
| missing-prerequisite-workflow | coder | ? | convention-compliance, judgment |
| multi-bug-pivot | coder | ? | bug-fixing, root-cause-analysis |
| multi-bug-review | qa | ? | cognitive-load, convention-compliance |
| noisy-context-verify | coder | ? | bug-fixing, verification |
| order-compliance | bob | ? | instruction-following |
| output-format-compliance | bob | ? | convention-compliance, instruction-following |
| partial-config-migration | coder | medium-hard | investigation, reading-comprehension |
| partial-ghost-deliverable | coder | ? | judgment, verification |
| partial-migration-leftover | ? | ? | bug-fixing, judgment |
| partial-rollback-judgment | coder | ? | bug-fixing, judgment |
| partial-success-mirage | code | ? | verification, testing |
| partial-test-pass | coder | ? | judgment, verification |
| phantom-nudge-trap | any | ? | verification, notification-handling |
| phase-boundary-violation | coder | ? | judgment, convention-compliance |
| premature-abstraction-trap | coder | ? | judgment |
| progressive-work-persistence | coder | ? | proactive-diligence |
| qa-finish-compliance | qa | ? | convention-compliance |
| red-herring-log | coder | ? | root-cause-analysis |
| request-triage-memoization | coder | ? | convention-compliance, efficiency |
| research-and-report | bob | ? | cognitive-load, convention-compliance |
| scope-creep-multifile | coder | ? | judgment, focus |
| scope-creep-related-fix | coder | ? | restraint, scope-discipline |
| scope-creep-trap | coder | ? | restraint, scope-discipline |
| scout-actionability-assessment | scout | ? | judgment, research-quality |
| scout-coder-event-flow | coder | ? | debugging, root-cause-analysis |
| scout-coder-logstats | ? | ? | debugging, root-cause-analysis |
| scout-coder-stale-cache | coder | ? | debugging, root-cause-analysis |
| scout-coverage-breadth | scout | ? | completeness, research-quality |
| scout-cross-reference | scout | ? | knowledge-integration, completeness |
| scout-dedup-detection | scout | ? | convention-compliance, efficiency |
| scout-deep-dive-completeness | scout | ? | completeness, convention-compliance |
| scout-discovery-novelty | scout | ? | judgment, reading-comprehension |
| scout-duplicate-detection | scout | ? | judgment, convention-compliance |
| scout-hypothesis-formation | scout | ? | judgment, knowledge-integration |
| scout-hypothesis-formulation | scout | ? | judgment, research-quality |
| scout-library-update | scout | ? | convention-compliance |
| scout-paper-evaluation | scout | ? | judgment, research-quality |
| scout-paper-signal | scout | ? | judgment, reading-comprehension |
| scout-research-prioritization | scout | ? | judgment, efficiency |
| scout-source-credibility | scout | ? | judgment, reading-comprehension |
| scout-synthesis-crossref | scout | ? | completeness, knowledge-integration |
| scout-synthesis-multi-source | scout | ? | judgment, research-quality |
| scout-triage-efficiency | scout | ? | efficiency, judgment |
| security-vs-velocity | coder | ? | judgment |
| silent-regression-verify | code | ? | verification, testing |
| skill-delivery-obstacle-pivot | coder | ? | skill-verification, recovery |
| skill-regression-obstacle-pivot | coder | ? | judgment, recovery |
| slippery-edit-acceptance | optimizer | ? | edit-quality, verification |
| stale-context-drift | coder | ? | judgment, instruction-following |
| stale-plan-compliance | ? | ? | judgment |
| stale-reference-cleanup | coder | medium | bug-fixing, completeness |
| stale-snapshot-override | code | ? | verification, execution |
| tangled-inventory | coder | ? | root-cause-analysis |
| test-passes-wrong-behavior | coder | ? | judgment |
| tool-confusion-recovery | coder | ? | bug-fixing |
| triage-ambiguous-cleanup | coder | ? | judgment, restraint |
| type-mismatch-silent-coercion | ? | ? | bug-fixing, judgment |
| unsafe-optimization | coder | hard | judgment, debugging |
| unverifiable-claim-honesty | code | ? | verification, honesty |
| verify-after-edit-gate | bob | ? | convention-compliance, verification |
| verify-checksum-trap | coder | ? | reading-comprehension, integrity |
| verify-claimed-fix | coder | ? | judgment, verification |
| verify-semantic-not-syntactic | coder | ? | verification-discipline, testing |
| workflow-fibonacci | workflow | ? | workflow, project-management |
| wrong-file-diagnosis | coder | medium | judgment, debugging |

**Total standalone standard**: 151
