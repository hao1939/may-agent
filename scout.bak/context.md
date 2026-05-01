# Scout Context (Schema-Organized — EXP-212 Rollout)

## ⚡ [SESSION START]

**Environment:** Project root /app. bun: `.state/.bun/bin/bun`. Code search: `scripts/code-search.sh <pattern>`.
Orient before acting — read workspace context first.

## ⚡ [BUDGET DISCIPLINE]

- Turn 1-3: Create output file skeleton. At 50%: stop researching, write up. At 75%: finish() within 2 calls.

## ⚡ [BEFORE EDITING ANY FILE]

- C1.1: Read before edit. Always.

## ⚡ [AFTER WRITE]
- C1.3: Read back to verify.

## ⚡ [BEFORE FINISH]
- C1.7: ≥1 verification call in last 5 tool calls. ≥5 tool calls total (anti-shallow).

## ⚡ [WHEN RESEARCHING]

- arXiv = highest-signal source. GitHub Trending weekly > daily.
- Grep discoveries.md before adding — no duplicates.
- Write output to shared/knowledge/library/. Hypotheses → knowledge/hypotheses/H-XXX.md
- DEDUP: `grep -ril "<topic>" agents/shared/knowledge/entries/` before creating KEs.
- Focus: agent collaboration, context learning, adversarial verification, automated research.

## ⚡ [GENERAL KNOWLEDGE]

- KE-008: Don't restructure heartbeat steps.
- Few-shot harmful for discovery (-67pp, KE-133). Never stack interventions (-12-15pp, KE-123).
- Skills hierarchy: code > SOUL.md > per-agent skills/ > shared skills/. 0/29 discover passive resources.
- `grep ... || true` when chaining bash with &&.
- GitHub 404 = try alt names, weak evidence alone.

## Required Skills
📘 `agents/scout/skills/evidence-over-narrative.md`, `find-before-read.md`, `knowledge-dedup-check.md`
📘 `agents/scout/skills/materialize-findings-concise.md`, `read-before-edit.md`, `search-governance.md`
📘 `agents/scout/skills/verify-after-edit.md`, `verify-before-finish.md`, `verify-quantitative-claims.md`
📘 `agents/shared/skills/baseline-before-change/SKILL.md`

## Key Lessons
- Few-shot examples harmful for discovery (-67pp). Process structure > outcome declaration.
- ≥5 tool calls before finish(). Anti-shallow rule.
- If finish() rejects verification: use status="partial", don't fabricate evidence.

## Shared Toolkit
See `agents/shared/README-shared-toolkit.md`.
