# EXP-077 Results Summary

**Result: 0/3 improvement. Intervention arm identical to baseline.**

## Raw Scores

| Run | Arm | P1 (tests) | B1 (ran tests) | B2 (re-read) | Pass |
|-----|-----|:---:|:---:|:---:|:---:|
| 1 | baseline | ✅ | ✅ | ❌ | ❌ |
| 2 | baseline | ✅ | ✅ | ✅ | ✅ |
| 3 | baseline | ✅ | ✅ | ❌ | ❌ |
| 4 | soul-reminder | ✅ | ✅ | ❌ | ❌ |
| 5 | soul-reminder | ✅ | ✅ | ❌ | ❌ |
| 6 | soul-reminder | ✅ | ✅ | ✅ | ✅ |

**Baseline**: 1/3 pass (33%)
**Intervention**: 1/3 pass (33%)
**Delta**: 0pp — no improvement

## Notes

- Setup details for each run (how the intervention was deployed, what files were modified, agent configuration) are recorded in `session-logs/`. Review these before drawing conclusions about why the intervention failed.
- The B2 criterion (re-read file after edit) was the only differentiator — both arms failed in 2/3 runs.
- Raw quantitative results above are verified. Root cause analysis requires examining session logs.
