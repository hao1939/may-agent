import { defineObserver, type ObservationContract } from "@may-agent/sdk";
import { inspectXhsCredential } from "../agents/scout/tools/lib/xhs-credential.js";

export const xhsCredentialContract: ObservationContract = {
  appId: "scout-knowledge-lib",
  id: "xhs-credential",
  type: "credential.state",
  description:
    "Read XHS browser access for resource xhs. Returns state, reason, evidence and any observed loginWall. Wait for state=ready after a confirmed login requirement. This probe only reads the page; Scout execution owns opening an absent tab and diagnosing other access failures.",
  intervalMs: 300_000,
  timeoutMs: 35_000,
};

export function createXhsCredentialObserver(
  appDir: string,
  inspect = inspectXhsCredential,
) {
  return defineObserver({
    ...xhsCredentialContract,
    async inspect(resource, { signal }) {
      if (resource !== "xhs") throw new Error("Unknown XHS credential resource");
      signal.throwIfAborted();
      const status = await inspect(appDir, signal);
      signal.throwIfAborted();
      return { ...status };
    },
  });
}
