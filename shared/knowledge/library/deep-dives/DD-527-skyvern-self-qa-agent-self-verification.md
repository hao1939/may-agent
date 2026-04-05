# DD#527 — Skyvern Self-QA: Getting Claude to QA Its Own Work

**Source:** Skyvern Blog — "Getting Claude to QA its own work" (April 3, 2026)
**Author:** Suchintan Singh (Skyvern)
**Tags:** #self-verification #coding-agent #browser-testing #qa-automation #production-engineering
**Relevance:** ★★★★ — Direct implementation of agent self-verification pattern

## One-Line Summary

Skyvern ships an MCP server with 33 browser tools that lets Claude Code verify its own frontend changes by opening a browser, inspecting pixels, and running interactions — one-shot PR rate jumps from 30% to 70%.

## What They Built

### Problem
Claude Code produces code that "looks kinda right" — type checks pass, but UI behavior is wrong. Buttons don't fire, forms overflow, layouts break. Human QA catches these, but it's slow and defeats the purpose of agentic coding.

### Solution: Self-QA Pipeline
1. **Read git diff** — understand what changed
2. **Classify diff** — Frontend, Backend, or Mixed
3. **Determine validation strategy** — how much of dev server to run
4. **Run browser-based QA** — open page, inspect pixels, exercise interactions
5. **Report results** — PASS/FAIL table with evidence
6. **(Bonus) Post evidence to PR** — screenshots, failure reasons

### Implementation
- **MCP Server** with 33 browser tools: sessions, navigation, form filling, data extraction, credential management, workflows
- **`/qa` skill** — local QA after each frontend change (~700 line prompt, open source)
- **`/smoke-test` skill** — CI pipeline integration (~300 lines)
- **Diff-scoped testing** — reads the diff, forms hypothesis about what changed, tests only nearby flows (avoids the flaky E2E test suite death spiral)

### Results
| Metric | Before | After |
|--------|--------|-------|
| One-shot PRs | ~30% | ~70% |
| QA loop time | Full manual cycle | Half |

### Key Design Decisions
1. **Narrow blast radius** — don't run everything on every commit; test only flows affected by the diff
2. **Evidence-based** — each test produces an evidence trail (screenshots, DOM state, failure description)
3. **Hypothesis-driven** — agent forms a hypothesis about what the diff affects, then tests that hypothesis

## Sample Output (CI)

| Flow | Result | Evidence |
|------|--------|----------|
| Settings save | FAIL | Submit button covered by overlay at 1280px width |
| Login redirect | PASS | User redirected to dashboard |
| Dashboard navigation | PASS | Sidebar links rendered and navigated correctly |

The evidence quality is remarkably specific — "Submit button was covered by an overlay at 1280px width, so the click never reached the form" — this is the kind of bug description a senior QA engineer would write.

## Architectural Pattern: Verify-After-Generate

This is a concrete implementation of a pattern we've seen emerging across the field:

```
Generate → Verify → Report → (Optional: Fix → Re-verify)
```

**Key insight**: The verification step uses a DIFFERENT modality than generation. The agent generates code (text), then verifies via browser interaction (visual + behavioral). This cross-modal verification catches failures that same-modality checks (linting, type checking) miss.

## Connections to Our System

### Direct Relevance (★★★★)
1. **Our agents generate code that needs verification** — we could adopt this exact pattern for frontend-affecting changes
2. **Self-verification is a form of quality gating** — connects to DD#511 BACE (Bayesian co-evolution of code and tests) and DD#524 (Imbue mngr testing)
3. **Diff-scoped testing** — the "narrow blast radius" principle maps directly to our checkpoint-based workflow. Each agent checkpoint should include a verification scope.

### Hypothesis Connections
- **DD#525 Goal Drift** — Self-QA acts as a runtime compliance check. If the agent drifts from its constraints, the QA step should catch the behavioral divergence.
- **DD#517 Raschka Harness Components** — The 6-component harness architecture. Self-QA is the missing "verification component" that Raschka identified as a gap.
- **DD#523 CORAL** — CORAL's evolution mechanism relies on test-based fitness. Skyvern's approach is the production-grade implementation of this principle.
- **CR#286 CORAL ↔ Our System** — Gap #2 (failure tracking) could be addressed with this kind of diff-scoped self-verification.

### What's Missing
1. **No mention of multi-agent coordination** — what happens when multiple agents' changes interact? The diff-scoped approach might miss cross-agent integration issues.
2. **No adversarial testing** — the agent tests its own work, but doesn't test adversarial inputs or edge cases it might be biased against finding.
3. **Cost analysis absent** — 33 browser tool calls per QA cycle isn't free. What's the token/time cost?

## Open Problems (From Authors)
- Keeping existing tests up to date
- Deciding blast radius for mixed frontend/backend diffs
- Detecting when agent-generated test plan is too shallow

## Rating Justification (★★★★)
Concrete, production-tested implementation of a pattern we've been theorizing about. The 30%→70% one-shot improvement is a strong signal. Loses one star because it's a blog post (not peer-reviewed), single-company experience, and doesn't address multi-agent scenarios. But the engineering quality and open-source availability make it highly actionable.

## Actionable Recommendations
- **R23**: Adopt diff-scoped self-verification for our agents' code changes — use browser tools for frontend, test runners for backend
- **R24**: Cross-modal verification principle — verify code changes using a different modality than generation (browser for UI, test execution for logic, linting for style)
- **R25**: Integrate verification scope into agent checkpoints — each checkpoint specifies what to verify and how

## Predictions
- **P261**: Diff-scoped self-QA will become standard in coding agent toolchains within 6 months (Cursor, Windsurf, etc. will add it)
- **P262**: The 30%→70% one-shot improvement will be replicated by other teams, but will plateau around 75-80% — the remaining cases require cross-component understanding

---
*Deep dive by Scout, April 5, 2026. Source: [Skyvern Blog](https://www.skyvern.com/blog/getting-claude-to-qa-its-own-work/). Code: [GitHub](https://github.com/Skyvern-AI/Skyvern)*
