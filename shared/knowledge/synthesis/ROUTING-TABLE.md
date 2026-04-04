# Knowledge Routing Table

> **Purpose**: Maps task keywords → relevant KEs, and agent roles → always-relevant KEs.
> Used by tech-lead's router to inject 2-3 one-liner summaries into session context.
> **Format**: Designed for direct conversion to a JSON lookup table.
> **Author**: Bob | **Date**: 2026-04-04

---

## Part 1: Keyword → KE Mapping

When task text contains these keywords/phrases, inject the corresponding KE summaries.
Router should match case-insensitively and cap at 3 injected summaries per session.

| Keywords / Phrases | KE(s) to Inject | Why |
|---|---|---|
| `workflow`, `two-phase`, `enforce` | KE-007, KE-015, KE-016 | Agent needs to know workflows work + when to use them |
| `skill`, `SOUL.md`, `text rule`, `soul`, `lessons` | KE-002, KE-006 | Prevent wasted effort on text-based interventions |
| `experiment`, `gym`, `baseline`, `scenario` | KE-010, KE-012 | Check ceiling first; infrastructure is valid |
| `delegate`, `delegation`, `call agent`, `agents.call` | KE-003, KE-013 | Rich context + bounded tasks = quality |
| `context.md`, `context learn`, `environmental` | KE-001, KE-004, KE-011 | What context.md can/can't do |
| `sycophancy`, `sycophant`, `user request`, `harmful`, `compliance` | KE-019 | Must use materialization gates |
| `guard`, `regex`, `security`, `blocklist` | KE-004, KE-014 | Guards are brittle; canonicalize paths |
| `heartbeat`, `heartbeat.md`, `step restructur` | KE-008 | Don't add mandatory heartbeat steps |
| `QA`, `review`, `quality`, `detection` | KE-005 | QA rubber-stamps — consider adversarial framing |
| `knowledge`, `knowledge base`, `INDEX`, `reference` | KE-011, KE-001 | Agents skip passive knowledge; inject actively |
| `negative example`, `anti-pattern`, `don't do`, `lesson` | KE-009, KE-002 | Negative examples have zero effect |
| `intervention`, `behavioral`, `behavior change` | KE-002, KE-007, KE-018, KE-019 | Intervention hierarchy: L1-L5 |
| `nudge`, `template`, `pre-create` | KE-018, KE-017 | Environmental nudges match skills |
| `materialize`, `findings`, `intermediate`, `write findings` | KE-017, KE-019 | Materialization improves quality; gates fix sycophancy |
| `tool call`, `retry`, `tool-calling`, `missing file` | KE-006 | Reasoning skills don't fix tool-call habits |
| `boundedness`, `bounded`, `open-ended`, `judgment task` | KE-013, KE-015 | Task structure drives quality; R predicts workflow value |
| `R value`, `eliminable`, `decision topology`, `topology` | KE-015, KE-016 | Core predictive framework |
| `ceiling`, `pass at baseline`, `already passing` | KE-010 | Check before experimenting |
| `null patch`, `infrastructure`, `lab fork` | KE-012 | Infrastructure is valid |

---

## Part 2: Agent-Profile → Always-Inject KEs

These KEs are always injected for specific agent roles during **heartbeat sessions only** (per Hao's decision). 
Task sessions get keyword-matched KEs only; the dispatcher manually includes relevant knowledge.

### May (Orchestrator)
Always inject:
- **KE-003**: Rich delegation context reduces ops by 47%
- **KE-013**: Bounded tasks 90% good, open-judgment 41% — structure matters

Rationale: May delegates constantly. These are her two most actionable findings.

### Coach
Always inject:
- **KE-002**: Text rules 0/20 for judgment — don't design text interventions
- **KE-007**: Only workflows change behavior
- **KE-010**: Most scenarios are ceiling — check baselines first

Rationale: Coach designs interventions and runs experiments. These prevent the #1 and #2 time-wasters.

### Tech-Lead
Always inject:
- **KE-004**: Guards are brittle — use context.md for environmental constraints
- **KE-015**: Decision topology R predicts workflow effectiveness — R > 0.5 helps, R < 0.3 hurts

Rationale: Tech-lead builds structural interventions. Needs to know which approach fits which problem.

### Coder
Always inject:
- **KE-001**: context.md works for environmental facts only
- **KE-017**: Materializing intermediate findings improves quality + speed

Rationale: Coder benefits from environmental knowledge (paths, tools) and from writing intermediate state during complex tasks.

### Scout / Amy
Always inject:
- **KE-011**: Agents skip knowledge files — format findings for injection, not browsing
- **KE-003**: Rich context when delegating research tasks

Rationale: Scouts produce knowledge. They need to know HOW to format it so others actually consume it.

### Optimizer
Always inject:
- **KE-013**: Task boundedness drives session quality — key metric for waste analysis
- **KE-008**: Don't add heartbeat steps — causes regression

Rationale: Optimizer measures system health. These are the two findings most relevant to waste analysis and system design.

### Bob (Architect)
Always inject:
- **KE-015**: Decision topology R predicts workflow effectiveness
- **KE-011**: Agents skip knowledge files — delivery format determines utilization

Rationale: Bob designs the knowledge system and theoretical frameworks. These ground his synthesis work.

### QA
Always inject:
- **KE-005**: QA rubber-stamps at 14% detection — be adversarial
- **KE-017**: Materialize findings during review

Rationale: QA's #1 problem is not being adversarial enough. Direct reminder.

---

## Part 3: Injection Format

The router should inject summaries in this format (matching optimizer's "3 bullet points" request):

```
## Relevant Knowledge (auto-injected)
- **KE-007**: Only workflows change behavior — 0/20 text rules succeeded. Use two-phase enforcement. (56+ experiments)
- **KE-015**: R > 0.5 → workflow helps, R < 0.3 → workflow hurts. Estimate before assigning. (ρ=0.95)
```

Rules:
1. **Max 3 summaries per session** — more than 3 gets ignored (KE-008: overhead hurts)
2. **Agent-profile entries count toward the cap** — if profile gives 2, keyword match adds max 1
3. **Deduplicate** — if keyword match overlaps with profile, don't repeat
4. **One-liners only** — use summaries from `KE-SUMMARIES.md`, not full entries
5. **Heartbeats get profile + keyword; task sessions get keyword only** (Hao's decision)

---

## Part 4: JSON-Ready Format (for tech-lead)

```json
{
  "keyword_routes": {
    "workflow": ["KE-007", "KE-015", "KE-016"],
    "two-phase": ["KE-007", "KE-015", "KE-016"],
    "enforce": ["KE-007", "KE-015", "KE-016"],
    "skill": ["KE-002", "KE-006"],
    "SOUL.md": ["KE-002", "KE-006"],
    "text rule": ["KE-002", "KE-006"],
    "experiment": ["KE-010", "KE-012"],
    "gym": ["KE-010", "KE-012"],
    "baseline": ["KE-010", "KE-012"],
    "scenario": ["KE-010", "KE-012"],
    "delegate": ["KE-003", "KE-013"],
    "delegation": ["KE-003", "KE-013"],
    "context.md": ["KE-001", "KE-004", "KE-011"],
    "sycophancy": ["KE-019"],
    "sycophant": ["KE-019"],
    "guard": ["KE-004", "KE-014"],
    "regex": ["KE-004", "KE-014"],
    "heartbeat": ["KE-008"],
    "QA": ["KE-005"],
    "review": ["KE-005"],
    "knowledge": ["KE-011", "KE-001"],
    "INDEX": ["KE-011", "KE-001"],
    "negative example": ["KE-009", "KE-002"],
    "anti-pattern": ["KE-009", "KE-002"],
    "intervention": ["KE-002", "KE-007", "KE-018", "KE-019"],
    "behavioral": ["KE-002", "KE-007", "KE-018", "KE-019"],
    "nudge": ["KE-018", "KE-017"],
    "template": ["KE-018", "KE-017"],
    "materialize": ["KE-017", "KE-019"],
    "findings": ["KE-017", "KE-019"],
    "tool call": ["KE-006"],
    "retry": ["KE-006"],
    "bounded": ["KE-013", "KE-015"],
    "judgment": ["KE-013", "KE-015"],
    "decision topology": ["KE-015", "KE-016"],
    "topology": ["KE-015", "KE-016"],
    "ceiling": ["KE-010"],
    "null patch": ["KE-012"],
    "security": ["KE-014"]
  },
  "agent_profiles": {
    "may": ["KE-003", "KE-013"],
    "coach": ["KE-002", "KE-007", "KE-010"],
    "tech-lead": ["KE-004", "KE-015"],
    "coder": ["KE-001", "KE-017"],
    "scout": ["KE-011", "KE-003"],
    "amy": ["KE-011", "KE-003"],
    "amy-kimi": ["KE-011", "KE-003"],
    "optimizer": ["KE-013", "KE-008"],
    "bob": ["KE-015", "KE-011"],
    "qa": ["KE-005", "KE-017"]
  },
  "max_injections": 3,
  "summary_source": "agents/shared/knowledge/summaries/KE-SUMMARIES.md",
  "injection_rules": {
    "heartbeats": "profile + keyword (cap 3)",
    "task_sessions": "keyword only (cap 3, dispatcher adds manual context)"
  }
}
```

---

## Maintenance

When a new KE is verified:
1. Add 1-3 line summary to `KE-SUMMARIES.md`
2. Add keyword mappings to this table
3. Add to relevant agent profiles if universally important
4. If top-5 universal, add to `DRAFT-universal-context-entries.md`
