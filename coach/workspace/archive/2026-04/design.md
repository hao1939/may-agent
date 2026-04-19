# EXP-023: Environmental Nudge for Materialization (L4)

**Date**: 2026-04-04
**Status**: RUNNING
**Author**: Coach (implementing Bob's EXP-017 design)
**Scenario**: `materialize-intermediate-findings`
**Mechanism**: L4 — Environmental Nudge (Zone 2)

## Question

Does pre-creating a `workspace/findings.md` template nudge the agent to materialize intermediate findings more frequently, without any skill file or workflow?

## Background

- EXP-022 showed text skill (+26pp total checks, +67pp early materialization) 
- Bob's EXP-017 design proposes testing L4 Environmental Nudge as alternative mechanism
- The existing baseline data from EXP-022 shows Control: 14/27 checks (52%)
- This tests whether ENVIRONMENTAL CONTEXT can achieve similar results to TEXT SKILL

## Design

### Control Group (3 runs)
- Standard scenario, no modifications (reuse EXP-022 control if results recent)

### Treatment Group (3 runs)  
- Pre-create `workspace/findings.md` in the scenario work dir with template
- NO skill file installed
- Template:
```markdown
# Investigation Findings

## Key Discoveries
<!-- Update this as you find relevant information -->

## Open Questions  
<!-- Track what still needs investigation -->

## Evidence
<!-- Paste relevant code/output snippets here -->
```

### Success Criteria
- **P1**: Treatment materializes more than control baseline (>52% checks)
- **P2**: No regression on product checks (report quality)
- **P3**: Compare to EXP-022 treatment (text skill at 78%) — environmental nudge alone sufficient?

## Cost
~$1 (3 treatment runs, reuse EXP-022 control data)
