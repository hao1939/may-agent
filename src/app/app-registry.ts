import { randomUUID } from "node:crypto";
import type { AppEvent, TaskIntent } from "@may-agent/sdk";
import { invalidateRuntimeModuleCache } from "../lib/runtime-import.js";
import { loadAppDefinitions, type LoadedAppDefinition } from "./loader/app-loader.js";

export type AppRegistrySnapshot = Readonly<{
  /** Boot-unique durable identity; unlike generation it cannot collide after restart. */
  id: string;
  generation: number;
  entries: readonly Readonly<LoadedAppDefinition>[];
}>;

function immutableEntries(entries: LoadedAppDefinition[]): readonly Readonly<LoadedAppDefinition>[] {
  return Object.freeze(
    entries.map((entry) =>
      Object.freeze({
        appDir: entry.appDir,
        definition: Object.freeze(entry.definition),
      }),
    ),
  );
}

/**
 * The process-wide snapshot of durable App addresses.
 *
 * A reload is published only after every consumer prepares and applies the
 * prospective snapshot. The callback may be asynchronous, but publication is
 * still fenced by the immutable generation passed to it.
 */
export class AppRegistry {
  private readonly bootId = randomUUID();
  private current: AppRegistrySnapshot;
  private reloadQueue: Promise<void> = Promise.resolve();

  constructor(private readonly projectsRoot: string) {
    this.current = Object.freeze({ id: `${this.bootId}:0`, generation: 0, entries: Object.freeze([]) });
  }

  entries(): LoadedAppDefinition[] {
    return this.current.entries.map((entry) => ({ appDir: entry.appDir, definition: entry.definition }));
  }

  snapshot(): AppRegistrySnapshot {
    return this.current;
  }

  resolveInstalledTask(
    appId: string,
    event: AppEvent<Record<string, unknown>>,
  ): {
    snapshot: { id: string; generation: number };
    appId: string;
    intent: TaskIntent | null;
  } {
    const snapshot = this.current;
    const entry = snapshot.entries.find((candidate) => candidate.definition.id === appId);
    if (!entry) throw new Error(`App ${appId} is not loaded`);
    const resolver = entry.definition.tasks?.resolve;
    if (!resolver) throw new Error(`App ${appId} does not declare tasks.resolve`);
    return {
      snapshot: { id: snapshot.id, generation: snapshot.generation },
      appId,
      intent: resolver(event),
    };
  }

  reload(apply?: (next: AppRegistrySnapshot) => void | Promise<void>): Promise<LoadedAppDefinition[]> {
    const operation = this.reloadQueue.then(() => this.performReload(apply));
    this.reloadQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async performReload(
    apply?: (next: AppRegistrySnapshot) => void | Promise<void>,
  ): Promise<LoadedAppDefinition[]> {
    // Discovery is part of the serialized reload transaction. Invalidating
    // here makes a rejected generation retryable and prevents a queued reload
    // from reusing the module graph discovered by its predecessor.
    invalidateRuntimeModuleCache();
    const next = await loadAppDefinitions(this.projectsRoot);
    const generation = this.current.generation + 1;
    const prospective = Object.freeze({
      id: `${this.bootId}:${generation}`,
      generation,
      entries: immutableEntries(next),
    });
    await apply?.(prospective);
    if (prospective.generation !== this.current.generation + 1) {
      throw new Error(
        `Cannot publish stale App registry generation ${prospective.generation}; current is ${this.current.generation}`,
      );
    }
    this.current = prospective;
    return this.entries();
  }
}
