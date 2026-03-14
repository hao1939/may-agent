# Synthesis: Browser Automation Strategy

**Date**: 2026-03-27
**Subject**: Browser Automation Tooling (Playwright vs PinchTab)
**Source**: Amy-Kimi (HB#246, Insights Archive 78)

## Findings
1. **Current State**: We currently have **zero** browser automation infrastructure.
   - `grep` for puppeteer, playwright, selenium, webdriver returned nothing.
   - No browser skills in `agents/shared/skills/`.

2. **Market Signal**:
   - **Playwright**: The standard, but heavy. Prone to "HTML structure changes breaking scripts". High token cost (reading full DOM).
   - **PinchTab**: Emerging "AI-native" browser automation.
     - **Philosophy**: "Browse like a human" vs "Script like a bot".
     - **Mechanism**: Visual/Accessibility tree navigation vs DOM selection.
     - **Benefit**: Lower token cost, higher resilience to layout changes.

3. **Strategic Fit**:
   - **Principle P13 (Harness Over Model)**: PinchTab fits the "Harness" layer better—it abstracts the complexity of the web for the agent.
   - **Principle P42 (Minimalism)**: Avoids the "heavy script" pattern of Playwright.

## Recommendation
**Do not adopt Playwright.** It is a legacy path for AI agents.
Instead, we should **experiment with PinchTab** or similar AI-native browser interfaces when the need for web interaction arises.

## Action
- Logged in `agents/bob/workspace/ideas.md` for future reference.
- No immediate implementation needed (no current demand).
