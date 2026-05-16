/**
 * metric-ownership — Back-compat re-export shim.
 *
 * The canonical implementation has been promoted to @may-agent/sdk
 * (packages/sdk/src/metric-ownership.ts). New code should import from
 * `@may-agent/sdk` (or via shared/agent-sdk.ts for runtime-loaded code).
 *
 * This shim exists for handlers/tests that still use the
 * `shared/lib/metric-ownership` path.
 */

export {
  listConfiguredAgents,
  listAutonomousAgents,
  resolveMetricOwner,
} from "../agent-sdk.ts";
