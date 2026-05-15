/**
 * Compatibility import point for app-owned agent code.
 *
 * The contract is owned by infra in @may-agent/sdk. Keep this file thin so
 * older relative imports continue to work while new code imports the package
 * directly.
 */

export * from "@may-agent/sdk";

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
