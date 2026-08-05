import { existsSync } from "node:fs";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";

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
  profiles: Array<TerminalProfile & {
    connected: boolean;
    ready: boolean;
    pid?: number;
    clients: number;
    idleUntil?: number;
    startupMs?: number;
  }>;
}

export interface TerminalSocket {
  send(data: string): void;
  close(): void;
}

export interface TerminalManagerOptions {
  projectRoot: string;
  enabled?: boolean;
  idleTtlMs?: number;
  bridgePath?: string;
  tmuxSocket?: string;
}

interface TerminalSession {
  profile: TerminalProfile;
  child: ChildProcessWithoutNullStreams;
  ptyPid?: number;
  clients: Set<TerminalSocket>;
  clientIds: Map<TerminalSocket, string>;
  activeClientId?: string;
  stdoutBuffer: string;
  startedAt: number;
  readyFrame?: { type: "ready"; profile: TerminalProfile; pid: number; startupMs: number };
  idleTimer?: ReturnType<typeof setTimeout>;
  idleUntil?: number;
}

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;
const DEFAULT_IDLE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_TMUX_SOCKET = "may-web";

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
    resolve(projectRoot, "projects", "may-agent", "packages", "terminal", "bin", "may-console.cjs"),
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
      description: "Talk to May. Session watching and control stay explicit.",
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
      command: "bash -lc 'export ANTHROPIC_BASE_URL=\"${MODEL_BASE_URL:-http://host.docker.internal:4000}\" ANTHROPIC_API_KEY=\"${MODEL_API_KEY:-not-needed}\"; cd \"${PROJECT_ROOT:-/app}\"; exec claude --model \"${CLAUDE_MODEL:-claude-opus-5}\" --continue --dangerously-skip-permissions --permission-mode bypassPermissions --add-dir /app'",
      cwd: root,
    },
    {
      id: "codex",
      label: "Codex",
      description: "Interactive Codex CLI session with container-local approval/sandbox bypass and session resume enabled.",
      command: "bash -lc 'source /usr/local/bin/setup-codex-config.sh; cd \"${PROJECT_ROOT:-/app}\"; codex --no-alt-screen resume --last --dangerously-bypass-approvals-and-sandbox --cd \"${PROJECT_ROOT:-/app}\" --add-dir /app || exec codex --no-alt-screen --dangerously-bypass-approvals-and-sandbox --cd \"${PROJECT_ROOT:-/app}\" --add-dir /app'",
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
    resolve(projectRoot, "projects", "may-agent", "packages", "terminal", "bin", "terminal-bridge.cjs"),
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

export function createTerminalManager(opts: TerminalManagerOptions) {
  const profiles = makeProfiles(opts.projectRoot);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const sessions = new Map<string, TerminalSession>();
  const enabled = opts.enabled ?? enabledFromEnv();
  const disabledReason = enabled ? undefined : "Set MAY_WEB_TERMINAL=1 to enable web terminal access.";
  const idleTtl = opts.idleTtlMs ?? idleTtlMs();
  const tmuxSocket = opts.tmuxSocket || process.env.MAY_WEB_TERMINAL_TMUX_SOCKET || DEFAULT_TMUX_SOCKET;

  function killTmuxSession(profile: TerminalProfile): void {
    spawnSync("tmux", ["-L", tmuxSocket, "kill-session", "-t", sanitizeTmuxName(profile.id)], { stdio: "ignore" });
  }

  function closeSession(profileId: string, session: TerminalSession, terminateProfile = false): void {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.idleTimer = undefined;
    session.idleUntil = undefined;
    session.child.kill();
    if (terminateProfile) killTmuxSession(session.profile);
    if (sessions.get(profileId) === session) sessions.delete(profileId);
  }

  function clearIdleTimer(session: TerminalSession): void {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.idleTimer = undefined;
    session.idleUntil = undefined;
  }

  function scheduleIdleClose(profileId: string, session: TerminalSession): void {
    clearIdleTimer(session);
    if (idleTtl <= 0) {
      closeSession(profileId, session, true);
      return;
    }
    session.idleUntil = Date.now() + idleTtl;
    session.idleTimer = setTimeout(() => {
      if (session.clients.size === 0 && sessions.get(profileId) === session) {
        closeSession(profileId, session, true);
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
          ready: !!session?.readyFrame,
          pid: session?.ptyPid ?? session?.child.pid,
          clients: session?.clients.size ?? 0,
          idleUntil: session?.idleUntil,
          startupMs: session?.readyFrame?.startupMs,
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
    const bridge = opts.bridgePath ?? resolveTerminalBridge(opts.projectRoot);
    const child = spawn("node", [bridge, JSON.stringify({
      profileId,
      tmuxName,
      tmuxSocket,
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
      clientIds: new Map(),
      stdoutBuffer: "",
      startedAt: Date.now(),
    };

    function broadcastData(data: string): void {
      const frame = { type: "data", data };
      for (const client of session.clients) {
        try {
          client.send(JSON.stringify(frame));
        } catch {}
      }
    }

    const stdoutDecoder = new StringDecoder("utf8");
    const stderrDecoder = new StringDecoder("utf8");

    function processStdoutText(text: string): void {
      session.stdoutBuffer += text;
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
        if (frame.type === "ready" && typeof frame.pid === "number") {
          session.ptyPid = frame.pid;
          frame = {
            type: "ready",
            profile: session.profile,
            pid: frame.pid,
            startupMs: Math.max(0, Date.now() - session.startedAt),
          };
          session.readyFrame = frame;
        }
        for (const client of session.clients) {
          try {
            client.send(JSON.stringify(frame));
          } catch {}
        }
      }
    }

    child.stdout.on("data", (chunk: Buffer) => {
      processStdoutText(stdoutDecoder.write(chunk));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const data = stderrDecoder.write(chunk);
      if (data) broadcastData(data);
    });

    child.on("error", (error) => {
      for (const client of session.clients) {
        try {
          client.send(JSON.stringify({ type: "error", message: `Unable to start terminal bridge: ${error.message}` }));
          client.close();
        } catch {}
      }
      session.clients.clear();
      if (sessions.get(profile.id) === session) sessions.delete(profile.id);
    });

    child.on("close", (code, signal) => {
      const remainingStdout = stdoutDecoder.end();
      if (remainingStdout) processStdoutText(remainingStdout);
      const remainingStderr = stderrDecoder.end();
      if (remainingStderr) broadcastData(remainingStderr);
      if (session.idleTimer) clearTimeout(session.idleTimer);
      for (const client of session.clients) {
        try {
          client.send(JSON.stringify({ type: "exit", exitCode: code ?? 0, signal }));
          client.close();
        } catch {}
      }
      session.clients.clear();
      if (sessions.get(profile.id) === session) sessions.delete(profile.id);
    });

    sessions.set(profile.id, session);
    return session;
  }

  async function attach(profileId: string, socket: TerminalSocket, cols?: number, rows?: number, clientId?: string): Promise<void> {
    const session = await ensureSession(profileId, cols, rows);
    clearIdleTimer(session);
    const wasEmpty = session.clients.size === 0;
    session.clients.add(socket);
    if (clientId) {
      session.clientIds.set(socket, clientId);
      if (wasEmpty && !session.activeClientId) session.activeClientId = clientId;
    }
    if (wasEmpty || !session.activeClientId) {
      writeResize(session, cols ?? DEFAULT_COLS, rows ?? DEFAULT_ROWS);
    }
    socket.send(JSON.stringify(session.readyFrame ?? {
      type: "starting",
      profile: session.profile,
    }));
  }

  function detach(profileId: string, socket: TerminalSocket, clientId?: string): void {
    const session = sessions.get(profileId);
    if (!session) return;
    session.clients.delete(socket);
    const removedClientId = clientId ?? session.clientIds.get(socket);
    session.clientIds.delete(socket);
    if (session.activeClientId === removedClientId) session.activeClientId = undefined;
    if (session.clients.size === 0) {
      scheduleIdleClose(profileId, session);
    }
  }

  function input(profileId: string, data: string, clientId?: string): void {
    const session = sessions.get(profileId);
    if (!session) throw new Error(`Terminal is not connected: ${profileId}`);
    if (clientId) session.activeClientId = clientId;
    session.child.stdin.write(JSON.stringify({ type: "input", data }) + "\n");
  }

  function scroll(profileId: string, direction: "up" | "down", lines: number, clientId?: string): void {
    const session = sessions.get(profileId);
    if (!session) throw new Error(`Terminal is not connected: ${profileId}`);
    if (clientId) session.activeClientId = clientId;
    const safeLines = Math.max(1, Math.min(100, Math.floor(lines || 1)));
    session.child.stdin.write(JSON.stringify({ type: "scroll", direction, lines: safeLines }) + "\n");
  }

  function historyExit(profileId: string, clientId?: string): void {
    const session = sessions.get(profileId);
    if (!session) return;
    if (clientId) session.activeClientId = clientId;
    session.child.stdin.write(JSON.stringify({ type: "history-exit" }) + "\n");
  }

  function writeResize(session: TerminalSession, cols: number, rows: number): void {
    const safeCols = Math.max(20, Math.min(400, Math.floor(cols || DEFAULT_COLS)));
    const safeRows = Math.max(8, Math.min(160, Math.floor(rows || DEFAULT_ROWS)));
    session.child.stdin.write(JSON.stringify({ type: "resize", cols: safeCols, rows: safeRows }) + "\n");
  }

  function activate(profileId: string, clientId: string, cols?: number, rows?: number): void {
    const session = sessions.get(profileId);
    if (!session) return;
    if (!clientId) return;
    session.activeClientId = clientId;
    if (cols !== undefined || rows !== undefined) writeResize(session, cols ?? DEFAULT_COLS, rows ?? DEFAULT_ROWS);
  }

  function resize(profileId: string, cols: number, rows: number, clientId?: string): void {
    const session = sessions.get(profileId);
    if (!session) return;
    if (clientId) {
      if (session.activeClientId && session.activeClientId !== clientId) return;
      session.activeClientId = clientId;
    }
    writeResize(session, cols, rows);
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
      closeSession(profileId, session, true);
    } else {
      killTmuxSession(profile);
    }
  }

  return {
    getStatus,
    ensureSession,
    attach,
    detach,
    input,
    scroll,
    historyExit,
    activate,
    resize,
    restart,
  };
}
