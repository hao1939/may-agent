import type { AppDefinition, AppContract, EventSelector } from "@may-agent/sdk";

/** Resource observations need no App-authored record-only routing declaration. */
export function appObservationSelectors(app: Readonly<AppDefinition>): EventSelector[] {
  return [
    ...(app.observations ?? []),
    ...(app.observers ?? []).flatMap((observer) =>
      "inspect" in observer
        ? [observer.type, "app.observer.failed"].map((type) => ({
            type,
            source: `app:${app.id}:observer:${observer.id}`,
          }))
        : [],
    ),
  ];
}

/** One declaration projection shared by agent, workflow and executor reads. */
export function readAppContract(app: Readonly<AppDefinition>): AppContract {
  return {
    appId: app.id,
    inputSchema: structuredClone(app.inputSchema),
    observations: (app.observers ?? []).flatMap((observer) =>
      "inspect" in observer
        ? [
            {
              appId: app.id,
              id: observer.id,
              type: observer.type,
              description: observer.description,
              intervalMs: observer.intervalMs,
              timeoutMs: observer.timeoutMs,
            },
          ]
        : [],
    ),
  };
}

export function readInstalledAppContract(
  entries: readonly { definition: Readonly<AppDefinition> }[],
  requestedAppId: string,
): AppContract {
  const appId = requestedAppId.trim().replace(/\.app$/, "");
  const app = entries.find(({ definition }) => definition.id === appId)?.definition;
  if (!app) throw new Error(`App ${appId} has no installed Task input contract`);
  return readAppContract(app);
}
