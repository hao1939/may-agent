### Coder

| Field | Value |
|-------|-------|
| **Level** | L2 |
| **Status** | 🎓 **GRADUATED** (2026-03-24) — first graduated agent |
| **Sessions** | 5 |
| **Consecutive passes** | **3/3** ✅ |
| **Last session** | 2026-03-24 |
| **Blocking graduation** | None — **GRADUATED** 🎓 |

**Coaching history:**
- **2026-03-05** — Blind-overwrite prevention: **PASS**. Used grep -n → line-range reads → sed with pattern matching for surgical edit in 273-line file. Zero content loss. lessons.md training internalized.
- **2026-03-09** — Multi-site safe-edit (4 edits in 608-line file): **PARTIAL** (6.5/10). No write() used ✅. Line-range reads for all 4 sites ✅. But 3 of 4 edits used line-number-based sed (6s, 107s, 251i) instead of pattern-based. Only Edit 4 was pattern-based. All edits correct, tsc passed. Proactively fixed whitespace inconsistency. Report: `sessions/coder-safe-edit-2026-03-09.md`.
- **2026-03-22** — Multi-site safe-edit 2b, pattern-only prompts (4 edits in 285-line file): **PASS** (9/10). All 4 edits used pattern-based sed ✅. No write() ✅. Self-recovered from delimiter conflict. Hypothesis confirmed: removing line numbers from prompt eliminated line-number sed habit. Report: `sessions/coder-safe-edit-2b-2026-03-22.md`.
- **2026-03-23** — Multi-site safe-edit 2c, hard mode (4 edits in 172-line file, line numbers in prompt + explicit pattern instruction): **PASS** (10/10). All 4 edits used pattern-based sed despite line numbers being prominent in prompt ✅. Zero errors, proper escaping, clean first-try on all 4 edits. 22-second execution. Report: `sessions/coder-safe-edit-2c-2026-03-23.md`.
- **2026-03-24** — 🎓 **GRADUATION EXERCISE**: Multi-file mixed edits (6 edits across 3 files: src/skills.ts, src/cron-tool.ts, src/socket-client.ts). JSDoc + code cleanup + constant extraction. **PASS** (10/10). All 8 sed commands pattern-based. Zero write() calls. 55-second execution. **3/3 streak → FIRST GRADUATED AGENT.** Report: `sessions/coder-graduation-2026-03-24.md`.

**Known weaknesses:**
- **Primary (resolved with instruction)**: Defaults to line-number-based sed when line numbers are provided WITHOUT explicit instruction to use patterns. Uses patterns reliably when instructed OR when no line numbers in prompt.
- Quality inconsistency across evaluations (0.0 to 1.0, cluster at 0.78)

**Hypothesis CONFIRMED + EXTENDED:** Providing line numbers in the task prompt cues Coder to use them in sed. When described by context only, Coder uses pattern-based sed consistently (4/4). When given line numbers + explicit instruction to use patterns, Coder also uses patterns consistently (4/4). The behavior is environmental/contextual, not a capability gap.

**Graduation blockers:**
- [x] Pass exercise 2b: multi-site edit described WITHOUT line numbers (pattern-only prompts) — PASS 2026-03-22
- [x] Pass exercise 2c: multi-site edit WITH line numbers in prompt but explicit instruction to use pattern-based sed — PASS 2026-03-23
- [x] **Pass graduation exercise**: multi-file, mixed edit types, no line numbers, no method hints — **PASS** (10/10, 2026-03-24). Streak 3/3. **FIRST GRADUATED AGENT** 🎓
---
