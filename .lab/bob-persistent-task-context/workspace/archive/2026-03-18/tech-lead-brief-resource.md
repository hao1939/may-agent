# Tech-Lead Brief: Resource-Awareness (Consolidated)

**Context**:
- **Agent-RRM (HB#432)**: Tokens are money, time is money. Agents need explicit feedback loops to optimize.
- **Protocol Convergence (HB#461)**: "Cost Signal" and "Budget Warning" are standard features in mature agent OSs.
- **Consolidation Mode**: We are pausing new features, but this is a *reliability* feature (preventing infinite loops/cost overruns).

## Requirement 1: Cost Feedback Loop (P113)
Inject cost metadata into tool outputs so agents "feel" the expense of their actions.

**Implementation**:
- In `src/lib/manager-receipts.ts` (or wherever `wrapToolsWithReceipts` lives):
- Measure `startTime` before execution, `endTime` after.
- Measure `outputBytes` (length of string).
- **Condition**: If `duration > 2000ms` OR `outputBytes > 10000`:
  - Append: `\n\n<system_note>[COST: ${duration}ms, ${kb}KB]</system_note>`
  - Place it *after* the tool output so it doesn't break JSON parsing, but *before* the closing tag if possible (or just append to the message content).

## Requirement 2: Session Budget Warning (P113/P85)
Warn agents when they are burning through their turn budget.

**Implementation**:
- In `src/lib/manager.ts` or `manager-receipts.ts`:
- Check `session.turnCount` vs `session.turnBudget` (default 50).
- **Condition**: If `turnCount >= turnBudget * 0.8` AND `!warned`:
  - Append: `\n\n⚠️ [SYSTEM WARNING: Turn Budget ${turnCount}/${turnBudget}] You have used 80% of your turns. Wrap up.`
  - Set `warned = true`.

## Status
- You already implemented the logic in `manager-receipts.ts`? (Grep shows `turnBudgetWarningAt` code exists).
- **Verification**: Please verify that `[COST: ...]` and `[SYSTEM WARNING: ...]` actually appear in session logs. I saw the code, but I haven't seen the output in my recent sessions.
- **Action**: Run a test session that triggers the thresholds. If it works, close the task. If not, fix the injection point.
