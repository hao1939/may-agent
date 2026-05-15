# Phase 1 Findings: Hao's Direct Interactions

**Date**: 2025-06-27
**Sessions scanned**: 67 chat sessions (all `kind: "chat"` from `.state/sessions/`)
**Period**: 2025-05-10 to 2025-06-27

---

## Summary

67 direct Hao interactions were found across the session history. Sources: unknown/cli (early sessions before source tracking), socket, telegram, cli. All are routed to agent `may`. Below are the extracted directives, corrections, preferences, and patterns.

---

## 1. Explicit Directives (things Hao told the system to do)

| # | Directive | Session timestamp | Category |
|---|-----------|-------------------|----------|
| D1 | Review docs against philosophy, reorganize, mark unimplemented | 1773303801988 | quality/hygiene |
| D2 | Remind agents: making existing things work > exploring new features | 1773391879828 | **stability-first** |
| D3 | Build tooling to show what system is working on and where it's heading | 1773410404965 | observability |
| D4 | All agents pause new features, focus on existing features, reevaluate value | 1773470593760 | **stability-first** |
| D5 | Coach should explore options, verify with gym; Optimizer should improve workflows | 1773832105968 | role clarity |
| D6 | Bob and tech-lead need structured methods (superpowers framework) for quality work | 1773837790352 | quality |
| D7 | Stop amy, use amy-kimi instead | 1773924493422 | decisiveness |
| D8 | Investigate dynamic tool loading system | 1773945938972 | technical direction |
| D9 | Review agent-teams architecture design | 1774360374849 | architecture |
| D10 | Bob review design, tech-lead make it real (delegation pattern) | 1774788594705 | **role separation** |
| D11 | Keep pushing the guard system forward | 1776159729124 | priority |
| D12 | May MUST use fork, NEVER call — stay responsive | 1776180568119 | **critical rule** |
| D13 | Don't weaken guards — escalate to owner instead of bypass | 1776277405256 | **critical correction** |
| D14 | Metrics + Gym unified design — full plan with milestones | 1776325183029 | architecture/plan |
| D15 | Fork bob to write system-gaps.md | 1776336175530 | direct command |
| D16 | New P0: Workflow-First Culture for optimizer | 1776611617990 | project launch |
| D17 | Skills/workflows need quality assessment | 1777144803961 | quality |
| D18 | Fix existing projects, clean up before moving on | 1777484383688 | **stability-first** |

---

## 2. Corrections (things Hao said "no" or "wrong" to)

| # | Correction | What went wrong | Pattern |
|---|-----------|----------------|---------|
| C1 | Don't forward bundling directive blindly — understand it first, break into sub-tasks | May was forwarding without processing | **Think before delegating** |
| C2 | May MUST use fork not call | May blocked for 345 minutes using agents.call() | **Stay responsive** |
| C3 | Guards must stay strong — don't make them warn-only | Tech-lead weakened guards to "warn-only" | **Don't weaken constraints** |
| C4 | Agents should focus on existing work, not explore new features | Agents kept starting new things | **Finish before starting** |
| C5 | OpBudget limits too restrictive for coach/optimizer — lift them | System config blocking useful work | **Remove blockers pragmatically** |

---

## 3. Preferences (inferred behavioral patterns)

### 3a. Core Values
1. **Stability over novelty**: At least 3 separate times (D2, D4, D18), Hao told agents to stop exploring and focus on what exists. This is the single strongest signal.
2. **Hygiene and cleanup**: "Clean up the house before we move on" — recurring theme.
3. **Quality over quantity**: Bob/tech-lead need structured methods, not just output volume.
4. **Observability**: Wants to see what's happening — asked for tracking tools, status visibility.

### 3b. Delegation Style
1. **Expects May to be a thinking supervisor**, not a message router (C1).
2. **Role clarity**: Bob = design/architecture, tech-lead = implementation. Explicit separation.
3. **May must stay responsive** — never block on child work. Fork + peek pattern.
4. **Direct and terse**: Many messages are 1-2 sentences. Expects quick action, not discussion.

### 3c. Technical Philosophy
1. **Guards and constraints should be real**, not advisory. If an agent can't proceed, escalate — don't auto-bypass.
2. **Unified plans over incremental patches**: Prefers comprehensive designs (metrics+gym plan) over piecemeal additions.
3. **Verify before acting**: Check review suggestions against actual code (session 1773515262694).
4. **Dynamic capabilities**: Interested in agents generating their own tools.

### 3d. Communication Style
1. **Brief status requests**: "What's the progress?", "Brief", "hi" — expects concise responses.
2. **Detailed when it matters**: The metrics+gym plan and guard correction are both very detailed when precision matters.
3. **Impatient with idleness**: "Why agents are not working?" — expects continuous productivity.

### 3e. Anti-patterns (things that frustrate Hao)
1. Agents idle when they have work available
2. May being unresponsive (blocked on call)
3. Guards being weakened / constraints being softened
4. Forwarding tasks without understanding them
5. Exploring new features when existing ones are broken
6. Not knowing what the system is doing

---

## 4. Interaction Frequency

| Period | Approx. sessions | Notes |
|--------|-----------------|-------|
| Early (1773xxx - ~May 10-12) | ~30 | Heavy setup, doc review, initial direction |
| Mid (1773xxx-1774xxx - ~May 12-22) | ~15 | Flexnodehelper, tool investigation, teams design |
| Late (1774xxx-1776xxx - ~May 22 - Jun 14) | ~12 | Guards, metrics, workflow-first |
| Recent (1777xxx - ~Jun 27) | ~3 | Clean up, fix existing, progress check |

Pattern: Hao was very active in early setup, then shifted to periodic steering corrections, now focuses on stability/cleanup.

---

## 5. Key Quotes

> "it's important to try new thing, but it's even more important to make sure of what we have and make sure it works as designed"

> "please ask all agents to pause explore new feature, take a break and focus on current existing features"

> "I want you to keep the existing projects working now and fix any failures or blocks. Clean up the house before we move on"

> "Do NOT just forward the bundling directive to Bob/Tech Lead blindly. YOUR job before delegating"

> "Guards stay strong. The agent is never permanently stuck because they can always ask for help."

---

## 6. Recommendations for Phase 2

1. **Encode "stability-first" as a system-wide principle** — this is Hao's #1 recurring theme
2. **Add correction detection to May's post-session processing** — when Hao says "no" or "wrong", extract and persist
3. **Build a preference scorecard** for common decision types: "should we start X?" → check against stability-first, existing-work-completion, quality bar
4. **Track correction rate** going forward to measure alignment improvement
