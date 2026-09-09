import { randomUUID } from "node:crypto";
import type { AppEvent, TaskIntent } from "@may-agent/sdk";
import { normalizeAppAgent, type HostAppDefinition } from "../../app-agent-selection.js";
import { assertValidAppDefinition } from "./definition-validation.js";

/** Discovery supplies declarations, not validated registrations or live resources. */
export type AppDefinitionSource = () => Promise<readonly { appDir: string; definition: unknown }[]>;

export type LoadedAppDefinition = {
  appDir: string;
  definition: HostAppDefinition;
};

export type AppRegistrySnapshot = Readonly<{
  /** Boot-unique durable identity; unlike generation it cannot collide after restart. */
  id: string;
  generation: number;
  entries: readonly Readonly<LoadedAppDefinition>[];
}>;

function immutableEntries(entries: Awaited<ReturnType<AppDefinitionSource>>): readonly Readonly<LoadedAppDefinition>[] {
  const ids = new Set<string>();
  return Object.freeze(
    entries.map(({ appDir, definition }) => {
      assertValidAppDefinition(definition);
      if (ids.has(definition.id)) throw new Error(`Duplicate App id: ${definition.id}`);
      ids.add(definition.id);
      return Object.freeze({ appDir, definition: Object.freeze(normalizeAppAgent(definition)) });
    }),
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

  constructor(private discover: AppDefinitionSource) {
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

  reload(
    apply?: (next: AppRegistrySnapshot) => void | Promise<void>,
    discover?: AppDefinitionSource,
  ): Promise<LoadedAppDefinition[]> {
    const operation = this.reloadQueue.then(() => this.performReload(apply, discover ?? this.discover));
    this.reloadQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async performReload(
    apply: ((next: AppRegistrySnapshot) => void | Promise<void>) | undefined,
    discover: AppDefinitionSource,
  ): Promise<LoadedAppDefinition[]> {
    // Invoke discovery inside the queue, never while scheduling a reload.
    // A replacement source becomes the default only after successful publication.
    const next = await discover();
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
    this.discover = discover;
    return this.entries();
  }
}
