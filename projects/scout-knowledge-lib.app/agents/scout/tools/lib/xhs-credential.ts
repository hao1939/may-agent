import { runXhsCommand } from "./xhs-command";

export type XhsCredentialStatus = {
  credential: "xhs";
  state: "ready" | "unavailable";
  reason: string;
  evidence: string[];
  /** Present only when a successful page inspection observed this fact. */
  loginWall?: boolean;
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

  if (
    exitCode !== 0 ||
    !parsed ||
    parsed.status !== "success" ||
    !parsed.data ||
    typeof parsed.data !== "object" ||
    Array.isArray(parsed.data)
  ) {
    return unavailable(
      String(parsed?.error ?? "XHS credential preflight failed"),
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
    ...(typeof parsed.data.loginWall === "boolean"
      ? [`login-wall:${loginWall}`]
      : []),
  ];
  return ready
    ? {
        credential: "xhs",
        state: "ready",
        reason: "The XHS browser session can read source content.",
        evidence,
        ...(typeof parsed.data.loginWall === "boolean" ? { loginWall } : {}),
      }
    : {
        ...unavailable(
          String(
            parsed.data.reason ?? "XHS source readability was not established.",
          ),
          evidence,
        ),
        ...(typeof parsed.data.loginWall === "boolean" ? { loginWall } : {}),
      };
}

export function inspectXhsCredential(
  appDir: string,
  signal?: AbortSignal,
  timeoutMs?: number,
): Promise<XhsCredentialStatus> {
  return runXhsStatus(appDir, "status", signal, timeoutMs);
}

/** Workflow action: restore an absent tab, then inspect the actual page. */
export function prepareXhsSession(
  appDir: string,
  signal?: AbortSignal,
  timeoutMs?: number,
): Promise<XhsCredentialStatus> {
  return runXhsStatus(appDir, "prepare", signal, timeoutMs);
}

async function runXhsStatus(
  appDir: string,
  command: "status" | "prepare",
  signal?: AbortSignal,
  timeoutMs?: number,
): Promise<XhsCredentialStatus> {
  let output;
  try {
    output = await runXhsCommand(appDir, [command], signal, timeoutMs);
  } catch (error) {
    signal?.throwIfAborted();
    return unavailable(
      `XHS credential preflight could not run: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseXhsCredentialOutput(
    output.stdout,
    output.stderr,
    output.exitCode,
  );
}
