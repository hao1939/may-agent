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
 * A reload is published only after its consumer synchronously validates and
 * applies the prospective snapshot, so no event-loop turn observes a split
 * registry/host state.
 */
export class AppRegistry {
  private current: AppRegistrySnapshot = Object.freeze({ generation: 0, entries: Object.freeze([]) });

  constructor(private readonly projectsRoot: string) {}

  entries(): LoadedAppInboxDefinition[] {
    return this.current.entries.map((entry) => ({ appDir: entry.appDir, definition: entry.definition }));
  }

  snapshot(): AppRegistrySnapshot {
    return this.current;
  }

  async reload(apply?: (next: LoadedAppInboxDefinition[]) => void): Promise<LoadedAppInboxDefinition[]> {
    const next = await loadAppInboxDefinitions(this.projectsRoot);
    const prospective = Object.freeze({
      generation: this.current.generation + 1,
      entries: immutableEntries(next),
    });
    apply?.(prospective.entries.map((entry) => ({ appDir: entry.appDir, definition: entry.definition })));
    this.current = prospective;
    return this.entries();
  }
}
