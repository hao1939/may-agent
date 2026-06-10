/**
 * feature-brief-panel.js — Documentation stub
 *
 * The Feature Brief & Reference Panel is implemented inline in quality-panel.js
 * within the feature page renderer (search "Feature Contract Panel").
 *
 * ## Rendering location
 *   quality-panel.js, feature page section starting ~L2107
 *   Rendered inside <section class="aks-feature-page"> when a feature group
 *   is selected via the /feature/:id route.
 *
 * ## Key functions (all in quality-panel.js)
 *
 *   extractRoleClaims(yaml, role)
 *     Parses groundTruth.<role> from a feature-packet YAML string.
 *     Returns Array<{ path, scenario, claim }> for each claim entry.
 *     Roles iterated: design, api, userDocs, goE2E, implementation.
 *
 *   loadFeaturePacket(packetId)
 *     Fetches features/<packetId>.yaml via the project
 *     artifact API. Returns the raw YAML string or null.
 *
 * ## Rendered sections (inside "Feature Contract" panel)
 *
 *   1. Purpose / Intent
 *      Extracts `purpose:` from the feature packet YAML.
 *      Shows "No feature packet found…" when missing.
 *
 *   2. Source References By Role
 *      Iterates refRoles = ['design','api','userDocs','goE2E','implementation'].
 *      For each role with claims: renders claim text + source path/scenario links.
 *      For each empty role: renders "No <role label> references in the feature
 *      packet." (visible, not hidden — aks-empty class).
 *      Fallback when no packet exists: shows test-spec sourceRefs or a generic
 *      "No source references found" message.
 *
 *   3. Constraints & Non-Goals
 *      Lists accepted/rejected input paths from the packet.
 *
 * ## Feature packets
 *   Stored in features/<featureId>.yaml.
 *   Example: features/managedsystem-pool.yaml
 *     - purpose: describes ManagedSystem Pool add-existing path
 *     - groundTruth: has all 5 roles (design, api, userDocs, goE2E, implementation)
 *     - coveredFeatureIds: list of sub-feature IDs
 *
 * ## Why a stub?
 *   The V3 feature-contract-section work shipped all rendering logic directly
 *   into quality-panel.js before the V4 brief-panel task was decomposed.
 *   This stub exists as a documentation pointer so the task tree can close
 *   cleanly. If the panel is ever extracted into its own module, this file
 *   is the intended home.
 */

// Re-export marker — no runtime code; rendering lives in quality-panel.js.
// To find the implementation, search quality-panel.js for:
//   "Feature Contract Panel"   — section header
//   extractRoleClaims          — role-based claim parser
//   "Source References By Role" — grouped references renderer
export const FEATURE_BRIEF_PANEL_IMPL = "quality-panel.js";
