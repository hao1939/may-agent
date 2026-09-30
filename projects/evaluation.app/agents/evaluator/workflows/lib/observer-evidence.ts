import {
  sendPublicReadCommand,
  type PublicCommand,
} from "./public-task-evidence.js";

const object = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

/** Supplement the selected review, without changing the Task snapshot identity
 * on every healthy poll. Retain this separately in the immutable report. */
export async function readObserverEvidence(
  task: Record<string, unknown> | undefined,
  command: PublicCommand = sendPublicReadCommand,
) {
  const conditions = object(task?.appTask).conditions;
  if (!Array.isArray(conditions)) return undefined;
  const interests = conditions.flatMap((value) => {
    const condition = object(value);
    const source = object(condition.expected).source;
    const match =
      typeof source === "string"
        ? /^app:([^:]+):observer:(.+)$/.exec(source)
        : null;
    if (!match || object(condition.observation).state === "true") return [];
    return [
      {
        conditionId: String(condition.id),
        appId: match[1],
        observerId: match[2],
        resource: String(condition.subject ?? "").replace(/^resource:/, ""),
      },
    ];
  });
  if (!interests.length) return undefined;
  const selected = interests.slice(0, 16);
  const apps = [...new Set(selected.map((item) => item.appId))].slice(0, 4);
  const reads = new Map<string, Record<string, any>>();
  for (const appId of apps) {
    try {
      const reply = await command({ type: "apps.list", appId });
      const entries = reply.apps;
      if (reply.command !== "apps.list" || !Array.isArray(entries))
        throw new Error("Observer App read unavailable");
      const app = entries.find((value) => object(value).id === appId);
      reads.set(
        appId,
        app ? object(app) : { error: "Source App is not installed" },
      );
    } catch (error) {
      reads.set(appId, { error: String(error).slice(0, 500) });
    }
  }
  return {
    capturedAt: Date.now(),
    truncated:
      interests.length > selected.length ||
      new Set(selected.map((item) => item.appId)).size > apps.length,
    items: selected.map((interest) => {
      const app = reads.get(interest.appId);
      const capability = Array.isArray(app?.observations)
        ? app.observations.find(
            (item: unknown) => object(item).id === interest.observerId,
          )
        : undefined;
      const health = Array.isArray(app?.observerHealth)
        ? app.observerHealth.find(
            (item: unknown) => object(item).id === interest.observerId,
          )
        : undefined;
      if (!capability || !health)
        return {
          ...interest,
          available: false,
          reason:
            app?.error ??
            (app
              ? "Observer capability or health evidence unavailable"
              : "Source App exceeds read bound"),
        };
      const { resources, ...run } = health;
      const resource = Array.isArray(resources)
        ? resources.find((item) => object(item).resource === interest.resource)
        : undefined;
      return {
        ...interest,
        available: health.available === true,
        capability,
        run,
        resource: resource ?? null,
        ...(health.available === true
          ? {}
          : { reason: "Observer runtime unavailable" }),
      };
    }),
  };
}
