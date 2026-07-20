import { spawnSync } from "node:child_process";
import { join } from "node:path";

export type XhsCredentialStatus = {
  credential: "xhs";
  state: "ready" | "unavailable";
  reason: string;
  evidence: string[];
};

type XhsStatusOutput = {
  status?: unknown;
  data?: {
    ready?: unknown;
    url?: unknown;
    noteCount?: unknown;
    loginWall?: unknown;
    reason?: unknown;
  };
  error?: unknown;
};

function unavailable(
  reason: string,
  evidence: string[] = [],
): XhsCredentialStatus {
  return { credential: "xhs", state: "unavailable", reason, evidence };
}

export function parseXhsCredentialOutput(
  stdout: string,
  stderr = "",
  exitCode = 0,
): XhsCredentialStatus {
  const raw = stdout.trim() || stderr.trim();
  let parsed: XhsStatusOutput;
  try {
    parsed = JSON.parse(raw) as XhsStatusOutput;
  } catch {
    return unavailable("XHS credential preflight returned invalid JSON", [
      `exit:${exitCode}`,
      raw ? `output:${raw.slice(0, 200)}` : "output:empty",
    ]);
  }

  if (exitCode !== 0 || parsed.status !== "success" || !parsed.data) {
    return unavailable(
      String(parsed.error ?? "XHS credential preflight failed"),
      [`exit:${exitCode}`],
    );
  }

  const url = String(parsed.data.url ?? "unknown");
  const noteCount = Number(parsed.data.noteCount ?? 0);
  const loginWall = parsed.data.loginWall === true;
  const ready = parsed.data.ready === true;
  const evidence = [
    `url:${url}`,
    `note-count:${Number.isFinite(noteCount) ? noteCount : 0}`,
    `login-wall:${loginWall}`,
  ];
  return ready
    ? {
        credential: "xhs",
        state: "ready",
        reason: "The XHS browser session can read source content.",
        evidence,
      }
    : unavailable(
        String(parsed.data.reason ?? "The XHS browser session requires login."),
        evidence,
      );
}

export function inspectXhsCredential(appDir: string): XhsCredentialStatus {
  const toolPath = join(appDir, "agents", "scout", "tools", "xhs-browse.mjs");
  const result = spawnSync("node", [toolPath, "status"], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (result.error) {
    return unavailable(
      `XHS credential preflight could not run: ${result.error.message}`,
    );
  }
  return parseXhsCredentialOutput(
    result.stdout ?? "",
    result.stderr ?? "",
    result.status ?? 1,
  );
}
