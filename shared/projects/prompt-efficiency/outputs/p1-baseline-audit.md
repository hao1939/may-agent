# P1: Prompt Efficiency Baseline Audit

## SOUL.md Token Counts (approx)

| Agent | Words | ~Tokens | Lines |
|-------|-------|---------|-------|
| optimizer | 1669 | 2169 | 177 |
| bob | 1173 | 1524 | 112 |
| amy | 1123 | 1459 | 75 |
| master | 1042 | 1354 | 89 |
| tech-lead | 851 | 1106 | 80 |
| qa | 841 | 1093 | 98 |
| coach | 840 | 1092 | 88 |
| evaluator | 787 | 1023 | 121 |
| may | 598 | 777 | 74 |
| arc | 395 | 513 | 42 |
| amy-kimi | 394 | 512 | 51 |
| dev | 387 | 503 | 44 |
| judge | 346 | 449 | 55 |
| scout | 329 | 427 | 37 |

**Average**: ~950 tokens per SOUL.md
**Total across all agents**: ~13,000 tokens

## Context.md Token Counts

| Agent | Words | ~Tokens |
|-------|-------|---------|
| may | 1552 | 2017 |
| coach | 1474 | 1916 |
| bob | 1227 | 1595 |
| tech-lead | 1115 | 1449 |
| optimizer | 955 | 1241 |
| scout.bak | 917 | 1192 |
| qa | 814 | 1058 |
| amy | 629 | 817 |
| coder | 466 | 605 |
| evaluator | 457 | 594 |
| amy-kimi | 378 | 491 |
| arc | 194 | 252 |
| master | 184 | 239 |
| dev | 180 | 234 |
| judge | 176 | 228 |
| architect | 175 | 227 |
| scout | 85 | 110 |

**Average**: ~783 tokens per context.md
**Bloated** (>1500 tok): may, coach, bob, tech-lead

## Duplicated Content Across SOUL.md Files

### 1. "Prefer edit() over write()" rule
Appears in **8+ SOUL.md files** with near-identical wording:
> ⛔ **Prefer edit() over write()**: When modifying existing files, use `edit()` to change only what's needed.

### 2. "Read before edit" rule  
Appears in **5+ SOUL.md files**:
> ⛔ **Read before edit**: Before every `edit()`, `read()` the file first. Never edit blind.

### 3. "Verify after edit" rule
Appears in **5+ SOUL.md files**:
> ⛔ **Verify after edit**: After every `edit()`, verify the change landed.

### Total duplicated content: ~300 tokens repeated 5-8× = ~1500-2400 wasted tokens per invocation

## Recommendations

1. **Extract shared rules** to `/app/agents/shared/rules.md` (~300 tokens once instead of 8×)
2. **Trim context.md** for may (2017tok), coach (1916tok), bob (1595tok) — remove stale facts
3. **Compact optimizer SOUL.md** (2169tok, largest) — it has iteration-specific guidance that could be in context.md instead
4. **Estimated savings**: ~2000 tokens per agent invocation from dedup alone
