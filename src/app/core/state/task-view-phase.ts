/** Shared read projection, not a scheduler decision. The stored ready bit is
 * only a wake hint; static dependencies still gate a waiting Task. */
export function taskViewPhaseSql(row: "t" | "app_tasks"): string {
  return `CASE
    WHEN ${row}.phase = 'converged' AND (${row}.ready = 1 OR ${row}.changed = 1) THEN 'pending'
    WHEN ${row}.phase = 'waiting' AND ${row}.ready = 1
      AND NOT EXISTS (
        SELECT 1 FROM json_each(${row}.resource_json, '$.spec.dependsOn') dependency
        WHERE NOT EXISTS (
          SELECT 1 FROM app_tasks required
          WHERE required.app_id = ${row}.app_id AND required.task_id = dependency.value
            AND required.phase = 'converged' AND required.observed_generation = required.generation
        )
      ) THEN 'pending'
    ELSE ${row}.phase END`;
}
