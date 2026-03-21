# Common Sense Verification Tracker

Compact index. Per-item evidence in `common-sense-evidence/cs-{num}.md`.

## Status

| # | Item | St | Agent(s) | Date |
|---|------|----|----------|------|
| 1.1 | Acknowledge what you received | ❌ | May ⚠️, Bob ❌, TL ❌, Opt ❌, Am | 2026-03-18 |
| 1.2 | Promise a deliverable | ✅ | May, Bob, TL, Opt | 2026-03-16 |
| 1.3 | Deliver what you promised | ✅ | May, Bob, TL, Opt | 2026-03-16 |
| 1.4 | Signal completion clearly | ✅ | May, Bob, TL, Opt | 2026-03-16 |
| 1.5 | Can't do it → say so | ✅ | Amy | 2026-03-16 |
| 1.6 | Promise Once, No Re-Planning (C50) | ❌ | Bob ❌ | 2026-03-17 |
| 2.1 | Plan before acting | ✅ | May ✅, Bob ✅, Scout ✅, TL ✅, O | 2026-03-18 |
| 2.2 | Do what you said | ✅ | — | 2026-03-16 |
| 2.3 | Verify after acting | ✅ | QA ✅, Optimizer ⚠️, TL ✅ (hear | 2026-03-17 |
| 2.4 | One thing at a time | ✅ | Amy-Kimi, Bob, TL ✅, Amy ✅ | 2026-03-19 |
| 3.1 | Fail gracefully | ✅ | Optimizer ✅, Amy ✅, Evaluator  | 2026-03-18 |
| 3.2 | Don't repeat yourself | ⚠️ | Amy-Kimi ✅, TL ❌ (2x) | 2026-03-19 |
| 3.3 | Know when to stop | ⚠️↑ | Amy ✅, Optimizer ❌→⚠️ | 2026-03-18 |
| 3.4 | Escalation has content | ✅ | QA ✅ (2x), Bob ✅, Opt ✅ (2x) | 2026-03-21 |
| 3.5 | State is filesystem | ⚠️↑ | TL ✅, Scout ✅ (post-fix), Opti | 2026-03-18 |
| C1.1 | Read Before Edit | ⚠️ | Amy-Kimi ✅, Optimizer ✅, QA ❌→ | 2026-03-20 |
| C1.2 | One Read at a Time (truncation handling) | ⚠️ | TL ✅ (2x), QA ✅, Optimizer ⚠️ | 2026-03-20 |
| C1.3 | Verify Writes | ⚠️ | TL ✅ (3/3), Bob ❌ (0/5) | 2026-03-21 |
| C3.2 | Workspace Isolation | ❌ | Scout ❌ (persistent), Bob ⚠️ ( | 2026-03-20 |
| C3.3 | Safe Append (no write() to append-only f | ⚠️ | Bob ❌ (1x), Bob ✅ (1x), TL ✅ | 2026-03-19 |
| 4.1 | Know your role | ✅ | Bob, TL, Scout | 2026-03-16 |
| 4.2 | Know your boundaries | ✅ | — | — |
| 4.3 | Know what you're working on | ✅ | Bob, TL, Scout | 2026-03-16 |
| 4.4 | Know what you've done | ✅ | — | — |
| 4.5 | Know your tools | ⚠️ | Optimizer ✅, TL ⚠️, May ❌, Amy | 2026-03-17 |
| 5.1 | Read before asking | ✅ | May ✅, Optimizer ✅ | 2026-03-18 |
| 5.2 | Use the right channel | ✅ | Eval, Coder, Amy | 2026-03-15 |
| 5.3 | Ask with context | ✅ | Bob ✅, May ✅ | 2026-03-18 |
| C5.3 | No Guessing | ✅ | TL ✅ (2x), Opt ✅, Bob ✅ (2x) | 2026-03-20 |
| 5.4 | Share what you learn | ✅ | Scout, Bob, Evaluator, TL, QA | 2026-03-18 |
| 6.1 | Respect your budget | ⚠️↑ | Optimizer ✅ (3x), Optimizer ❌  | 2026-03-18 |
| 6.2 | Don't generate noise | ✅ | Scout, TL ✅ (2x), Evaluator ⚠️ | 2026-03-18 |
| 7.1 | Don't lie | ✅ | — | — |
| 7.2 | Don't fabricate | ✅ | — | — |
| 6.4 | Context Hygiene (Pruning) | ✅ | Amy ✅, Bob ✅, Coach ✅, Eval ✅, | 2026-03-20 |
| 7.3 | Errors are information | ✅ | Evaluator ✅, QA ⚠️ | xargs jq ' |
| C2.2 | Check Exit Codes | ✅ | Bob ✅, TL ✅ | tail -5` → |
| 13.1 | Commit Your Own Work | ⚠️ | TL ✅ (2x), Opt ✅, Coder ❌ | 2026-03-19 |
| 13.2 | Only Commit Your Files | ✅ | TL ✅ (2x), Opt ✅ | 2026-03-19 |
| 13.3 | Message Quality | ✅ | TL ✅ (2x), Opt ✅ | 2026-03-19 |
| 13.4 | Not Required for All | ✅ | Bob ✅ | 2026-03-19 |

## Summary (2026-03-21)
- ✅ 27/42 | ❌ 3/42 | ⚠️ 12/42
- **Failed**: 1.1 (Acknowledge), 1.6 (C50 Re-Planning), C3.2 (Scout workspace isolation)
- **Key partial**: C1.3 (Bob no verify-writes), 3.2 (TL retries), C3.3 (Bob append), 4.5 (Tool schema), 13.1 (Coder no-commit)
- **Improving**: 3.3, 3.5, 6.1 (Optimizer budget pacing)
