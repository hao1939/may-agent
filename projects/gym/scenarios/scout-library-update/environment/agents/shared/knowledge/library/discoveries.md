# Research Discoveries

Observations, patterns, and insights from research and internal experiments.

---

### 2026-03-26 — Skill file length correlates with compliance

**Finding**: Skills under 50 lines get 2.3x higher adoption than skills over 100 lines.
**Source**: Analysis of 12 skill files vs. convention check data.
**Implication**: Keep skills concise. Split complex skills into focused micro-skills.

---

### 2026-03-31 — Error cascading pattern in multi-agent delegation

**Finding**: When a delegated task fails, the delegator retries an average of 2.7 times before escalating or pivoting. First retry succeeds 60% of the time; subsequent retries have <20% success rate.
**Source**: Analysis of 45 delegation chains in session logs.
**Implication**: Limit retries to 1 before pivoting strategy. The "retry storm" pattern wastes turns.

---

### 2026-04-02 — Git operations fail silently in container environments

**Finding**: `git add` in agents/ directories silently succeeds but has no effect due to .gitignore rules. Agents waste 3-5 turns on git workflows that do nothing.
**Source**: QA session analysis of 8 coder sessions.
**Implication**: Add to common-sense: "agents/ files are gitignored — don't git add them."

---

### 2026-04-04 — Baseline ceiling effect in gym scenarios

**Finding**: 7 of 10 newly created gym scenarios show ceiling effects — agents pass at baseline without any intervention. This makes A/B testing impossible.
**Source**: Coach gym experiments (March-April 2026).
**Implication**: Scenarios must be designed with specific traps that target known weak behaviors. Generic tasks are too easy.
