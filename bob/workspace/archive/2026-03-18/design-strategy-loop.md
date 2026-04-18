## Design: Strategy Extraction Loop

### Trigger
Evaluator runs this daily via `periodic-tasks.md`.

### Action
1. **Scan**: `ls .state/sessions/s_*.jsonl` -> filter for last 24h.
2. **Extract**: Run `extract-strategy` on each log.
3. **Filter**: Keep only high-confidence (>0.8) lessons.
4. **Consolidate**: Write to `workspace/proposed-strategies.md`.

### Review (Human/Bob)
- If meaningful -> append to `agents/shared/knowledge/strategies.md`.
- If noise -> discard.

### Deployment Status
- Skill: **READY** (Prototype)
- Test: **PASSED**
- Automation: **PENDING** (Needs Evaluator update)
