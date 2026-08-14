import { loadAppInboxDefinitions, type LoadedAppInboxDefinition } from "./loader/app-inbox-loader.js";

export type AppRegistrySnapshot = Readonly<{
  generation: number;
  entries: readonly Readonly<LoadedAppInboxDefinition>[];
}>;

function immutableEntries(entries: LoadedAppInboxDefinition[]): readonly Readonly<LoadedAppInboxDefinition>[] {
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
  private current: AppRegistrySnapshot = Object.freeze({ generation: 0, entries: Object.freeze([]) });
  private reloadQueue: Promise<void> = Promise.resolve();

  constructor(private readonly projectsRoot: string) {}

  entries(): LoadedAppInboxDefinition[] {
    return this.current.entries.map((entry) => ({ appDir: entry.appDir, definition: entry.definition }));
  }

  snapshot(): AppRegistrySnapshot {
    return this.current;
  }

  reload(apply?: (next: AppRegistrySnapshot) => void | Promise<void>): Promise<LoadedAppInboxDefinition[]> {
    const operation = this.reloadQueue.then(() => this.performReload(apply));
    this.reloadQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async performReload(
    apply?: (next: AppRegistrySnapshot) => void | Promise<void>,
  ): Promise<LoadedAppInboxDefinition[]> {
    const next = await loadAppInboxDefinitions(this.projectsRoot);
    const prospective = Object.freeze({
      generation: this.current.generation + 1,
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
