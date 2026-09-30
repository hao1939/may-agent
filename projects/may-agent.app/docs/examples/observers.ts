import { Type, defineApp, defineObserver, observationCondition, type AppRead } from "../../../may-agent/packages/sdk/src/index.js";

// The App knows provider scope, credentials and response semantics.
export function buildsApp(readBuild: (resource: string, signal: AbortSignal) => Promise<{ state: string; revision: number }>) {
  return defineApp({
    id: "builds", version: 1, agent: "builds-owner", inputSchema: Type.Object({}),
    observers: [defineObserver({
      id: "status", type: "build.state", description: "Submitted build state: running, passed, failed or cancelled; revision is the provider revision.",
      intervalMs: 60_000, timeoutMs: 10_000,
      inspect: (resource, { signal }) => readBuild(resource, signal),
    })],
  });
}

// The worker uses installed capabilities; it does not construct or publish events.
export async function buildResultWait(read: Pick<AppRead, "contract">, resource: string, id = "build-result") {
  const contract = await read.contract("builds");
  const capability = contract.observations.find(item => item.id === "status");
  if (!capability) throw new Error("Build observation is unavailable; inspect the installed builds App");
  return observationCondition(capability, {
    observerId: "status", id, resource,
    expected: { field: "state", anyOf: ["passed", "failed", "cancelled"] },
  });
}
