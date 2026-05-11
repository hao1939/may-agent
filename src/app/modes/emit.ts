import { daemonSocketPath, emitDaemonEvent } from "../../../packages/control/src/client.js";

export interface EmitMode {
  event: string;
  data?: unknown;
}

export function parseEmitMode(argv: string[]): EmitMode | null {
  const idx = argv.indexOf("--emit");
  if (idx === -1 || !argv[idx + 1]) return null;

  try {
    return {
      event: argv[idx + 1],
      data: argv[idx + 2] ? JSON.parse(argv[idx + 2]) : undefined,
    };
  } catch (err) {
    throw new Error(`Invalid --emit JSON payload: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function runEmitMode(opts: {
  mode: EmitMode;
  persistDir: string;
  instanceLabel: string;
  interfaceAgent: string;
  daemonInstance?: string;
  daemonAgent?: string;
}): Promise<void> {
  const socketPath = daemonSocketPath(opts.persistDir, {
    instance: opts.daemonInstance || opts.instanceLabel,
    interfaceAgent: opts.daemonAgent || opts.interfaceAgent,
  });

  let lastError: unknown;
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await emitDaemonEvent(socketPath, opts.mode.event, (opts.mode.data ?? {}) as Record<string, unknown>, { timeoutMs: 5000 });
      console.log(`Event emitted: ${opts.mode.event}`);
      return;
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (attempt === 1 && isTransientSocketError(message)) {
        console.error(`Failed to connect to daemon socket ${socketPath}: ${message}`);
        console.error("Retrying briefly on the same convention path...");
      }
      if (attempt < maxAttempts && isTransientSocketError(message)) {
        await sleep(500);
        continue;
      }
      break;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to emit ${opts.mode.event} via daemon socket ${socketPath}: ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientSocketError(message: string): boolean {
  return message.includes("ENOENT")
    || message.includes("ECONNREFUSED")
    || message.includes("Socket closed before command sent");
}
