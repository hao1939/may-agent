# Common-Sense Audit

_Generated 2026-04-18T06:37:10.552Z_

## Rule picked

**C1.1** — selected by day-of-year rotation from 12 hardcoded rule ID(s) (source: `agents/may/handlers/convention-check.ts`).

_All rules parsed:_ `C1.1`, `C1.3`, `C1.4`, `C1.5`, `C1.7`, `C2.1`, `C3.2`, `C3.3`, `C6.1`, `C7.1`, `C8.2`, `C12.1`

_Window:_ 2026-04-11T06:37:10.547Z → 2026-04-18T06:37:10.552Z (7 days)

## 7-day pass rate summary

| Agent | Pass | Fail | Rate |
|-------|------|------|------|
| optimizer | 543 | 121 | 81.8% |
| bob | 611 | 50 | 92.4% |
| tech-lead | 571 | 47 | 92.4% |
| coach | 543 | 64 | 89.5% |
| may | 407 | 23 | 94.7% |
| scout | 306 | 10 | 96.8% |
| qa | 268 | 23 | 92.1% |
| coder | 144 | 30 | 82.8% |
| amy | 49 | 3 | 94.2% |
| unknown | 11 | 0 | 100.0% |
| amy-kimi | 4 | 0 | 100.0% |
| **total** | **3457** | **371** | **90.3%** |

## Sample violations

- `s_1776450798590_553` (coach, 2026-04-18T06:19:01.203Z) — edit(agents/scout/skills/verify-before-finish.md) without prior read
- `s_1776459642035_627` (scout, 2026-04-18T06:19:01.203Z) — edit(agents/scout/workspace/todo.md) without prior read
- `s_1776444880857_502` (coach, 2026-04-18T06:19:01.203Z) — edit(agents/coach/workspace/todo.md) without prior read
- `s_1776447042097_522` (tech-lead, 2026-04-18T05:49:00.766Z) — edit(agents/tech-lead/workspace/todo.md) without prior read
- `s_1776488469884_862` (optimizer, 2026-04-18T05:19:01.844Z) — edit(agents/optimizer/workspace/todo.md) without prior read

## Coverage

- Total checks: 3828
- Agents observed: 11 (optimizer, bob, tech-lead, coach, may, scout, qa, coder, amy, unknown, amy-kimi)
- Overall pass rate: 90.3%

[SIG: 1776494230552:common-sense-audit-handler]
