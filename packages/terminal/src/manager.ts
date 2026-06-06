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
  profiles: Array<TerminalProfile & { connected: boolean; pid?: number; clients: number; idleUntil?: number }>;
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
  replayBuffer: string;
  idleTimer?: ReturnType<typeof setTimeout>;
  idleUntil?: number;
}

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;
const DEFAULT_IDLE_TTL_MS = 10 * 60 * 1000;
const TMUX_SOCKET = "may-web";
const MAX_REPLAY_BUFFER_BYTES = 8 * 1024 * 1024;

function enabledFromEnv(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.MAY_WEB_TERMINAL || "");
}

function sanitizeTmuxName(id: string): string {
  return `may-web-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function idleTtlMs(): number {
  const raw = process.env.MAY_WEB_TERMINAL_IDLE_TTL_MS;
  if (!raw) return DEFAULT_IDLE_TTL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_IDLE_TTL_MS;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function mayConsoleCandidates(projectRoot: string): string[] {
  return [
    process.env.MAY_CONSOLE_BIN || "",
    resolve(process.cwd(), "packages", "terminal", "bin", "may-console.cjs"),
    resolve(projectRoot, "packages", "terminal", "bin", "may-console.cjs"),
    resolve(projectRoot, "projects", "platform", "repos", "may-agent", "packages", "terminal", "bin", "may-console.cjs"),
    "/usr/local/bin/may-console",
  ].filter(Boolean);
}

function resolveMayConsoleCommand(projectRoot: string): string {
  const script = mayConsoleCandidates(projectRoot).find((candidate) => existsSync(candidate));
  if (!script) return "may-console";
  return script.endsWith(".cjs") || script.endsWith(".js")
    ? `node ${shellQuote(script)}`
    : shellQuote(script);
}

function makeProfiles(projectRoot: string): TerminalProfile[] {
  const root = resolve(projectRoot);
  return [
    {
      id: "may",
      label: "May Console",
      description: "Interactive console attached to the running May daemon.",
      command: resolveMayConsoleCommand(root),
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
      description: "Interactive Claude Code CLI session with container-local permission bypass and session resume enabled.",
      command: "bash -lc 'cd \"${PROJECT_ROOT:-/app}\"; exec claude --continue --dangerously-skip-permissions --permission-mode bypassPermissions --add-dir /app'",
      cwd: root,
    },
    {
      id: "codex",
      label: "Codex",
      description: "Interactive Codex CLI session with container-local approval/sandbox bypass and session resume enabled.",
      command: "bash -lc 'source /usr/local/bin/setup-codex-config.sh; cd \"${PROJECT_ROOT:-/app}\"; codex resume --last --dangerously-bypass-approvals-and-sandbox --cd \"${PROJECT_ROOT:-/app}\" --add-dir /app || exec codex --dangerously-bypass-approvals-and-sandbox --cd \"${PROJECT_ROOT:-/app}\" --add-dir /app'",
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
  const idleTtl = idleTtlMs();

  function closeSession(profileId: string, session: TerminalSession): void {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.idleTimer = undefined;
    session.idleUntil = undefined;
    session.child.kill();
    sessions.delete(profileId);
  }

  function clearIdleTimer(session: TerminalSession): void {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.idleTimer = undefined;
    session.idleUntil = undefined;
  }

  function scheduleIdleClose(profileId: string, session: TerminalSession): void {
    clearIdleTimer(session);
    if (idleTtl <= 0) {
      closeSession(profileId, session);
      return;
    }
    session.idleUntil = Date.now() + idleTtl;
    session.idleTimer = setTimeout(() => {
      if (session.clients.size === 0 && sessions.get(profileId) === session) {
        closeSession(profileId, session);
      }
    }, idleTtl);
    session.idleTimer.unref?.();
  }

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
          idleUntil: session?.idleUntil,
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
    if (existing) {
      clearIdleTimer(existing);
      return existing;
    }

    const profile = resolveProfile(profileId);
    const tmuxName = sanitizeTmuxName(profile.id);
    const bridge = resolveTerminalBridge(opts.projectRoot);
    const child = spawn("node", [bridge, JSON.stringify({
      profileId,
      tmuxName,
      tmuxSocket: TMUX_SOCKET,
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
      replayBuffer: "",
    };

    function rememberOutput(data: string): void {
      session.replayBuffer += data;
      if (session.replayBuffer.length > MAX_REPLAY_BUFFER_BYTES) {
        session.replayBuffer = session.replayBuffer.slice(-MAX_REPLAY_BUFFER_BYTES);
      }
    }

    function broadcastData(data: string): void {
      rememberOutput(data);
      const frame = { type: "data", data };
      for (const client of session.clients) {
        try {
          client.send(JSON.stringify(frame));
        } catch {}
      }
    }

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
        if (frame.type === "data") rememberOutput(String(frame.data || ""));
        for (const client of session.clients) {
          try {
            client.send(JSON.stringify(frame));
          } catch {}
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const data = chunk.toString();
      broadcastData(data);
    });

    child.on("close", (code, signal) => {
      if (session.idleTimer) clearTimeout(session.idleTimer);
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
    clearIdleTimer(session);
    session.clients.add(socket);
    socket.send(JSON.stringify({
      type: "ready",
      profile: session.profile,
      pid: session.ptyPid ?? session.child.pid,
    }));
    if (session.replayBuffer) {
      socket.send(JSON.stringify({ type: "replay", data: session.replayBuffer }));
    }
  }

  function detach(profileId: string, socket: TerminalSocket): void {
    const session = sessions.get(profileId);
    if (!session) return;
    session.clients.delete(socket);
    if (session.clients.size === 0) {
      scheduleIdleClose(profileId, session);
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
      clearIdleTimer(session);
      for (const client of session.clients) {
        try {
          client.send(JSON.stringify({ type: "restart" }));
          client.close();
        } catch {}
      }
      session.clients.clear();
      closeSession(profileId, session);
    }
    if (existsSync("/usr/bin/tmux") || existsSync("/bin/tmux") || existsSync("/usr/local/bin/tmux")) {
      spawnSync("tmux", ["-L", TMUX_SOCKET, "kill-session", "-t", sanitizeTmuxName(profile.id)], { stdio: "ignore" });
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
