import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AppEvent, AppObserver, ObserverContext } from "@may-agent/sdk";
import {
  inspectXhsCredential,
  type XhsCredentialStatus,
} from "../agents/scout/tools/lib/xhs-credential.js";

type XhsCredentialWatcherState = {
  state?: XhsCredentialStatus["state"];
  observedAt?: string;
};

function readState(path: string): XhsCredentialWatcherState {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object"
      ? (parsed as XhsCredentialWatcherState)
      : {};
  } catch {
    return {};
  }
}

function writeState(path: string, state: XhsCredentialWatcherState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

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
    },
  };
  return status.state === "ready" || previous.state !== status.state
    ? [observation]
    : [];
}

export async function observeXhsCredential(
  ctx: ObserverContext,
): Promise<AppEvent<Record<string, unknown>>[]> {
  const statePath = `${ctx.workspace.appRoot}/.state/watchers/xhs-credential.json`;
  const previous = readState(statePath);
  const status = inspectXhsCredential(ctx.workspace.appRoot);
  const observedAt = new Date().toISOString();
  writeState(statePath, { state: status.state, observedAt });
  return xhsCredentialEvents(status, previous);
}

export const xhsCredentialObserver: AppObserver = {
  id: "xhs-credential",
  intervalMs: 300_000,
  run: observeXhsCredential,
};
