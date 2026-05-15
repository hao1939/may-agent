# Coder Context Keyword Index
# Maps each context entry to task-relevant keywords for selective injection
# Format: entry_id | keywords | source | lines

## context.md entries

C1.1-read-before-edit | edit, write, modify, change, fix, implement, create | context.md:Mandatory Procedures | 3
C1.3-verify-writes | write, create, new-file | context.md:Mandatory Procedures | 2
C12.1-session-start | any (always inject) | context.md:Mandatory Procedures | 2
lessons-reflexion | reflexion, pipeline, exit-code, test | context.md:Lessons | 2
methodology-post-fix-trace | bug, fix, debug, pipeline, data-flow, cascading | context.md:Critical Methodology | 1
methodology-test-skepticism | test, assertion, failing-test, expected-value | context.md:Critical Methodology | 1
methodology-contradiction | requirements, spec, contradiction, conflict | context.md:Critical Methodology | 1
methodology-impossible-task | blocked, impossible, cannot | context.md:Critical Methodology | 1
methodology-mock-leak | test, mock, jest, vitest, spy, stub | context.md:Critical Methodology | 1
rule1-trace-data-flow | bug, fix, wrong-output, math, calculation, debug | context.md:Quality Rules | 12
rule2-destructive-ops | delete, remove, clean, rm, directory | context.md:Quality Rules | 8
rule3-run-tests | test, verify, code-change, implement | context.md:Quality Rules | 8
rule4-security-sanitization | html, xss, sanitize, render, markdown, user-input, security | context.md:Quality Rules | 8
rule5-full-pipeline | fix, module, pipeline, integration, downstream | context.md:Quality Rules | 6
rule6-review-severity | review, qa, spec, deviation, severity | context.md:Quality Rules | 8
rule7-test-coverage | fix, test, edge-case, regression, coverage | context.md:Quality Rules | 7
rule8-blocked-move-on | blocked, missing, multiple-items, plan | context.md:Quality Rules | 7

## skills/

skill-convention-compliance | edit, write, convention, C1.1, C1.3 | skills/convention-compliance.md | ~full
skill-diagnosis-before-action | bug, debug, diagnose, investigate, error | skills/diagnosis-before-action.md | ~full
skill-multi-file-discovery | search, find, discover, codebase, multi-file | skills/multi-file-discovery-completeness.md | ~full
skill-second-look | verify, review, check, finish, final | skills/second-look-verification.md | ~full
skill-task-compliance | task, instruction, requirements, spec, comply | skills/task-instruction-compliance.md | ~full

## Always-inject entries (regardless of task)
# C1.1, C1.3, C12.1 — these are universal procedures
