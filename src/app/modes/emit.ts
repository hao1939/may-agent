import {
  daemonSocketPath,
  emitDaemonEventWithRetry,
  type EmitDaemonEventRetryOptions,
  type SocketEndpoint,
} from "../../../packages/control/src/client.js";

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
  endpoint?: SocketEndpoint;
  retry?: EmitDaemonEventRetryOptions;
  writeReceipt?: (message: string) => void;
}): Promise<void> {
  const socketPath = daemonSocketPath(opts.persistDir, {
    instance: opts.daemonInstance || opts.instanceLabel,
    interfaceAgent: opts.daemonAgent || opts.interfaceAgent,
  });

  try {
    const acknowledgement = await emitDaemonEventWithRetry(
      opts.endpoint ?? socketPath,
      opts.mode.event,
      (opts.mode.data ?? {}) as Record<string, unknown>,
      opts.retry ?? { timeoutMs: 5000, maxAttempts: 8, retryDelayMs: 500 },
    );
    (opts.writeReceipt ?? console.log)(`Event emitted: ${opts.mode.event} (event ${String(acknowledgement.eventId)})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to emit ${opts.mode.event} via daemon socket ${socketPath}: ${message}`, { cause: error });
  }
}
