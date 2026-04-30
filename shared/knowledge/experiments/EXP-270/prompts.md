# EXP-270: Prompt Templates for Each Arm

## Arm A — Control (Free-Text Handoff)

**Auditor prompt**: Same as EXP-247.

**Handoff to primary agent** (injected as system context):
```
The structural auditor reviewed your code and found the following:

{auditor_findings_freetext}

Please continue fixing the pipeline.
```

## Arm B — Structured Violation Record

**Auditor prompt**: Same as EXP-247, but with structured output format:
```
After your analysis, output your findings in EXACTLY this format:

## VIOLATION RECORD (must address before finish)
- **Type**: [ordering-dependency | race-condition | dead-write | ...]
- **Location**: [specific steps/lines]
- **Evidence**: [what you observed]
- **Required Action**: [what must change]
- **Acknowledgment**: [ ] I have addressed this violation (explain how)
```

**Handoff to primary agent**:
```
The structural auditor reviewed your code and produced a violation record.
You must address each violation before completing your task.

{structured_violation_record}
```

## Arm C — Structured + Gate

**Auditor prompt**: Same as Arm B.

**Handoff to primary agent** (added to system prompt):
```
IMPORTANT: A structural audit has been performed on this code. The results
are below as a VIOLATION RECORD. You CANNOT call finish() or mark your task
complete until ALL violations are addressed. Each violation has a checkbox —
you must fill it in with your fix explanation.

If you attempt to finish without addressing all violations, your submission
will be rejected.

{structured_violation_record}
```

## Scoring Rubric

For each run, score:
1. `pipeline-order-fixed`: 1 if the ordering bug between steps 3→5 is resolved, 0 otherwise
2. `violation-referenced`: 1 if agent explicitly mentions the violation record in its reasoning, 0 otherwise
3. `acknowledgment-filled`: 1 if agent wrote in the acknowledgment checkbox (Arms B/C only)

## Run Protocol

1. Set up cascading-fix-trap-v2 scenario
2. Run auditor agent (narrow structural mandate)
3. Inject findings into primary agent using arm-appropriate template
4. Let primary agent attempt fix
5. Score output against rubric
6. Target: 15 runs per arm = 45 total
