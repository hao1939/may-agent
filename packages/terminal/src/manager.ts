import { existsSync } from "node:fs";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolve } from "node:path";

export interface TerminalProfile {
  id: string;
  label: string;
  description: string;
  command: string;
  cwd: string;
}

export interface TerminalStatus {
  enabled: boolean;
  reason?: string;
  profiles: Array<TerminalProfile & { connected: boolean; pid?: number; clients: number }>;
}

export interface TerminalSocket {
  send(data: string): void;
  close(): void;
}

interface TerminalSession {
  profile: TerminalProfile;
  child: ChildProcessWithoutNullStreams;
  ptyPid?: number;
  clients: Set<TerminalSocket>;
  stdoutBuffer: string;
}

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;

function enabledFromEnv(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.MAY_WEB_TERMINAL || "");
}

function sanitizeTmuxName(id: string): string {
  return `may-web-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function makeProfiles(projectRoot: string): TerminalProfile[] {
  const root = resolve(projectRoot);
  return [
    {
      id: "may",
      label: "May Console",
      description: "Interactive console attached to the running May daemon.",
      command: "may-console",
      cwd: root,
    },
    {
      id: "shell",
      label: "Shell",
      description: "Interactive bash shell inside the may-agent container.",
      command: "bash -i",
      cwd: root,
    },
    {
      id: "claude",
      label: "Claude",
      description: "Interactive Claude Code CLI session with container-local permission bypass enabled.",
      command: "bash -lc 'cd \"${PROJECT_ROOT:-/app}\"; exec claude --dangerously-skip-permissions --permission-mode bypassPermissions --add-dir /app'",
      cwd: root,
    },
    {
      id: "codex",
      label: "Codex",
      description: "Interactive Codex CLI session with container-local approval and sandbox bypass enabled.",
      command: "bash -lc 'source /usr/local/bin/setup-codex-config.sh; cd \"${PROJECT_ROOT:-/app}\"; exec codex --dangerously-bypass-approvals-and-sandbox --cd \"${PROJECT_ROOT:-/app}\" --add-dir /app'",
      cwd: root,
    },
    {
      id: "ops",
      label: "Ops",
      description: "Supervisor/process shell for checking the May instance.",
      command: "bash -lc \"supervisorctl status 2>/dev/null || true; echo; exec bash -i\"",
      cwd: root,
    },
  ];
}

function terminalBridgeCandidates(projectRoot: string): string[] {
  return [
    process.env.MAY_TERMINAL_BRIDGE || "",
    resolve(process.cwd(), "packages", "terminal", "bin", "terminal-bridge.cjs"),
    resolve(projectRoot, "packages", "terminal", "bin", "terminal-bridge.cjs"),
    resolve(projectRoot, "projects", "platform", "repos", "may-agent", "packages", "terminal", "bin", "terminal-bridge.cjs"),
  ].filter(Boolean);
}

function resolveTerminalBridge(projectRoot: string): string {
  const bridge = terminalBridgeCandidates(projectRoot).find((candidate) => existsSync(candidate));
  if (!bridge) {
    throw new Error("Unable to find terminal-bridge.cjs. Set MAY_TERMINAL_BRIDGE or run from the may-agent repo.");
  }
  return bridge;
}

export function createTerminalManager(opts: { projectRoot: string }) {
  const profiles = makeProfiles(opts.projectRoot);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const sessions = new Map<string, TerminalSession>();
  const enabled = enabledFromEnv();
  const disabledReason = enabled ? undefined : "Set MAY_WEB_TERMINAL=1 to enable web terminal access.";

  function getStatus(): TerminalStatus {
    return {
      enabled,
      reason: disabledReason,
      profiles: profiles.map((profile) => {
        const session = sessions.get(profile.id);
        return {
          ...profile,
          connected: !!session,
          pid: session?.ptyPid ?? session?.child.pid,
          clients: session?.clients.size ?? 0,
        };
      }),
    };
  }

  function requireEnabled(): void {
    if (!enabled) throw new Error(disabledReason);
  }

  function resolveProfile(profileId: string): TerminalProfile {
    const profile = profileById.get(profileId);
    if (!profile) throw new Error(`Unknown terminal profile: ${profileId}`);
    return profile;
  }

  async function ensureSession(profileId: string, cols = DEFAULT_COLS, rows = DEFAULT_ROWS): Promise<TerminalSession> {
    requireEnabled();
    const existing = sessions.get(profileId);
    if (existing) return existing;

    const profile = resolveProfile(profileId);
    const tmuxName = sanitizeTmuxName(profile.id);
    const bridge = resolveTerminalBridge(opts.projectRoot);
    const child = spawn("node", [bridge, JSON.stringify({
      profileId,
      tmuxName,
      command: profile.command,
      cwd: profile.cwd,
      cols: Number.isFinite(cols) ? cols : DEFAULT_COLS,
      rows: Number.isFinite(rows) ? rows : DEFAULT_ROWS,
    })], {
      cwd: profile.cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      },
    });

    const session: TerminalSession = {
      profile,
      child,
      clients: new Set(),
      stdoutBuffer: "",
    };

    child.stdout.on("data", (chunk: Buffer) => {
      session.stdoutBuffer += chunk.toString();
      const lines = session.stdoutBuffer.split("\n");
      session.stdoutBuffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let frame: any;
        try {
          frame = JSON.parse(line);
        } catch {
          frame = { type: "data", data: line + "\n" };
        }
        if (frame.type === "ready" && typeof frame.pid === "number") session.ptyPid = frame.pid;
        for (const client of session.clients) {
          try {
            client.send(JSON.stringify(frame));
          } catch {}
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const frame = { type: "data", data: chunk.toString() };
      for (const client of session.clients) {
        try {
          client.send(JSON.stringify(frame));
        } catch {}
      }
    });

    child.on("close", (code, signal) => {
      for (const client of session.clients) {
        try {
          client.send(JSON.stringify({ type: "exit", exitCode: code ?? 0, signal }));
          client.close();
        } catch {}
      }
      session.clients.clear();
      sessions.delete(profile.id);
    });

    sessions.set(profile.id, session);
    return session;
  }

  async function attach(profileId: string, socket: TerminalSocket, cols?: number, rows?: number): Promise<void> {
    const session = await ensureSession(profileId, cols, rows);
    session.clients.add(socket);
    socket.send(JSON.stringify({
      type: "ready",
      profile: session.profile,
      pid: session.ptyPid ?? session.child.pid,
    }));
  }

  function detach(profileId: string, socket: TerminalSocket): void {
    const session = sessions.get(profileId);
    if (!session) return;
    session.clients.delete(socket);
    if (session.clients.size === 0) {
      session.child.kill();
      sessions.delete(profileId);
    }
  }

  function input(profileId: string, data: string): void {
    const session = sessions.get(profileId);
    if (!session) throw new Error(`Terminal is not connected: ${profileId}`);
    session.child.stdin.write(JSON.stringify({ type: "input", data }) + "\n");
  }

  function resize(profileId: string, cols: number, rows: number): void {
    const session = sessions.get(profileId);
    if (!session) return;
    const safeCols = Math.max(20, Math.min(400, Math.floor(cols || DEFAULT_COLS)));
    const safeRows = Math.max(8, Math.min(160, Math.floor(rows || DEFAULT_ROWS)));
    session.child.stdin.write(JSON.stringify({ type: "resize", cols: safeCols, rows: safeRows }) + "\n");
  }

  function restart(profileId: string): void {
    requireEnabled();
    const profile = resolveProfile(profileId);
    const session = sessions.get(profileId);
    if (session) {
      for (const client of session.clients) {
        try {
          client.send(JSON.stringify({ type: "restart" }));
          client.close();
        } catch {}
      }
      session.clients.clear();
      session.child.kill();
      sessions.delete(profileId);
    }
    if (existsSync("/usr/bin/tmux") || existsSync("/bin/tmux") || existsSync("/usr/local/bin/tmux")) {
      spawnSync("tmux", ["kill-session", "-t", sanitizeTmuxName(profile.id)], { stdio: "ignore" });
    }
  }

  return {
    getStatus,
    ensureSession,
    attach,
    detach,
    input,
    resize,
    restart,
  };
}
