# EXP-415: Information-First Planning — Hidden Constraints Scenario

## Problem
EXP-400, 405, 410 all INCONCLUSIVE. Planning scenarios hit ceiling because:
- Tasks are given in correct order → agent just executes linearly
- Dependencies are explicit → no discovery needed

## Key Insight
Planning skill value emerges when **the task description is incomplete** and the agent must gather information before acting. Real-world planning failures happen when agents:
1. Start executing before understanding the full picture
2. Miss constraints hidden in files/configs
3. Make assumptions that conflict with actual state

## Hypothesis
A scenario with deliberately misleading task framing + hidden constraints in files will produce baseline ≤60%.
The `decompose-before-acting` skill (read all relevant files, identify constraints, then plan) will raise pass rate ≥20pp.

## Scenario Design: `hidden-constraints-refactor`

### Setup
Agent receives: "Refactor the API module — split routes.js into 3 files (users.js, orders.js, admin.js)"

**Hidden constraints the agent must discover by reading files:**
1. `routes.js` has shared middleware that MUST remain in a central location (breaks if duplicated)
2. `.env.test` reveals admin routes require a special auth token not present in production — moving them to admin.js without the guard breaks tests
3. `package.json` has a test script that imports from `routes.js` directly — must update
4. `ARCHITECTURE.md` documents a circular dependency rule: admin cannot import from orders
5. `tsconfig.json` has path aliases that would break if files move to subdirectory

### Checks (7 total, pass ≥5)
1. users.js exists with user routes
2. orders.js exists with order routes  
3. admin.js exists with admin routes
4. Shared middleware is in its own file (NOT duplicated)
5. Test file updated to import from new locations
6. No circular dependency (admin doesn't import orders)
7. Path aliases still resolve correctly

### Why This Should Hit Goldilocks
- Task SOUNDS simple (just split a file into 3)
- But naive splitting breaks 4 different things
- Agent that reads all files first will discover constraints
- Agent that dives straight in will miss 2-3 constraints

### Arms
- **Baseline**: Standard agent, no planning skill
- **Treatment**: Agent with `decompose-before-acting` skill loaded

### Protocol
- 3 trials per arm (6 total)
- Measure: pass rate + which specific constraints are missed

## Status
COMPLETED — Treatment results POSITIVE (+33pp). See `EXP-415-treatment-results.md`.
