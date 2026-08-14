import { loadAppInboxDefinitions, type LoadedAppInboxDefinition } from "./loader/app-inbox-loader.js";

/**
 * The process-wide snapshot of durable App addresses.
 *
 * A reload is published only after its consumer synchronously validates and
 * applies the prospective snapshot, so no event-loop turn observes a split
 * registry/host state.
 */
export class AppRegistry {
  private loaded: LoadedAppInboxDefinition[] = [];

  constructor(private readonly projectsRoot: string) {}

  entries(): LoadedAppInboxDefinition[] {
    return [...this.loaded];
  }

  async reload(
    apply?: (next: LoadedAppInboxDefinition[]) => void,
  ): Promise<LoadedAppInboxDefinition[]> {
    const next = await loadAppInboxDefinitions(this.projectsRoot);
    apply?.(next);
    this.loaded = next;
    return this.entries();
  }
}
