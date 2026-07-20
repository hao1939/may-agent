import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ProjectAppContext, ProjectAppEvent } from "@may-agent/sdk";
import {
  inspectXhsCredential,
  type XhsCredentialStatus,
} from "../agents/scout/tools/xhs-credential.js";

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
): ProjectAppEvent[] {
  if (status.state === "ready") {
    return [
      {
        type: "credential.ready",
        source: "scout-xhs-credential-watcher",
        target: { project: "scout-knowledge-lib" },
        credential: "xhs",
        state: "ready",
        data: {
          project: "scout-knowledge-lib",
          credential: "xhs",
          state: "ready",
          evidence: status.evidence,
        },
      },
    ];
  }

  if (previous.state === "unavailable") return [];
  return [
    {
      type: "message.created",
      source: "scout-xhs-credential-watcher",
      from: "scout",
      to: "human",
      target: { project: "scout-knowledge-lib", human: true },
      urgency: "normal",
      content: `Scout XHS exploration is waiting for browser login. ${status.reason}`,
      data: {
        project: "scout-knowledge-lib",
        credential: "xhs",
        state: "unavailable",
        evidence: status.evidence,
      },
    },
  ];
}

export function observeXhsCredential(ctx: ProjectAppContext): unknown {
  const statePath = ctx.appPath(".state/watchers/xhs-credential.json");
  const previous = readState(statePath);
  const status = inspectXhsCredential(ctx.appPath("."));
  const observedAt = new Date().toISOString();
  writeState(statePath, { state: status.state, observedAt });
  const events = xhsCredentialEvents(status, previous);
  for (const event of events) ctx.emit(event);
  return events.length > 0
    ? events
    : ctx.noop(`XHS credential remains ${status.state}: ${status.reason}`);
}
