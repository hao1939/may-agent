# Tech-Lead Heartbeat Notes

## 2026-05-04 Heartbeat

### TypeScript Build
- ✅ Clean (0 errors) — `npx tsc --noEmit` in `agents/`

### KE-455/KE-731 Investigation (metric-alert-reactor can't fire on events)
- **Root cause**: The event bus runtime (`src/lib/cron-tool.ts`) is not in this workspace. It's deployed separately and not editable from here.
- **Workaround already in place**: All `on:`-only handlers have a dummy `intervalMs: 86400000` so they get registered by the scheduler.
- **Actual fix needed**: The runtime event bus must be modified to dispatch events to handlers registered with `on:` fields. This is outside agent-workspace scope.
- **Recommendation**: This is an infra/platform issue. The human operator or whoever maintains the runtime deployment needs to fix event dispatch.

### Projects
- `retry-removal`: closed ✅
- `handler-reliability`: closed ✅  
- `proof-of-life-dashboard`: waiting (no project file found in .state/projects/)
