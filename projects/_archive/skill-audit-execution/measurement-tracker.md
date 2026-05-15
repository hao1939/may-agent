# Skill Audit Execution — Measurement Tracker

## Milestone 2: Deploy `state-check-before-action` to Bob → Measure C1.1 Impact

### Intervention
- **Skill**: `agents/shared/skills/state-check-before-action/SKILL.md` (SCBA)
- **Target agent**: bob
- **Target metric**: C1.1 (edit-without-read) pass rate
- **Deployed**: 2026-05-23 (added to bob's context.md + skills/LIBRARY.md)

### Baseline (pre-intervention)
| Window | Pass Rate | Detail |
|--------|-----------|--------|
| Overall (45 checks) | 77.8% (35/45) | All-time bob C1.1 checks |
| Last 50 | 70.0% (35/50) | Recent trend |
| Last 20 | 85.0% (17/20) | Most recent sessions |

Note: Bob already had a thin `read-before-edit.md` skill and a runtime guard (`read-before-edit.ts` upgraded to `run_step`). SCBA adds comprehensive coverage for write(), destructive bash, path verification, and re-verification after edit chains.

### Post-intervention (fill after 5+ bob tasks)
| Window | Pass Rate | Detail |
|--------|-----------|--------|
| First 5 post-deploy | _pending_ | |
| First 10 post-deploy | _pending_ | |
| First 20 post-deploy | _pending_ | |

### How to measure
```bash
bun -e "
import {Database} from 'bun:sqlite';
const db = new Database('.state/may.db', {readonly:true});
const rows = db.query(\"SELECT passed FROM convention_checks WHERE agent='bob' AND convention='C1.1' ORDER BY rowid DESC LIMIT 20\").all();
const passed = rows.filter(r => r.passed === 1).length;
console.log('Bob C1.1 last ' + rows.length + ':', passed + '/' + rows.length + ' = ' + (passed/rows.length*100).toFixed(1) + '%');
"
```

### Verdict
_Pending — check after 5+ bob sessions post-deploy._

---

## Milestone 1: Run-test Core Workflows

### Status: Ready to test

| Workflow | File | Status | Notes |
|----------|------|--------|-------|
| master-worker | `agents/shared/workflows/master-worker.ts` | _pending_ | |
| implement-and-verify | `agents/shared/workflows/implement-and-verify.ts` | _pending_ | |
| project | `agents/shared/workflows/project.ts` | _pending_ | |

---

## Milestone 3: Archive Dead Skills + Protect Live Ones

### Status: Ready to execute
- [ ] Move 20 "archive" skills to `agents/shared/skills/archive/`
- [ ] Smoke test script for 22 "keep" skills
- [ ] CI verification script for skill rot detection
