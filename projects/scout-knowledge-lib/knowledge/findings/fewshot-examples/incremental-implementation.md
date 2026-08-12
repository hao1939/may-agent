# Few-Shot Example: Incremental Implementation

**Domain class**: Green-field feature implementation tasks  
**Skill**: plan-then-build (incremental delivery)  
**Token estimate**: ~550 tokens

## Trigger Patterns

```regex
/implement|create.*endpoint|add.*feature|build.*service|set up|add.*support|new.*module|add.*page|add.*route/i
```

## Worked Example

> **Reference: How an experienced engineer implemented a new notification feature**
>
> An engineer was asked to add email notification support to an existing order processing system. The task said: "Add email notifications when orders are placed."
>
> Here's exactly how the engineer approached it:
>
> **Step 1 — Read existing code before writing anything:**
> ```
> $ cat src/orders/order-service.ts
> ```
> The engineer read the existing order service to understand: What events exist? What's the module structure? Where do side-effects happen? They discovered orders already emit an `order.created` event via an EventEmitter — the hook point already existed.
>
> **Step 2 — Check for existing patterns to follow:**
> ```
> $ grep -r "EventEmitter\|.on(" src/
> ```
> Found that `src/logging/audit-logger.ts` already listens to `order.created` for audit logs. This is the pattern to follow — same event, new listener. No need to invent a new architecture.
>
> **Step 3 — Implement incrementally (smallest working piece first):**
> Rather than building the full email system at once, the engineer:
> 1. Created `src/notifications/email-notifier.ts` — listener that logs "would send email to {customer}" 
> 2. Registered it in `src/app.ts` (following audit-logger's pattern exactly)
> 3. Ran existing tests to verify nothing broke: `npm test` → all green
> 4. Then added the actual email-sending logic with proper error handling
> 5. Wrote a test for the new module
>
> **Step 4 — Verify the full chain:**
> ```
> $ npm test
>   ✅ order-service: creates order correctly
>   ✅ audit-logger: logs order.created events  
>   ✅ email-notifier: sends email on order.created
>   ✅ email-notifier: handles missing customer email gracefully
> 4 passed, 0 failed
> ```
>
> **Why read-first mattered**: The engineer avoided creating a polling system or a new event bus because they discovered the EventEmitter pattern already existed. Following existing conventions meant the code fit naturally and required no architectural changes.
>
> **Why incremental mattered**: By getting the listener registered and working (with a log statement) before adding email logic, the engineer isolated integration issues from implementation issues. If registration failed, they'd know immediately — not after writing 100 lines of email code.

## Evidence

Based on patterns from EXP-084–097 (few-shot injection proven 100% effective in matched domains). This example extends coverage to implementation tasks (previously unmatched).

## Source

Designed for EXP-745 Phase 2 (pattern coverage expansion).
