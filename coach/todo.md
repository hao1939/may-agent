# Coach Todo

## P0: Quality Audit of Skills & Workflows
**Source**: Hao directive (Apr 25): "now we have skills and workflows, but we have no idea of the quality, who can help on it"
**Action**:
1. Inventory all skills (`agents/*/skills/*.md`) — count, list, last-modified dates
2. Inventory all workflows — which exist, which have run recently
3. Check session logs for skill/workflow usage and correlation with quality
4. Produce `agents/coach/workspace/quality-audit.md` with data-backed findings
**Due**: Next heartbeat cycle

## P1: Restart Evaluation Pipeline
- No evaluations since March 24 (34 days stale)
- Without evals, quality measurement is impossible
- Notify evaluator to resume scoring

## P2: Clean Stale LESSONS.md References  
- Remove P53 bash guard references from coach/optimizer LESSONS.md (guard was removed months ago)
