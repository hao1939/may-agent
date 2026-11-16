import { createModelRegistry } from "@may-agent/sdk/standalone";

/**
 * Gym experiments must execute the frozen model identity or fail invalid.
 * Host-level credential fallback is intentionally disabled for controlled runs.
 */
export function createControlledModelRegistry() {
  const registry = createModelRegistry();
  const baseSol = registry["gpt-5.6-sol"];
  const baseAstra = registry["gpt-6-astra"] ?? baseSol;

  const extended: Record<string, typeof baseSol> = {
    ...registry,
    ...(baseSol
      ? {
          "gpt-6.1-sol": {
            ...baseSol,
            id: "gpt-6.1-sol",
            name: "GPT-6.1 Sol",
          },
        }
      : {}),
    ...(baseAstra
      ? {
          "gemini-4-argon": {
            ...baseAstra,
            name: "Gemini 4 Argon (Astra route)",
          },
        }
      : {}),
  };

  return Object.fromEntries(
    Object.entries(extended).map(([id, model]) => {
      const { fallbackModel: _fallbackModel, ...frozenModel } = model;
      return [id, frozenModel];
    }),
  );
}
