# Shared Rules Deduplication Proposal

*Generated: Phase 5, Iteration 33*

## Problem

Three rules are copy-pasted across 8-9 agent SOUL.md files, wasting ~60 tokens per agent per session. Total waste: ~480-540 tokens/session across all agents.

## Duplicated Rules Found

### Rule 1: "Read before edit" (9 agents)
```
⛔ Read before edit: Before every edit(), read() the file (or the target section) first. Never edit blind.
```
**Found in**: amy, arc, bob, coach, dev, evaluator, optimizer, qa, scout

### Rule 2: "Verify after edit" (9 agents)
```
⛔ Verify after edit: After every edit(), verify the change landed. For code: read() the changed lines. For JSON/config: parse it. For TypeScript: npx tsc --noEmit. The edit() diff preview counts as verification — no separate read needed if you check the diff.
```
**Found in**: amy, arc, bob, coach, dev, evaluator, optimizer, qa, scout

### Rule 3: "Never batch edits" (9 agents)
```
⛔ Never batch edits without verification: Each edit gets verified before the next one. Don't make 5 edits then check once.
```
**Found in**: amy, arc, bob, coach, dev, evaluator, optimizer, qa, scout

### Rule 4: "Prefer edit() over write()" (7 agents)
```
⛔ Prefer edit() over write(): When modifying existing files, use edit() to change only what's needed. Using write() to rewrite entire files risks losing existing content.
```
**Found in**: bob, coach, dev, evaluator, optimizer, qa, scout

## Proposal: Create `agents/shared/rules.md`

### New file: `/app/agents/shared/rules.md`
```markdown
# Shared Agent Rules

## File Editing Protocol
- ⛔ **Read before edit**: Before every `edit()`, `read()` the file first. Never edit blind.
- ⛔ **Verify after edit**: After every `edit()`, verify the change landed. The `edit()` diff preview counts as verification.
- ⛔ **Never batch edits**: Each edit gets verified before the next one.
- ⛔ **Prefer edit() over write()**: Use `edit()` for existing files. `write()` risks losing content.
```

### Per-agent SOUL.md changes

Replace the 3-4 duplicated rule lines in each agent with:
```
See `agents/shared/rules.md` for standard file-editing rules.
```

**Lines to remove per agent:**

| Agent | Lines to remove | Tokens saved |
|-------|----------------|-------------|
| bob | L22-24 (3 rules) + L12 (edit>write) | ~75 |
| coach | L13-16 (4 rules) | ~75 |
| dev | L9-12 (4 rules) | ~75 |
| evaluator | Similar block | ~75 |
| optimizer | Similar block | ~75 |
| qa | Similar block | ~75 |
| scout | Similar block | ~75 |
| amy | Similar block | ~60 |
| arc | Similar block | ~60 |

**Total tokens saved**: ~645 tokens per system prompt load across all agents

## SOUL.md Size Rankings (current)

| Agent | Words | Status |
|-------|-------|--------|
| optimizer | 1669 | ⚠️ Bloated |
| bob | 1173 | ⚠️ Bloated |
| amy | 1123 | ⚠️ Bloated |
| master | 1042 | ⚠️ Borderline |
| tech-lead | 851 | OK |
| qa | 841 | OK |
| coach | 840 | OK |
| evaluator | 787 | OK |
| may | 598 | OK |
| arc | 395 | ✅ Lean |
| amy-kimi | 394 | ✅ Lean |
| dev | 387 | ✅ Lean |
| judge | 346 | ✅ Lean |
| scout | 329 | ✅ Lean |

## Implementation Risk

**Low**. The shared rules are identical across agents. The only question is whether the agent framework loads `shared/rules.md` automatically or if each SOUL.md needs an explicit include reference. If no auto-include exists, each SOUL.md should reference it as a reminder to the human/system prompt assembler.

## Next Steps

1. Create `/app/agents/shared/rules.md` with the 4 shared rules
2. Edit each SOUL.md to replace duplicated lines with a reference
3. Verify no agent behavior changes (rules are identical)
4. Re-measure SOUL.md token counts to confirm reduction
