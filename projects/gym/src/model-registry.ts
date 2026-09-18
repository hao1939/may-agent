import { createModelRegistry } from "../../may-agent/src/app/model-registry";

/**
 * Gym experiments must execute the frozen model identity or fail invalid.
 * Host-level credential fallback is intentionally disabled for controlled runs.
 */
export function createControlledModelRegistry() {
  const registry = createModelRegistry();
  return Object.fromEntries(
    Object.entries(registry).map(([id, model]) => {
      const { fallbackModel: _fallbackModel, ...frozenModel } = model;
      return [id, frozenModel];
    }),
  );
}
