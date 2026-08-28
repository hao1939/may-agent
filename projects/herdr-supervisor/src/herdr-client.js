import net from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";

export function defaultSocketPath(env = process.env) {
  return env.HERDR_SOCKET_PATH || join(homedir(), ".config", "herdr", "herdr.sock");
}

function responseError(message) {
  const detail = message?.error?.message || message?.error?.code || "unknown Herdr error";
  return new Error(String(detail));
}

export class HerdrClient {
  constructor({ socketPath = defaultSocketPath(), timeoutMs = 3000 } = {}) {
    this.socketPath = socketPath;
    this.timeoutMs = timeoutMs;
    this.nextId = 0;
  }

  request(method, params = {}) {
    const id = `herdr-supervisor:${process.pid}:${++this.nextId}`;
    return new Promise((resolve, reject) => {
      let buffer = "";
      let settled = false;
      const socket = net.createConnection(this.socketPath);
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        error ? reject(error) : resolve(value);
      };
      const timer = setTimeout(() => finish(new Error(`Herdr ${method} timed out`)), this.timeoutMs);
      timer.unref?.();
      socket.on("error", (error) => finish(error));
      socket.on("close", () => finish(new Error(`Herdr ${method} connection closed`)));
      socket.on("connect", () => socket.write(`${JSON.stringify({ id, method, params })}\n`));
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        for (;;) {
          const newline = buffer.indexOf("\n");
          if (newline < 0) break;
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (!line.trim()) continue;
          let message;
          try { message = JSON.parse(line); } catch { continue; }
          if (message.id !== id) continue;
          if (message.error) finish(responseError(message));
          else finish(undefined, message.result);
        }
      });
    });
  }

  async snapshot() {
    const result = await this.request("session.snapshot", {});
    return result.snapshot;
  }

  async readAgent(paneId, lines = 80) {
    return this.request("agent.read", {
      target: paneId,
      source: "recent_unwrapped",
      format: "text",
      strip_ansi: true,
      lines,
    });
  }

  async promptAgent(paneId, text) {
    return this.request("agent.prompt", { target: paneId, text });
  }

  subscribe(subscriptions, onEvent, onDisconnect = () => {}, onReady = () => {}) {
    const id = `herdr-supervisor:subscribe:${process.pid}:${++this.nextId}`;
    let buffer = "";
    let stopped = false;
    let disconnected = false;
    let ready = false;
    const socket = net.createConnection(this.socketPath);
    const disconnect = (error) => {
      if (stopped || disconnected) return;
      disconnected = true;
      socket.destroy();
      onDisconnect(error);
    };
    socket.on("connect", () => {
      socket.write(`${JSON.stringify({ id, method: "events.subscribe", params: { subscriptions } })}\n`);
    });
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      for (;;) {
        const newline = buffer.indexOf("\n");
        if (newline < 0) break;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        let message;
        try { message = JSON.parse(line); } catch { continue; }
        if (message.id === id) {
          if (message.error) disconnect(responseError(message));
          else if (!ready) {
            ready = true;
            onReady();
          }
        } else if (message.event) {
          onEvent(message);
        }
      }
    });
    socket.on("error", disconnect);
    socket.on("close", () => disconnect(new Error("Herdr subscription closed")));
    return () => {
      stopped = true;
      socket.destroy();
    };
  }
}
