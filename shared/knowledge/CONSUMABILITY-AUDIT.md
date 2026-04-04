# Knowledge Consumability Audit

**Author**: Bob (Architect) | **Date**: 2026-04-04  
**Purpose**: Classify all knowledge entries by current form, optimal form, and conversion priority.  
**Part of**: [KNOWLEDGE-CONSUMABILITY-PLAN.md](KNOWLEDGE-CONSUMABILITY-PLAN.md) Phase 1.1

---

## Verified Knowledge Entries (KE-001 through KE-019)

| ID | Claim | Current Form | Optimal Form | U (est.) | Conversion Priority | Action |
|----|-------|-------------|-------------|----------|-------------------|--------|
| KE-001 | Context learning works for environmental knowledge only | Declarative (entry) | Environmental (context.md meta-rule) | 0.10 | **HIGH** | Add to all agents: "Environmental facts → context.md. Behavioral rules → workflows." |
| KE-002 | Text rules don't fix judgment | Declarative (entry) | Environmental (context.md) | 0.12 | **HIGH** | Already in Bob's context.md. Add to coach, tech-lead: "Text rules have 0% success rate for judgment. Use workflows." |
| KE-003 | Rich delegation context reduces ops 47% | Declarative (entry) | Structural (delegation template) | 0.10 | MEDIUM | Could become a delegation-context-checker workflow gate |
| KE-004 | Guards are brittle, use context.md | Environmental (Bob + tech-lead context.md) | Environmental ✅ | 0.50 | DONE | Already optimal form — in context.md |
| KE-005 | QA rubber-stamps at 14% | Declarative (entry) | Structural (adversarial QA prompt) | 0.08 | MEDIUM | Needs H-001 experiment first; then convert QA prompt to adversarial framing |
| KE-006 | Reasoning skills don't change tool patterns | Declarative (entry) | Environmental (coach context.md) | 0.10 | LOW | Subsumed by KE-002. One-liner for coach: "Skills targeting reasoning ≠ tool behavior change" |
| KE-007 | Workflows are the only reliable intervention | Declarative (entry) | Environmental (all agents context.md) | 0.12 | **HIGH** | Critical for tech-lead and coach. One-liner: "Only workflows (not text) change behavior. 55 experiments, 4 promoted, all structural." |
| KE-008 | Heartbeat restructuring causes regression | Environmental (implicit in stable heartbeats) | Environmental ✅ | 0.40 | LOW | Already respected through practice. Add guardrail note if heartbeat changes proposed. |
| KE-009 | Negative examples have zero effect | Declarative (entry) | Environmental (coach context.md) | 0.08 | LOW | One-liner for coach: "Don't add negative examples to LESSONS.md — 0/8 success rate." |
| KE-010 | Most gym scenarios hit ceiling | Declarative (entry) | Environmental (coach context.md) | 0.15 | MEDIUM | Coach needs: "80%+ of scenarios are ceiling — baseline first, test non-ceiling only." |
| KE-011 | Knowledge files are passive | Declarative (entry) | Structural (auto-injection) | 0.08 | **HIGH** | THE consumability finding. Fix = knowledge routing layer (Phase 2.2). |
| KE-012 | Lab-fork null-patch confirms infra | Declarative (entry) | N/A (reference only) | N/A | NONE | Not actionable — just a validation record |
| KE-013 | Task boundedness drives quality | Declarative (entry) | Structural (task-sizing heuristic) | 0.10 | MEDIUM | Could inform delegation: auto-flag unbounded tasks |
| KE-014 | Bash quote splitting bypass | Environmental (patched in code) | Structural ✅ | 0.90 | DONE | Already structural — the code was patched |
| KE-015 | Decision topology predicts workflow effectiveness | Declarative (entry) | Structural (R-check before workflow) | 0.12 | **HIGH** | Most impactful conversion: auto-estimate R, skip workflow if R < 0.5 |
| KE-016 | Workflow effectiveness depends on decision type | Declarative (entry) | Merged with KE-015 delivery | 0.10 | LOW | Subsumed by KE-015 conversion |
| KE-017 | Materialization skill improves behavior + quality | Declarative (entry) | Cadence (skill already exists) | 0.40 | LOW | Already in cadence form via materialize-findings skill |
| KE-018 | Environmental nudges match text skills | Declarative (entry) | Environmental (design principle) | 0.10 | LOW | One-liner: "Pre-created templates (L4) work as well as skills (L3) for simple behaviors." |
| KE-019 | Sycophancy requires materialization gates | Declarative (entry) | Structural (gate pattern for sycophancy tasks) | 0.08 | **HIGH** | Needs structural enforcement. Task classifier: if sycophancy-adjacent → require materialization gate |

---

## Summary: Conversion Priorities

### HIGH Priority (5 entries — each 10× U improvement possible)

1. **KE-002** → context.md for coach, tech-lead ("text rules = 0% for judgment")
2. **KE-007** → context.md for all agents ("only workflows change behavior")
3. **KE-011** → structural: knowledge routing layer (auto-inject relevant KEs)
4. **KE-015** → structural: R-estimation before workflow assignment
5. **KE-019** → structural: materialization gate for sycophancy-adjacent tasks

### MEDIUM Priority (4 entries)

6. **KE-003** → delegation context template/checker
7. **KE-005** → adversarial QA framing (after H-001)
8. **KE-010** → coach context.md ("baseline first, most scenarios are ceiling")
9. **KE-013** → task-sizing heuristic in delegation

### LOW Priority (5 entries)

10. KE-006 → coach context.md one-liner
11. KE-009 → coach context.md one-liner
12. KE-016 → merge with KE-015
13. KE-017 → already cadence form
14. KE-018 → design principle note

### Already Optimal (3 entries)

- KE-004 — environmental ✅
- KE-008 — environmental ✅ (implicit)
- KE-014 — structural ✅ (patched code)

### Reference Only (1 entry)

- KE-012 — infrastructure validation record

---

## Skill Library Assessment (41 skills — summary)

Per H-059 and KE-002, skills split into two categories:

| Category | Count (est.) | U | Action |
|----------|-------------|---|--------|
| **Cadence skills** (temporal/frequency constraints) | ~5 | 0.4-0.6 | Keep and expand. materialize-findings is the proof case. |
| **Judgment skills** (reasoning/evaluation) | ~36 | 0.03-0.05 | Don't delete — but don't expect them to work. Convert critical ones to workflows. |

The skill library is large but mostly low-U. The fix isn't to remove skills — it's to:
1. Identify which ones could be cadence-form (target when/how-often, not what/how)
2. Convert the most important judgment-skills to workflow gates
3. Stop investing in new judgment-form skills

---

## Cross-Reference: Knowledge Routing Targets

When the routing layer (Phase 2.2) is built, these are the task→knowledge mappings to start with:

| Task Pattern | Inject These KEs |
|-------------|-----------------|
| "Add/modify a skill" | KE-002, KE-006, H-059 summary |
| "Design a workflow" | KE-007, KE-015, KE-016 |
| "Run an experiment" | KE-010 (ceiling warning), KE-012 (infrastructure valid) |
| "Edit SOUL.md or context.md" | KE-001, KE-004, KE-008 |
| "Evaluate agent quality" | KE-005, KE-015 |
| "Delegate a task" | KE-003, KE-013 |
| "Handle sycophancy/pushback" | KE-019, H-059 |

---

*Audit v1.0 | Bob (Architect) | 2026-04-04*
