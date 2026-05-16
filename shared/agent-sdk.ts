/**
 * Compatibility import point for app-owned agent code.
 *
 * The contract is owned by infra at projects/platform/repos/may-agent/packages/sdk
 * (package name @may-agent/sdk). We re-export it via the on-disk relative path
 * rather than the bare specifier so that handlers loaded dynamically into the
 * compiled may-agent binary can resolve it — the standalone binary does not
 * walk /app/node_modules at runtime the way a regular `bun` invocation does.
 *
 * Keep this file thin so older relative imports continue to work while new
 * code imports the package directly.
 */

export * from "../projects/platform/repos/may-agent/packages/sdk/src/index.ts";

// Local app utilities that predate the infra SDK package.
export {
  forkAgent,
  promoteAgent,
  discardAgent,
  listLabAgents,
} from "./lib/growth.js";
export type { GrowthConfig } from "./lib/growth.js";

export {
  validateFinishDeliverables,
  enforceFinishDeliverables,
  validateVerificationEvidence,
  enforceVerificationEvidence,
} from "./guards/finish-guard.js";
export type {
  FinishDeliverable,
  FinishCallParams,
  FinishValidationResult,
  EvidenceValidationResult,
} from "./guards/finish-guard.js";
