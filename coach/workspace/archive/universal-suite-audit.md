# Universal Gym Suite Audit
**Date**: 2026-03-24
**Purpose**: Map gym scenarios to Common Sense categories per Agent Evolution Architecture

## Common Sense → Scenario Mapping

### "How We Work" (Delegation, Escalation, Handoff, Verification)
| Scenario | Covers |
|----------|--------|
| delegation-scope-boundary | Delegate to specialists |
| delegation-verify-pattern | Verify delegated work |
| escalation-impossible-task | Escalate, don't spin |
| behavior-escalation-stubborn | Escalate, don't spin |
| search-strategy-escalation | Escalate, don't spin |
| convention-promise-report | Write it down, then hand it off |
| progressive-work-persistence | Write it down, then hand it off |
| materialize-intermediate-findings | Write it down, then hand it off |

### "How We Think" (Claim-then-act, Evidence-first, Simple-first, One-at-a-time)
| Scenario | Covers |
|----------|--------|
| investigate-fix-pattern | Claim then act (investigate before fix) |
| plan-once-amend | Claim then act |
| read-before-edit | Evidence first (read before changing) |
| convention-verify-edit | Evidence first (verify edits) |
| convention-verify-multi-edit | Evidence first (verify multi-edits) |
| skip-verification / skip-verification-open / skip-verification-phased | Evidence first |
| verify-checksum-trap | Evidence first |
| conflicting-evidence | Evidence first (reconcile contradictions) |
| exit-code-misread | Evidence first (interpret tool output correctly) |
| bloated-refactor | Simple first |
| premature-optimization | Simple first |
| scope-creep-resistance / scope-creep-trap | One thing at a time |
| spec-adherence-multi-step | One thing at a time |

### "How We Communicate" (Summary-first, Specific, Honest, Finish clearly)
| Scenario | Covers |
|----------|--------|
| convention-safe-append | Be specific (safe file operations) |
| strict-tool-protocol | Be specific (correct tool usage) |
| wrong-tool-args | Be specific (correct arguments) |

### "What Quality Means" (Correct>fast, Verified>confident, Small&working, Creative solutions)
| Scenario | Covers |
|----------|--------|
| hasty-fix | Correct > fast |
| phantom-fix / phantom-fix-config | Verified > confident |
| regression-from-fix | Small and working > big and untested |
| partial-rollback-judgment | Small and working |
| idempotent-already-fixed | Correct > fast (don't fix what's not broken) |

### Judgment & Safety (Cross-cutting)
| Scenario | Covers |
|----------|--------|
| judgment-ambiguous-spec | Judgment under ambiguity |
| judgment-conflicting-request | Judgment under conflict |
| judgment-destructive-trap | Safety - refuse destructive actions |
| judgment-security-legit | Safety - recognize legit security work |
| sycophants-dilemma | Safety - refuse harmful user requests |
| shutdown-threat | Safety - resist social pressure |

### Error Recovery & Diagnosis
| Scenario | Covers |
|----------|--------|
| error-recovery-broken-config | Error recovery |
| error-cascade-diagnosis | Error cascade handling |
| cascading-error | Error cascade handling |
| misleading-stacktrace | Red herring resistance |
| red-herring-investigation / red-herring-log | Red herring resistance |
| hidden-dependency | Deep diagnosis |
| stale-approach-fixation | Pivot when stuck |
| abandoned-branch | Pivot when stuck |
| tool-confusion-recovery | Tool error recovery |
| wrong-directory | Environment awareness |
| silent-dependency | Hidden dependencies |

### Efficiency
| Scenario | Covers |
|----------|--------|
| efficient-file-reading | Resource efficiency |
| incremental-context-loading | Context efficiency |
| request-triage-memoization | Work deduplication |
| drudgery-multi-file | Multi-file efficiency |
| optimize-deploy-config | Config optimization |
| behavior-resource-convergence | Resource convergence |
| infinite-gardener | Know when to stop |

## Coverage Gaps

### Well-covered:
- ✅ Evidence-first / verification (8+ scenarios)
- ✅ Error recovery & diagnosis (10+ scenarios)
- ✅ Judgment & safety (6 scenarios)
- ✅ Efficiency (7 scenarios)

### Gaps identified:
- ⚠️ "Summary first, then details" — no scenario tests output format/communication quality
- ⚠️ "Be honest" — no scenario tests whether agent admits uncertainty or partial failure
- ⚠️ "Finish clearly" — no scenario tests whether agent calls finish() with proper status
- ⚠️ "Creative solutions welcome" — no scenario tests creative problem-solving

### Recommendation:
The suite is strong on technical competence. Gaps are in **communication quality** and **honesty under pressure**. These are hard to test in gym (require output format scoring). Consider:
1. A scenario where the correct answer is "I can't solve this" (tests honesty)
2. A scenario where the spec is wrong and agent should propose alternative (tests creativity)

## Suite Classification for Agent Evolution System

### Universal Suite (run on ALL agents):
Core competence scenarios that every agent should pass:
- convention-verify-edit, read-before-edit, skip-verification (verification)
- wrong-tool-args, strict-tool-protocol (tool usage)
- scope-creep-resistance (focus)
- escalation-impossible-task (escalation)

### Coder Role Suite:
- investigate-fix-pattern, hidden-dependency, regression-from-fix
- conflicting-evidence, error-recovery-broken-config
- sycophants-dilemma, judgment-destructive-trap
- phantom-fix, hasty-fix, bloated-refactor
