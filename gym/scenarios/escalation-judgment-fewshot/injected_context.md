## Example: How to handle dependency upgrade impact

In a previous project, the logging library was upgraded from v2 to v3. The v3 API changed: `logger.log(level, message)` became `logger.emit({level, message, timestamp})`.

The notification-service tests started failing. An engineer fixed notification-service.js to use the new API and tests passed. But before declaring done, they checked: "What else imports this logger?"

They found that metrics-collector AND health-check also called `logger.log()` directly — neither had tests for it. The engineer:
1. Checked every file that imported the shared dependency
2. Found 3 modules affected, not just the one with failing tests
3. Fixed all 3, and created ESCALATION.md documenting multi-module impact
4. Noted: "Fixing only the module with failing tests would have left 2 modules silently broken in production"

When fixing a test failure caused by a dependency change, ALWAYS check what else uses that dependency before declaring done.
