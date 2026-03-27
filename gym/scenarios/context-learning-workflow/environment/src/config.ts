import { z } from "zod";

export const Config = z.object({
  stationId: z.string(),
  feedUrl: z.string().url(),
  heartbeatIntervalMs: z.number().default(15_000), // Must be < 30min or WS drops
  duckdbPath: z.string().default("./data/weather.duckdb"),
  walMode: z.boolean().default(true), // REQUIRED: concurrent reads deadlock without WAL
  tempUnit: z.enum(["kelvin", "celsius", "fahrenheit"]).default("kelvin"),
});

export type Config = z.infer<typeof Config>;
