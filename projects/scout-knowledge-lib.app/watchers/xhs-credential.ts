import type {
  AppEvent,
  AppObserver,
  AppObserverResult,
  ObserverContext,
} from "@may-agent/sdk";
import {
  inspectXhsCredential,
  type XhsCredentialStatus,
} from "../agents/scout/tools/lib/xhs-credential.js";

type XhsCredentialWatcherState = {
  state?: XhsCredentialStatus["state"];
};

export function xhsCredentialEvents(
  status: XhsCredentialStatus,
  previous: XhsCredentialWatcherState = {},
): AppEvent<Record<string, unknown>>[] {
  const observation: AppEvent<Record<string, unknown>> = {
    type: "credential.state",
    source: "scout-xhs-credential-watcher",
    target: { project: "scout-knowledge-lib" },
    data: {
      project: "scout-knowledge-lib",
      credential: "xhs",
      state: status.state,
      evidence: status.evidence,
      reason: status.reason,
      ...(status.loginWall !== undefined
        ? { loginWall: status.loginWall }
        : {}),
    },
  };
  return status.state === "ready" || previous.state !== status.state
    ? [observation]
    : [];
}

export async function observeXhsCredential(
  ctx: ObserverContext,
  inspect = inspectXhsCredential,
): Promise<AppObserverResult> {
  const previous = ctx.previousObservation as
    | XhsCredentialWatcherState
    | undefined;
  const status = await inspect(ctx.workspace.appRoot);
  // The Host advances this memory only after publishing the returned facts,
  // and discards results from replaced observer generations.
  return {
    events: xhsCredentialEvents(status, previous),
    nextObservation: { state: status.state },
  };
}

export const xhsCredentialObserver: AppObserver = {
  id: "xhs-credential",
  intervalMs: 300_000,
  run: observeXhsCredential,
};
