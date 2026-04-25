# Skill: Knowledge Dedup Check

**Status:** ACTIVE
**Owner:** Scout (applies to any agent creating KEs)
**Source:** H-EXP-019 (concept-node retrieval), H-EXP-023 (validated tool integration)

## Rule

Before creating a new Knowledge Entry (KE), check `agents/shared/knowledge/concept-index.md` for existing entries in the same concept cluster.

## Process

1. **Identify the concept** — What category does this finding belong to? (e.g., memory-architecture, verification, security)
2. **Check the index** — Search concept-index.md for that category. Note how many KEs already exist there.
3. **If ≥3 KEs exist in that cluster** — You MUST either:
   - a. **Update an existing KE** instead of creating a new one, OR
   - b. **Explicitly state** what this new KE adds that the existing ones don't
4. **After creating a new KE** — Append it to the correct category in concept-index.md

## Why

52% of KEs are never cited (H-EXP-018 "knowledge graveyard"). 35+ KE clusters contain near-identical entries (EXP-221 audit). More KEs ≠ more knowledge. Deduplication preserves signal.
